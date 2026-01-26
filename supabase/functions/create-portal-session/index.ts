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
  locale?: string;
  currency?: string;
}

Deno.serve(async (req: Request) => {
  console.log("🔵 [DEBUG] Portal session request received:", req.method, req.url);
  
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase environment variables are not set");
    }

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
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

    // Get request body for locale/currency
    let locale = "auto";
    
    if (req.method === "POST") {
      try {
        const body: RequestBody = await req.json();
        locale = body.locale || "auto";
        console.log("🌍 [LOCALE] Received locale:", locale);
      } catch {
        // Ignore JSON parse errors, use defaults
      }
    }

    // Initialize Stripe
    const stripe = await import("https://esm.sh/stripe@17.3.1?target=deno");
    const stripeClient = new stripe.Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
      httpClient: stripe.Stripe.createFetchHttpClient(),
    });

    // Find customer by email
    console.log("🔵 [DEBUG] Looking for customer:", user.email);
    const customers = await stripeClient.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      console.log("❌ [ERROR] No Stripe customer found for user");
      return new Response(
        JSON.stringify({ 
          error: "No subscription found. Please subscribe to a plan first." 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    const customerId = customers.data[0].id;
    console.log("✅ [SUCCESS] Found customer");

    // Buscar ou criar configuração do portal que permite mudanças de plano
    console.log("🔵 [DEBUG] Looking for portal configuration...");
    let configurationId: string | undefined;
    
    try {
      // Listar todas as configurações do portal
      const configurations = await stripeClient.billingPortal.configurations.list({
        limit: 10,
      });

      // Procurar uma configuração que tenha subscription_update habilitado
      const configWithUpdate = configurations.data.find(
        (config) => config.features?.subscription_update?.enabled === true
      );

      if (configWithUpdate) {
        configurationId = configWithUpdate.id;
        console.log("✅ [SUCCESS] Found existing portal configuration with subscription updates:", configurationId);
      } else {
        // Se não encontrar, criar uma nova configuração
        console.log("🔧 [SETUP] No configuration found, creating new one...");
        const newConfig = await stripeClient.billingPortal.configurations.create({
          business_profile: {
            headline: "Manage your subscription",
          },
          features: {
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            subscription_cancel: { 
              enabled: true, 
              mode: "at_period_end",
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
        configurationId = newConfig.id;
        console.log("✅ [SUCCESS] Created new portal configuration:", configurationId);
      }
    } catch (configError) {
      console.log("⚠️ [WARN] Could not manage portal configuration, using default:", configError);
      // Continuar sem especificar configuração (usará a padrão)
    }

    // Create portal session with locale and configuration
    console.log("🔵 [DEBUG] Creating portal session...");
    console.log("🌍 [LOCALE] Using locale:", locale, "for portal UI translation");
    
    const portalSessionParams: any = {
      customer: customerId,
      return_url: `${APP_URL}/pricing`,
    };

    if (locale && locale !== "auto") {
      portalSessionParams.locale = locale;
    }

    if (configurationId) {
      portalSessionParams.configuration = configurationId;
    }
    
    const portalSession = await stripeClient.billingPortal.sessions.create(portalSessionParams);

    console.log("✅ [SUCCESS] Portal session created:", portalSession.id);
    console.log("✅ [SUCCESS] Portal URL:", portalSession.url);

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: unknown) {
    console.error("Error in create-portal-session:", error);
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

