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

    // Verify webhook signature
    let event: stripe.Stripe.Event;
    try {
      event = stripeClient.webhooks.constructEvent(
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

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as stripe.Stripe.Checkout.Session;
        
        if (session.mode === "subscription") {
          const subscriptionId = session.subscription as string;
          const userId = session.metadata?.supabase_user_id;
          const planId = session.metadata?.plan_id;
          const currency = session.metadata?.currency || "usd";

          if (userId) {
            // Update user subscription in Supabase
            // Note: You may need to create the user_subscriptions table first
            const { error } = await supabaseClient
              .from("user_subscriptions")
              .upsert({
                user_id: userId,
                stripe_subscription_id: subscriptionId,
                stripe_customer_id: session.customer as string,
                plan_id: planId,
                currency: currency,
                status: "active",
                updated_at: new Date().toISOString(),
              }, {
                onConflict: "user_id",
              });

            if (error) {
              console.error("Error updating subscription in Supabase:", error);
              // Don't fail the webhook, just log the error
            } else {
              console.log(`Subscription created for user ${userId}, plan: ${planId}`);
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as stripe.Stripe.Subscription;
        
        // Find user by customer ID
        const { data: subscriptionData, error: findError } = await supabaseClient
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", subscription.customer as string)
          .single();

        if (subscriptionData && !findError) {
          const { error } = await supabaseClient
            .from("user_subscriptions")
            .update({
              status: subscription.status,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", subscriptionData.user_id);

          if (error) {
            console.error("Error updating subscription status:", error);
          } else {
            console.log(`Subscription updated for user ${subscriptionData.user_id}, status: ${subscription.status}`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as stripe.Stripe.Subscription;
        
        // Find user by customer ID
        const { data: subscriptionData, error: findError } = await supabaseClient
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", subscription.customer as string)
          .single();

        if (subscriptionData && !findError) {
          const { error } = await supabaseClient
            .from("user_subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", subscriptionData.user_id);

          if (error) {
            console.error("Error canceling subscription:", error);
          } else {
            console.log(`Subscription canceled for user ${subscriptionData.user_id}`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
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
    const errorMessage = error instanceof Error ? error.message : "Webhook handler failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

