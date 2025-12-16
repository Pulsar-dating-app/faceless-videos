// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Access API Keys from environment variables
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  planId: string;
  currency?: string; // Optional: "usd", "eur", "brl", etc. Default: "usd"
  planName?: string; // Translated plan name for Stripe Checkout
  locale?: string; // Stripe Checkout locale (pt, en, es, fr, de, etc.)
}

// Get Stripe Price ID from database table
// Falls back to environment variables if table doesn't exist
async function getPriceId(
  supabaseClient: ReturnType<typeof createClient>,
  planId: string,
  currency: string = "usd"
): Promise<string> {
  const normalizedCurrency = currency.toLowerCase();
  const normalizedPlanId = planId.toLowerCase();
  
  try {
    // Try to get from database table first
    const { data: priceData, error } = await supabaseClient
      .from("stripe_prices")
      .select("stripe_price_id")
      .eq("plan_id", normalizedPlanId)
      .eq("currency", normalizedCurrency)
      .eq("active", true)
      .single();

    if (!error && priceData?.stripe_price_id) {
      console.log(`✅ [SUCCESS] Found price ID in database: ${priceData.stripe_price_id}`);
      return priceData.stripe_price_id;
    }

    // If not found in database, try USD as fallback
    if (normalizedCurrency !== "usd") {
      const { data: usdPriceData } = await supabaseClient
        .from("stripe_prices")
        .select("stripe_price_id")
        .eq("plan_id", normalizedPlanId)
        .eq("currency", "usd")
        .eq("active", true)
        .single();

      if (usdPriceData?.stripe_price_id) {
        console.log(`✅ [SUCCESS] Found USD fallback in database: ${usdPriceData.stripe_price_id}`);
        return usdPriceData.stripe_price_id;
      }
    }
  } catch (dbError) {
    console.log("⚠️ [WARN] Database query failed, falling back to env vars:", dbError);
  }

  // Fallback to environment variables (for backward compatibility)
  const envKey = `STRIPE_PRICE_ID_${planId.toUpperCase()}_${currency.toUpperCase()}`;
  const currencyPrice = Deno.env.get(envKey);
  if (currencyPrice) {
    console.log(`✅ [SUCCESS] Found price ID in env: ${envKey}`);
    return currencyPrice;
  }

  // Try default USD env var
  if (normalizedCurrency !== "usd") {
    const defaultEnvKey = `STRIPE_PRICE_ID_${planId.toUpperCase()}`;
    const defaultPrice = Deno.env.get(defaultEnvKey);
    if (defaultPrice) {
      console.log(`✅ [SUCCESS] Found USD fallback in env: ${defaultEnvKey}`);
      return defaultPrice;
    }
  }

  // Legacy support
  const legacyEnvKey = `STRIPE_PRICE_ID_${planId.toUpperCase()}`;
  const legacyPrice = Deno.env.get(legacyEnvKey);
  if (legacyPrice) {
    console.log(`✅ [SUCCESS] Found legacy price ID in env: ${legacyEnvKey}`);
    return legacyPrice;
  }

  return "";
}

Deno.serve(async (req: Request) => {
  console.log("🔵 [DEBUG] Request received:", req.method, req.url);
  
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    console.log("🔵 [DEBUG] Validating environment variables...");
    console.log("🔵 [DEBUG] STRIPE_SECRET_KEY:", STRIPE_SECRET_KEY ? "✅ Set" : "❌ Missing");
    console.log("🔵 [DEBUG] SUPABASE_URL:", SUPABASE_URL || "❌ Missing");
    console.log("🔵 [DEBUG] SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing");
    
    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase environment variables are not set");
    }

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("🔵 [DEBUG] Authorization header:", authHeader ? "✅ Present" : "❌ Missing");
    
    if (!authHeader) {
      console.log("❌ [ERROR] Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Create Supabase client to validate token
    console.log("🔵 [DEBUG] Creating Supabase client...");
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Validate token and get user
    console.log("🔵 [DEBUG] Validating user token...");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.log("❌ [ERROR] Authentication failed:", authError?.message || "No user");
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }
    
    console.log("✅ [SUCCESS] User authenticated:", user.email);

    // Get request body
    const { planId, currency = "usd", planName, locale }: RequestBody = await req.json();
    console.log("🔵 [DEBUG] Request body - planId:", planId, "currency:", currency);
    console.log("🔵 [DEBUG] Plan name (translated):", planName);
    console.log("🔵 [DEBUG] Stripe Checkout locale:", locale);

    if (!planId) {
      console.log("❌ [ERROR] planId is missing");
      return new Response(
        JSON.stringify({ error: "planId is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Get Stripe price ID for the plan and currency
    console.log("🔵 [DEBUG] Looking for price ID...");
    const priceId = await getPriceId(supabaseClient, planId, currency);
    console.log("🔵 [DEBUG] Price ID found:", priceId || "❌ Not found");
    
    if (!priceId) {
      console.log("❌ [ERROR] Price ID not configured for plan:", planId, "currency:", currency);
      return new Response(
        JSON.stringify({ 
          error: `Price ID not found for plan: ${planId}, currency: ${currency}. Please configure in stripe_prices table or environment variables.` 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Initialize Stripe
    console.log("🔵 [DEBUG] Initializing Stripe...");
    const stripe = await import("https://esm.sh/stripe@17.3.1?target=deno");
    const stripeClient = new stripe.Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
      httpClient: stripe.Stripe.createFetchHttpClient(),
    });

    // Create or get Stripe customer
    // First, try to find existing customer by email
    console.log("🔵 [DEBUG] Looking for existing customer:", user.email);
    const customers = await stripeClient.customers.list({
      email: user.email,
      limit: 1,
    });

    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      const existingCustomer = customers.data[0];
      const existingUserId = existingCustomer.metadata?.supabase_user_id;
      
      console.log("✅ [SUCCESS] Found existing customer");
      
      // Atualizar metadata do customer se necessário (garantir que tem o user_id correto)
      if (existingUserId !== user.id) {
        console.log("⚠️ [UPDATE] Customer metadata mismatch! Updating...");
        
        try {
          await stripeClient.customers.update(customerId, {
            metadata: {
              supabase_user_id: user.id,
            },
          });
          console.log("✅ [SUCCESS] Customer metadata updated");
        } catch (updateError) {
          console.log("⚠️ [ERROR] Failed to update customer metadata:", updateError);
          // Continuar mesmo se a atualização falhar
        }
      } else {
        console.log("✅ [SKIP] Customer metadata already correct");
      }
    } else {
      // Create new customer
      console.log("🔵 [DEBUG] Creating new customer...");
      const customer = await stripeClient.customers.create({
        email: user.email || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;
      console.log("✅ [SUCCESS] Created new customer");
    }

    // Verificar se usuário já tem subscription ativa
    const { data: existingSubscription } = await supabaseClient
      .from("subscriptions")
      .select("stripe_subscription_id, status, plan_id, stripe_price_id")
      .eq("user_id", user.id)
      .single();

    const finalLocale = locale || "auto";

    // Se já tem subscription ativa, atualizar e criar Checkout para pagar diferença
    if (existingSubscription?.stripe_subscription_id && 
        existingSubscription.status !== "canceled" &&
        existingSubscription.status !== "unpaid") {
      
      console.log("🔄 [UPGRADE] User has active subscription, checking for plan change");
      
      try {
        // Buscar subscription atual do Stripe
        const currentSubscription = await stripeClient.subscriptions.retrieve(
          existingSubscription.stripe_subscription_id
        );

        // Verificar se é realmente uma troca de plano
        const currentPriceId = currentSubscription.items.data[0]?.price.id;
        if (currentPriceId === priceId) {
          // Mesmo plano, não precisa fazer nada
          console.log("ℹ️ [INFO] User already has this plan");
          return new Response(
            JSON.stringify({ 
              message: "You already have this plan",
              subscription_id: existingSubscription.stripe_subscription_id,
              same_plan: true
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }

        console.log("🔄 [UPGRADE] Updating subscription from", existingSubscription.plan_id, "to", planId);

        // Atualizar subscription para novo plano
        const updatedSubscription = await stripeClient.subscriptions.update(
          existingSubscription.stripe_subscription_id,
          {
            items: [{
              id: currentSubscription.items.data[0].id,
              price: priceId, // Novo price ID
            }],
            proration_behavior: "always_invoice", // Criar invoice com proratação
            metadata: {
              supabase_user_id: user.id,
              plan_id: planId,
              currency: currency,
            },
          }
        );

        console.log("✅ [SUCCESS] Subscription updated, checking for invoice...");

        // Buscar invoices pendentes para esta subscription
        const invoices = await stripeClient.invoices.list({
          subscription: updatedSubscription.id,
          status: "open",
          limit: 1,
        });

        // Se há invoice aberta que precisa de pagamento, criar Checkout Session
        if (invoices.data.length > 0) {
          const invoice = invoices.data[0];
          console.log("💰 [INVOICE] Found open invoice, creating checkout session to collect payment");

          // Criar Checkout Session em modo "payment" para pagar a invoice
          const session = await stripeClient.checkout.sessions.create({
            customer: customerId,
            mode: "payment", // Modo payment para pagar invoice única
            locale: finalLocale,
            line_items: [
              {
                price: priceId,
                quantity: 1,
              },
            ],
            success_url: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${APP_URL}/checkout/cancel`,
            metadata: {
              supabase_user_id: user.id,
              plan_id: planId,
              currency: currency,
              subscription_update: "true",
              subscription_id: updatedSubscription.id,
              invoice_id: invoice.id,
            },
          });

          console.log("✅ [SUCCESS] Checkout session created for invoice payment:", session.id);

          return new Response(
            JSON.stringify({ 
              url: session.url,
              updated: true,
              payment_required: true,
              subscription_id: updatedSubscription.id
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } else {
          // Invoice foi paga automaticamente ou não há diferença a pagar
          console.log("✅ [SUCCESS] Subscription updated, no payment needed");
          return new Response(
            JSON.stringify({ 
              message: "Subscription updated successfully",
              subscription_id: updatedSubscription.id,
              updated: true,
              payment_required: false
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      } catch (updateError) {
        console.log("⚠️ [ERROR] Failed to update subscription:", updateError);
        return new Response(
          JSON.stringify({ 
            error: "Failed to update subscription. Please try again or contact support.",
            details: updateError instanceof Error ? updateError.message : "Unknown error"
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          }
        );
      }
    }

    // Se não tem subscription, criar nova Checkout Session normalmente
    console.log("🆕 [NEW] Creating new checkout session for new subscription");
    
    // Create checkout session
    console.log("🔵 [DEBUG] Creating checkout session...");
    console.log("🔵 [DEBUG] - Customer:", customerId);
    console.log("🔵 [DEBUG] - Price:", priceId);
    console.log("🔵 [DEBUG] - Plan:", planId);
    console.log("🔵 [DEBUG] - Plan Name (translated):", planName);
    
    console.log("🌍 [LOCALE] Stripe Checkout locale being sent:", finalLocale);
    console.log("🌍 [LOCALE] Original locale received:", locale || "undefined (using 'auto')");
    
    console.log("📋 [METADATA] Session will have plan_id:", planId, "currency:", currency);

    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      locale: finalLocale, // Stripe will auto-detect if not provided, or use specified locale
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/checkout/cancel`,
      metadata: {
        supabase_user_id: user.id,
        plan_id: planId,
        currency: currency,
      },
    });

    console.log("✅ [SUCCESS] Checkout session created:", session.id);
    console.log("✅ [SUCCESS] Checkout URL:", session.url);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: unknown) {
    console.error("Error in create-checkout-session:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

