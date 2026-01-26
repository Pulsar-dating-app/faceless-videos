// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Access API Keys from environment variables
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  console.log("🔧 [SETUP] Billing Portal configuration request received");
  
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    // Initialize Stripe
    const stripe = await import("https://esm.sh/stripe@17.3.1?target=deno");
    const stripeClient = new stripe.Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
      httpClient: stripe.Stripe.createFetchHttpClient(),
    });

    console.log("🔧 [SETUP] Creating Billing Portal configuration...");

    // Configurar o Billing Portal
    const configuration = await stripeClient.billingPortal.configurations.create({
      business_profile: {
        headline: "Gerenciar sua assinatura",
      },
      features: {
        invoice_history: {
          enabled: true,
        },
        payment_method_update: {
          enabled: true,
        },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end", // Cancelamento no final do período
          cancellation_reason: {
            enabled: true,
            options: [
              "too_expensive",
              "missing_features",
              "switched_service",
              "unused",
              "customer_service",
              "too_complex",
              "low_quality",
              "other",
            ],
          },
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"], // Permitir mudança de preço (plano)
          proration_behavior: "always_invoice", // Cobra/credita diferença IMEDIATAMENTE
          products: [], // Vazio = permitir todos os produtos
        },
      },
      default_return_url: `${APP_URL}/pricing`,
    });

    console.log("✅ [SETUP] Portal configured successfully!");
    console.log("📋 [SETUP] Configuration ID:", configuration.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        configuration_id: configuration.id,
        message: "Billing Portal configured successfully!",
        settings: {
          invoice_history: "enabled",
          payment_method_update: "enabled",
          subscription_cancel: "enabled (at period end)",
          subscription_update: "enabled",
          proration_behavior: "always_invoice (immediate)",
        },
        info: {
          note: "Portal will show ALL prices for each product",
          recommendation: "User can manually select the currency/price they want",
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: unknown) {
    console.error("❌ [SETUP] Error configuring portal:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

