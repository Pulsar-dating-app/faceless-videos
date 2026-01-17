// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Access API Keys from environment variables
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

// Type for subscription_status enum
type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete_expired"
  | "paused";

// Helper para log com timestamp
function logWithTimestamp(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      }
    );
  }

  try {
    // Validate environment variables
    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    if (!STRIPE_WEBHOOK_SECRET) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase environment variables are not set");
    }

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Initialize Stripe
    const stripe = await import("https://esm.sh/stripe@17.3.1?target=deno");
    const stripeClient = new stripe.Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
      httpClient: stripe.Stripe.createFetchHttpClient(),
    });

    // Verify webhook signature (using async version for Deno/Edge Functions)
    let event: stripe.Stripe.Event;
    try {
      event = await stripeClient.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", errorMessage);
      return new Response(
        JSON.stringify({ error: `Webhook Error: ${errorMessage}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Create Supabase client with service role key (for admin operations)
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    // Verificar se evento já foi processado
    async function isEventProcessed(eventId: string): Promise<boolean> {
      const { data } = await supabaseClient
        .from("webhook_events")
        .select("id")
        .eq("stripe_event_id", eventId)
        .single();

      return !!data;
    }

    // Salvar evento processado
    async function saveProcessedEvent(
      event: stripe.Stripe.Event,
      payload: Record<string, unknown>
    ): Promise<void> {
      await supabaseClient.from("webhook_events").insert({
        stripe_event_id: event.id,
        event_type: event.type,
        payload: payload,
      });
    }

    // Resolver plan_id a partir do stripe_price_id
    async function resolvePlanIdFromPriceId(
      stripePriceId: string
    ): Promise<string | null> {
      const { data, error } = await supabaseClient
        .from("stripe_prices")
        .select("plan_id")
        .eq("stripe_price_id", stripePriceId)
        .eq("active", true)
        .single();

      if (error || !data) {
        console.log(
          `⚠️ [WEBHOOK] Could not resolve plan_id for price: ${stripePriceId}`
        );
        return null;
      }

      return data.plan_id;
    }

    // Mapear status do Stripe para enum
    function mapStripeStatusToEnum(
      stripeStatus: string
    ): SubscriptionStatus | null {
      const statusMap: Record<string, SubscriptionStatus> = {
        incomplete: "incomplete",
        trialing: "trialing",
        active: "active",
        past_due: "past_due",
        canceled: "canceled",
        unpaid: "unpaid",
        incomplete_expired: "incomplete_expired",
        paused: "paused",
      };

      return statusMap[stripeStatus] || null;
    }

    // Comparar status - retorna true se newStatus é melhor ou igual ao currentStatus
    function isStatusBetterOrEqual(
      currentStatus: SubscriptionStatus | null,
      newStatus: SubscriptionStatus
    ): boolean {
      if (!currentStatus) return true; // Se não tem status, aceita qualquer um

      // Hierarquia de status (do pior para o melhor)
      const statusPriority: Record<SubscriptionStatus, number> = {
        incomplete_expired: 0,
        canceled: 1,
        unpaid: 2,
        incomplete: 3,
        past_due: 4,
        trialing: 5,
        paused: 6,
        active: 7,
      };

      return statusPriority[newStatus] >= statusPriority[currentStatus];
    }

    // Verificar se tokens já foram creditados para o período atual
    async function hasTokensBeenCreditedForPeriod(
      subscriptionId: string,
      periodStart: Date
    ): Promise<boolean> {
      // Buscar subscription UUID pelo stripe_subscription_id
      const { data: subData } = await supabaseClient
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId)
        .single();

      if (!subData?.id) {
        return false;
      }

      // Verificar se já existe crédito para este período
      const { data: ledgerData } = await supabaseClient
        .from("token_ledger")
        .select("id")
        .eq("subscription_id", subData.id)
        .eq("reason", "subscription_cycle_credit")
        .gte("created_at", periodStart.toISOString())
        .limit(1);

      return !!ledgerData && ledgerData.length > 0;
    }

    // Creditar tokens ao usuário
    async function creditTokensToUser(
      userId: string,
      subscriptionId: string,
      planId: string,
      periodStart: Date,
      periodEnd: Date
    ): Promise<void> {
      // Buscar tokens_per_cycle do plano
      const { data: planData, error: planError } = await supabaseClient
        .from("plans")
        .select("tokens_per_cycle")
        .eq("plan_id", planId)
        .single();

      if (planError || !planData) {
        console.log(
          `⚠️ [WEBHOOK] Could not find plan ${planId} to credit tokens`
        );
        return;
      }

      // Buscar subscription UUID pelo stripe_subscription_id
      const { data: subData, error: subError } = await supabaseClient
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId)
        .single();

      if (subError || !subData) {
        console.log(
          `⚠️ [WEBHOOK] Could not find subscription ${subscriptionId} to credit tokens`
        );
        return;
      }

      // Verificar se já foi creditado para este período
      const alreadyCredited = await hasTokensBeenCreditedForPeriod(
        subscriptionId,
        periodStart
      );

      if (alreadyCredited) {
        console.log(
          `⚠️ [WEBHOOK] Tokens already credited for subscription ${subscriptionId} in this period`
        );
        return;
      }

      // Inserir crédito no token_ledger
      const { error: ledgerError } = await supabaseClient
        .from("token_ledger")
        .insert({
          user_id: userId,
          subscription_id: subData.id,
          amount: planData.tokens_per_cycle,
          reason: "subscription_cycle_credit",
          meta: {
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            plan_id: planId,
          },
        });

      if (ledgerError) {
        console.log(
          `⚠️ [WEBHOOK] Error crediting tokens:`,
          ledgerError
        );
      } else {
        console.log(
          `✅ [WEBHOOK] Credited ${planData.tokens_per_cycle} tokens to user ${userId} for plan ${planId}`
        );
      }
    }

    // Helper function to get user_id from customer metadata or database
    async function getUserIdFromSubscription(
      subscription: stripe.Stripe.Subscription
    ): Promise<string | null> {
      // First, try to find in database by subscription ID
      const { data: subData } = await supabaseClient
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", subscription.id)
        .single();

      if (subData?.user_id) {
        return subData.user_id;
      }

      // If not found, try to get from customer metadata
      if (subscription.customer) {
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        const customer = await stripeClient.customers.retrieve(customerId);
        
        if (typeof customer !== "string" && customer.metadata?.supabase_user_id) {
          return customer.metadata.supabase_user_id;
        }
      }

      return null;
    }

    // ============================================
    // IDEMPOTENCY CHECK
    // ============================================

    // Verificar se evento já foi processado
    if (await isEventProcessed(event.id)) {
      console.log(
        `ℹ️ [WEBHOOK] Event ${event.id} already processed, skipping`
      );
      return new Response(
        JSON.stringify({ received: true, message: "Event already processed" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // ============================================
    // EVENT HANDLING
    // ============================================

    let subscription: stripe.Stripe.Subscription | undefined;
    let status: SubscriptionStatus | null = null;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as stripe.Stripe.Checkout.Session;
        logWithTimestamp(`✅ [WEBHOOK] [1/3] Checkout session completed: ${session.id}`);
        console.log("👤 [CUSTOMER] Customer ID:", session.customer);
        console.log("👤 [USER_ID] From session metadata:", session.metadata?.supabase_user_id || "NOT FOUND");
        console.log("📋 [PLAN_ID] From session metadata:", session.metadata?.plan_id || "NOT FOUND");

        if (session.mode === "subscription") {
          const subscriptionId = session.subscription as string;
          const userId = session.metadata?.supabase_user_id;
          const planId = session.metadata?.plan_id;

          if (!userId) {
            console.log(
              `⚠️ [WEBHOOK] Missing supabase_user_id in session metadata`
            );
            break;
          }

          if (!subscriptionId) {
            console.log(`⚠️ [WEBHOOK] Missing subscription ID in session`);
            break;
          }

          if (!planId) {
            console.log(`⚠️ [WEBHOOK] Missing plan_id in session metadata`);
            break;
          }

          // Buscar subscription completa do Stripe
          const fullSubscription =
            await stripeClient.subscriptions.retrieve(subscriptionId);

          const stripePriceId =
            fullSubscription.items.data[0]?.price.id || null;
          
          console.log(`📊 [STATUS] Stripe subscription status: ${fullSubscription.status}`);
          console.log(`📊 [STATUS] Payment status: ${fullSubscription.latest_invoice ? 'Has invoice' : 'No invoice'}`);
          
          const mappedStatus = mapStripeStatusToEnum(fullSubscription.status);
          console.log(`📊 [STATUS] Mapped status for database: ${mappedStatus || 'NULL'}`);
          logWithTimestamp(`📊 [STATUS] [1/3] Initial status from checkout: ${mappedStatus || 'NULL'}`);

          if (!mappedStatus) {
            console.log(
              `⚠️ [WEBHOOK] Invalid subscription status: ${fullSubscription.status}`
            );
            break;
          }

          // Atualizar customer metadata no Stripe para garantir que está correto
          const customerId = session.customer as string;
          try {
            const customer = await stripeClient.customers.retrieve(customerId);
            if (typeof customer !== "string" && customer.metadata?.supabase_user_id !== userId) {
              console.log("⚠️ [UPDATE] Customer metadata mismatch, updating...");
              await stripeClient.customers.update(customerId, {
                metadata: {
                  supabase_user_id: userId,
                },
              });
              console.log("✅ [SUCCESS] Customer metadata updated in Stripe");
            }
          } catch (customerUpdateError) {
            console.log("⚠️ [WARN] Could not update customer metadata:", customerUpdateError);
            // Continuar mesmo se não conseguir atualizar
          }

          // Verificar se já existe subscription para este usuário
          const { data: existingSub } = await supabaseClient
            .from("subscriptions")
            .select("id, status")
            .eq("user_id", userId)
            .single();

          const now = new Date().toISOString();
          const periodStart = fullSubscription.current_period_start
            ? new Date(fullSubscription.current_period_start * 1000).toISOString()
            : null;
          const periodEnd = fullSubscription.current_period_end
            ? new Date(fullSubscription.current_period_end * 1000).toISOString()
            : null;

          if (existingSub) {
            // Atualizar subscription existente (garantindo que períodos sejam atualizados)
            const { error: updateError } = await supabaseClient
              .from("subscriptions")
              .update({
                plan_id: planId,
                status: mappedStatus,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                stripe_price_id: stripePriceId,
                current_period_start: periodStart,
                current_period_end: periodEnd,
                cancel_at_period_end:
                  fullSubscription.cancel_at_period_end || false,
                updated_at: now,
              })
              .eq("user_id", userId);

            if (updateError) {
              console.log(
                `⚠️ [WEBHOOK] Error updating subscription:`,
                updateError
              );
            } else {
              console.log(
                `✅ [WEBHOOK] Subscription updated successfully for plan: ${planId}`
              );

              // Se status for active e for primeira assinatura, creditar tokens
              if (
                mappedStatus === "active" &&
                fullSubscription.current_period_start &&
                fullSubscription.current_period_end
              ) {
                await creditTokensToUser(
                  userId,
                  subscriptionId,
                  planId,
                  new Date(fullSubscription.current_period_start * 1000),
                  new Date(fullSubscription.current_period_end * 1000)
                );
              }
            }
          } else {
            // Criar nova subscription
            const { error: insertError } = await supabaseClient
              .from("subscriptions")
              .insert({
                user_id: userId,
                plan_id: planId,
                status: mappedStatus,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                stripe_price_id: stripePriceId,
                current_period_start: periodStart,
                current_period_end: periodEnd,
                cancel_at_period_end:
                  fullSubscription.cancel_at_period_end || false,
                created_at: now,
                updated_at: now,
              });

            if (insertError) {
              console.log(
                `⚠️ [WEBHOOK] Error inserting subscription:`,
                insertError
              );
            } else {
              console.log(
                `✅ [WEBHOOK] Subscription created successfully for plan: ${planId}`
              );

              // Se status for active e for primeira assinatura, creditar tokens
              if (
                mappedStatus === "active" &&
                fullSubscription.current_period_start &&
                fullSubscription.current_period_end
              ) {
                await creditTokensToUser(
                  userId,
                  subscriptionId,
                  planId,
                  new Date(fullSubscription.current_period_start * 1000),
                  new Date(fullSubscription.current_period_end * 1000)
                );
              }
            }
          }
        }
        break;
      }

      case "customer.subscription.created": {
        subscription = event.data.object as stripe.Stripe.Subscription;
        const stripeStatus = subscription.status;
        console.log(
          `✅ [WEBHOOK] Subscription created. Status: ${stripeStatus}`
        );

        status = mapStripeStatusToEnum(stripeStatus);
        if (!status) {
          console.log(
            `⚠️ [WEBHOOK] Invalid subscription status: ${stripeStatus}`
          );
          break;
        }

        // Get user_id from customer metadata or database
        const userId = await getUserIdFromSubscription(subscription);

        if (!userId) {
          console.log(
            `⚠️ [WEBHOOK] Could not find user_id for subscription ${subscription.id}`
          );
          break;
        }

        // Resolver plan_id via stripe_price_id
        const stripePriceId = subscription.items.data[0]?.price.id;
        if (!stripePriceId) {
          console.log(
            `⚠️ [WEBHOOK] Missing price ID in subscription ${subscription.id}`
          );
          break;
        }

        const planId = await resolvePlanIdFromPriceId(stripePriceId);
        if (!planId) {
          console.log(
            `⚠️ [WEBHOOK] Could not resolve plan_id for subscription ${subscription.id}`
          );
          break;
        }

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        // Verificar se já existe subscription para este user_id (troca de plano)
        const { data: existingUserSub } = await supabaseClient
          .from("subscriptions")
          .select("id, stripe_subscription_id")
          .eq("user_id", userId)
          .single();

        const now = new Date().toISOString();

        if (existingUserSub) {
          // Usuário já tem subscription - atualizar com nova subscription ID e plano
          console.log("🔄 [UPGRADE] Updating existing subscription for user (plan change)");
          
          const { error } = await supabaseClient
            .from("subscriptions")
            .update({
              plan_id: planId,
              status: status,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id, // Nova subscription ID
              stripe_price_id: stripePriceId,
              current_period_start: subscription.current_period_start
                ? new Date(
                    subscription.current_period_start * 1000
                  ).toISOString()
                : null,
              current_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              updated_at: now,
            })
            .eq("user_id", userId);

          if (!error) {
            console.log(
              `✅ [WEBHOOK] Subscription updated (upgrade/downgrade) for plan: ${planId}`
            );

            // Se status for active, creditar tokens
            if (
              status === "active" &&
              subscription.current_period_start &&
              subscription.current_period_end
            ) {
              await creditTokensToUser(
                userId,
                subscription.id,
                planId,
                new Date(subscription.current_period_start * 1000),
                new Date(subscription.current_period_end * 1000)
              );
            }
          } else {
            console.log(`⚠️ [WEBHOOK] Error updating subscription:`, error);
          }
        } else {
          // Nova subscription - verificar se já existe pelo subscription ID ou user_id
          const { data: existingSubBySubId } = await supabaseClient
            .from("subscriptions")
            .select("id, user_id, status")
            .eq("stripe_subscription_id", subscription.id)
            .single();

          const { data: existingSubByUserId } = await supabaseClient
            .from("subscriptions")
            .select("id, stripe_subscription_id, status")
            .eq("user_id", userId)
            .single();

          const existingSub = existingSubBySubId || existingSubByUserId;

          if (existingSub) {
            // Subscription já existe - verificar se deve atualizar status
            const currentStatus = existingSub.status as SubscriptionStatus | null;
            const shouldUpdateStatus = isStatusBetterOrEqual(currentStatus, status);
            
            if (!shouldUpdateStatus) {
              console.log(
                `⚠️ [WEBHOOK] Not updating status from ${currentStatus} to ${status} (current status is better)`
              );
              // Ainda atualizar outros campos, mas manter o status atual
            }

            // Preparar dados de update
            const updateData: {
              plan_id: string;
              stripe_customer_id: string;
              stripe_subscription_id: string;
              stripe_price_id: string;
              current_period_start: string | null;
              current_period_end: string | null;
              cancel_at_period_end: boolean;
              updated_at: string;
              status?: SubscriptionStatus;
            } = {
              plan_id: planId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              stripe_price_id: stripePriceId,
              current_period_start: subscription.current_period_start
                ? new Date(
                    subscription.current_period_start * 1000
                  ).toISOString()
                : null,
              current_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              updated_at: now,
            };

            // Só atualizar status se o novo for melhor ou igual
            if (shouldUpdateStatus) {
              updateData.status = status;
            }

            // Usar o identificador correto para o update
            let updateQuery = supabaseClient
              .from("subscriptions")
              .update(updateData);

            if (existingSubBySubId) {
              updateQuery = updateQuery.eq("stripe_subscription_id", subscription.id);
            } else {
              updateQuery = updateQuery.eq("user_id", userId);
            }

            const { error } = await updateQuery;

            if (!error) {
              if (shouldUpdateStatus) {
                console.log(
                  `✅ [WEBHOOK] Subscription status updated to: ${status}`
                );
              } else {
                console.log(
                  `✅ [WEBHOOK] Subscription updated (status kept as ${currentStatus})`
                );
              }
              
              // Se status for active e mudou de incomplete/trialing, creditar tokens
              const finalStatus = shouldUpdateStatus ? status : currentStatus;
              const isFirstActivation =
                (currentStatus === "incomplete" || currentStatus === "trialing") &&
                finalStatus === "active";
              
              if (
                isFirstActivation &&
                subscription.current_period_start &&
                subscription.current_period_end
              ) {
                await creditTokensToUser(
                  userId,
                  subscription.id,
                  planId,
                  new Date(subscription.current_period_start * 1000),
                  new Date(subscription.current_period_end * 1000)
                );
              }
            } else {
              console.log(`⚠️ [WEBHOOK] Error updating subscription:`, error);
            }
          } else {
            // Criar nova subscription
            const { error } = await supabaseClient.from("subscriptions").insert({
              user_id: userId,
              plan_id: planId,
              status: status,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              stripe_price_id: stripePriceId,
              current_period_start: subscription.current_period_start
                ? new Date(
                    subscription.current_period_start * 1000
                  ).toISOString()
                : null,
              current_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              created_at: now,
              updated_at: now,
            });

            if (!error) {
              console.log(`✅ [WEBHOOK] New subscription created in database`);

              // Se status for active, creditar tokens
              if (
                status === "active" &&
                subscription.current_period_start &&
                subscription.current_period_end
              ) {
                await creditTokensToUser(
                  userId,
                  subscription.id,
                  planId,
                  new Date(subscription.current_period_start * 1000),
                  new Date(subscription.current_period_end * 1000)
                );
              }
            } else {
              // Se deu erro de constraint unique (user_id), fazer update
              if (error.code === '23505') {
                console.log(`🔄 [WEBHOOK] User already has subscription, updating instead`);
                const { error: updateError } = await supabaseClient
                  .from("subscriptions")
                  .update({
                    plan_id: planId,
                    status: status,
                    stripe_customer_id: customerId,
                    stripe_subscription_id: subscription.id,
                    stripe_price_id: stripePriceId,
                    current_period_start: subscription.current_period_start
                      ? new Date(
                          subscription.current_period_start * 1000
                        ).toISOString()
                      : null,
                    current_period_end: subscription.current_period_end
                      ? new Date(subscription.current_period_end * 1000).toISOString()
                      : null,
                    cancel_at_period_end: subscription.cancel_at_period_end || false,
                    updated_at: now,
                  })
                  .eq("user_id", userId);

                if (!updateError) {
                  console.log(`✅ [WEBHOOK] Subscription updated via user_id in created event`);
                  
                  // Se status for active, creditar tokens
                  if (
                    status === "active" &&
                    subscription.current_period_start &&
                    subscription.current_period_end
                  ) {
                    await creditTokensToUser(
                      userId,
                      subscription.id,
                      planId,
                      new Date(subscription.current_period_start * 1000),
                      new Date(subscription.current_period_end * 1000)
                    );
                  }
                } else {
                  console.log(`⚠️ [WEBHOOK] Error updating subscription:`, updateError);
                }
              } else {
                console.log(`⚠️ [WEBHOOK] Error creating subscription:`, error);
              }
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        subscription = event.data.object as stripe.Stripe.Subscription;
        const stripeStatus = subscription.status;
        console.log(
          `✅ [WEBHOOK] Subscription updated. Status: ${stripeStatus}`
        );
        console.log(`📊 [STATUS] Subscription ID: ${subscription.id}`);
        console.log(`📊 [STATUS] Stripe status received: ${stripeStatus}`);

        status = mapStripeStatusToEnum(stripeStatus);
        console.log(`📊 [STATUS] Mapped status for database: ${status || 'NULL'}`);
        
        if (!status) {
          console.log(
            `⚠️ [WEBHOOK] Invalid subscription status: ${stripeStatus}`
          );
          break;
        }

        // Get user_id from customer metadata or database
        const userId = await getUserIdFromSubscription(subscription);

        if (!userId) {
          console.log(
            `⚠️ [WEBHOOK] Could not find user_id for subscription ${subscription.id}`
          );
          break;
        }

        console.log(`👤 [USER] Found user_id: ${userId}`);

        // Resolver plan_id via stripe_price_id (pode ter mudado)
        const stripePriceId = subscription.items.data[0]?.price.id;
        let planId: string | null = null;
        if (stripePriceId) {
          planId = await resolvePlanIdFromPriceId(stripePriceId);
        }

        if (!planId) {
          console.log(
            `⚠️ [WEBHOOK] Could not resolve plan_id for subscription ${subscription.id}`
          );
          break;
        }

        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        // Buscar subscription atual para verificar status anterior
        // Buscar por stripe_subscription_id primeiro, depois por user_id como fallback
        const { data: currentSubBySubId } = await supabaseClient
          .from("subscriptions")
          .select("status, plan_id, user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        // Se não encontrou por subscription_id, buscar por user_id (pode ter sido criada pelo created event)
        let currentSub = currentSubBySubId;
        if (!currentSub) {
          const { data: currentSubByUserId } = await supabaseClient
            .from("subscriptions")
            .select("status, plan_id, user_id, stripe_subscription_id")
            .eq("user_id", userId)
            .single();
          
          if (currentSubByUserId) {
            console.log(`🔄 [WEBHOOK] Found subscription by user_id, will update stripe_subscription_id`);
            currentSub = currentSubByUserId;
          }
        }

        const previousStatus = currentSub?.status as SubscriptionStatus | null;
        console.log(`📊 [STATUS] Previous status in DB: ${previousStatus || 'NULL'}`);
        console.log(`📊 [STATUS] New status: ${status}`);
        
        const isFirstActivation =
          (previousStatus === "incomplete" ||
            previousStatus === "trialing") &&
          status === "active";
        
        if (isFirstActivation) {
          console.log(`🔄 [ACTIVATION] Status changing from ${previousStatus} to ${status} - will credit tokens`);
        }

        // Se não encontrou subscription, criar uma nova (pode ter chegado antes do checkout.session.completed)
        if (!currentSub) {
          console.log(`⚠️ [WEBHOOK] Subscription not found in DB, creating new one from updated event`);
          
          const { error: insertError } = await supabaseClient
            .from("subscriptions")
            .insert({
              user_id: userId,
              plan_id: planId,
              status: status,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              stripe_price_id: stripePriceId,
              current_period_start: subscription.current_period_start
                ? new Date(
                    subscription.current_period_start * 1000
                  ).toISOString()
                : null,
              current_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (!insertError) {
            console.log(`✅ [WEBHOOK] Subscription created from updated event`);
            
            // Se status for active, creditar tokens
            if (
              status === "active" &&
              subscription.current_period_start &&
              subscription.current_period_end
            ) {
              await creditTokensToUser(
                userId,
                subscription.id,
                planId,
                new Date(subscription.current_period_start * 1000),
                new Date(subscription.current_period_end * 1000)
              );
            }
          } else {
            // Se deu erro de constraint unique (user_id), fazer update
            if (insertError.code === '23505') {
              console.log(`🔄 [WEBHOOK] User already has subscription, updating instead`);
              const { error: updateError } = await supabaseClient
                .from("subscriptions")
                .update({
                  plan_id: planId,
                  status: status,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscription.id,
                  stripe_price_id: stripePriceId,
                  current_period_start: subscription.current_period_start
                    ? new Date(
                        subscription.current_period_start * 1000
                      ).toISOString()
                    : null,
                  current_period_end: subscription.current_period_end
                    ? new Date(subscription.current_period_end * 1000).toISOString()
                    : null,
                  cancel_at_period_end: subscription.cancel_at_period_end || false,
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId);

              if (!updateError) {
                console.log(`✅ [WEBHOOK] Subscription updated via user_id`);
              } else {
                console.log(`⚠️ [WEBHOOK] Error updating subscription:`, updateError);
              }
            } else {
              console.log(`⚠️ [WEBHOOK] Error creating subscription:`, insertError);
            }
          }
          break;
        }

        // Update subscription status (já existe)
        const { error } = await supabaseClient
          .from("subscriptions")
          .update({
            status: status,
            plan_id: planId, // Update plan_id in case of change
            stripe_price_id: stripePriceId,
            current_period_start: subscription.current_period_start
              ? new Date(
                  subscription.current_period_start * 1000
                ).toISOString()
              : null,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
            cancel_at_period_end: subscription.cancel_at_period_end || false,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (!error) {
          console.log(
            `✅ [WEBHOOK] Subscription status updated to: ${status}`
          );
          if (planId && currentSub?.plan_id !== planId) {
            console.log(`🔄 [WEBHOOK] Plan changed from ${currentSub?.plan_id} to ${planId}`);
          }

          // Se mudou para active e era incomplete/trialing, creditar tokens (primeira ativação)
          if (
            isFirstActivation &&
            subscription.current_period_start &&
            subscription.current_period_end
          ) {
            const { data: subData } = await supabaseClient
              .from("subscriptions")
              .select("plan_id")
              .eq("stripe_subscription_id", subscription.id)
              .single();

            if (subData?.plan_id) {
              await creditTokensToUser(
                userId,
                subscription.id,
                subData.plan_id,
                new Date(subscription.current_period_start * 1000),
                new Date(subscription.current_period_end * 1000)
              );
            }
          }
        } else {
          console.log(`⚠️ [WEBHOOK] Error updating subscription:`, error);
        }
        break;
      }

      case "customer.subscription.deleted": {
        subscription = event.data.object as stripe.Stripe.Subscription;
        console.log(`✅ [WEBHOOK] Subscription deleted`);

        // Get user_id from customer metadata or database
        const userId = await getUserIdFromSubscription(subscription);

        if (!userId) {
          console.log(
            `⚠️ [WEBHOOK] Could not find user_id for subscription ${subscription.id}`
          );
          break;
        }

        // Update subscription status to canceled
        const { error } = await supabaseClient
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (!error) {
          console.log(`✅ [WEBHOOK] Subscription canceled successfully`);
        } else {
          console.log(`⚠️ [WEBHOOK] Error canceling subscription:`, error);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as stripe.Stripe.Invoice;
        console.log(`✅ [WEBHOOK] Invoice paid: ${invoice.id}`);

        if (!invoice.subscription) {
          console.log(
            `⚠️ [WEBHOOK] Invoice ${invoice.id} is not associated with a subscription`
          );
          break;
        }

        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;

        // Buscar subscription do banco
        const { data: subData } = await supabaseClient
          .from("subscriptions")
          .select("id, user_id, plan_id, status, stripe_subscription_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (!subData) {
          console.log(
            `⚠️ [WEBHOOK] Subscription ${subscriptionId} not found in database`
          );
          break;
        }

        // Buscar subscription completa do Stripe para obter períodos e status
        const fullSubscription =
          await stripeClient.subscriptions.retrieve(subscriptionId);

        const subscriptionStatus = mapStripeStatusToEnum(fullSubscription.status);
        console.log(`📊 [STATUS] Invoice paid - Subscription status from Stripe: ${fullSubscription.status} -> ${subscriptionStatus}`);

        if (
          fullSubscription.current_period_start &&
          fullSubscription.current_period_end
        ) {
          const periodStart = new Date(
            fullSubscription.current_period_start * 1000
          );
          const periodEnd = new Date(
            fullSubscription.current_period_end * 1000
          );

          // Verificar se já creditou tokens para este período
          const alreadyCredited = await hasTokensBeenCreditedForPeriod(
            subscriptionId,
            periodStart
          );

          if (!alreadyCredited && subData.plan_id) {
            // Creditar tokens
            await creditTokensToUser(
              subData.user_id,
              subscriptionId,
              subData.plan_id,
              periodStart,
              periodEnd
            );
          }

          // Atualizar períodos e status da subscription
          const updateData: {
            current_period_start: string;
            current_period_end: string;
            updated_at: string;
            status?: SubscriptionStatus;
          } = {
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Se o status mudou para active, atualizar também
          if (subscriptionStatus && subscriptionStatus !== subData.status) {
            updateData.status = subscriptionStatus;
            console.log(`🔄 [STATUS] Updating subscription status to: ${subscriptionStatus}`);
          }

          await supabaseClient
            .from("subscriptions")
            .update(updateData)
            .eq("stripe_subscription_id", subscriptionId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as stripe.Stripe.Invoice;
        console.log(`⚠️ [WEBHOOK] Invoice payment failed: ${invoice.id}`);

        if (!invoice.subscription) {
          console.log(
            `⚠️ [WEBHOOK] Invoice ${invoice.id} is not associated with a subscription`
          );
          break;
        }

        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;

        // Buscar subscription do banco
        const { data: subData } = await supabaseClient
          .from("subscriptions")
          .select("status")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (!subData) {
          console.log(
            `⚠️ [WEBHOOK] Subscription ${subscriptionId} not found in database`
          );
          break;
        }

        // Atualizar status para past_due se ainda não estiver cancelada
        if (subData.status !== "canceled") {
          const { error } = await supabaseClient
            .from("subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);

          if (!error) {
            console.log(
              `✅ [WEBHOOK] Subscription status updated to past_due`
            );
          } else {
            console.log(
              `⚠️ [WEBHOOK] Error updating subscription status:`,
              error
            );
          }
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        subscription = event.data.object as stripe.Stripe.Subscription;
        console.log(
          `⚠️ [WEBHOOK] Subscription trial will end. Status: ${subscription.status}`
        );
        // Você pode implementar lógica para notificar o usuário que o trial vai acabar
        break;
      }

      default:
        console.log(`⚠️ [WEBHOOK] Unhandled event type: ${event.type}`);
    }

    // Salvar evento processado
    try {
      await saveProcessedEvent(event, JSON.parse(body));
    } catch (saveError) {
      console.log(
        `⚠️ [WEBHOOK] Error saving processed event:`,
        saveError
      );
      // Não falhar o webhook se não conseguir salvar o evento
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Webhook handler failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
