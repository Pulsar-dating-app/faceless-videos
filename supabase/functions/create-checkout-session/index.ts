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
  planName?: string; // Translated plan name for Stripe Checkout
  locale?: string; // Stripe Checkout locale (pt, en, es, fr, de, etc.)
}

// Get Stripe Price ID from database table (USD only)
// Falls back to environment variables if table doesn't exist
async function getPriceId(
  supabaseClient: ReturnType<typeof createClient>,
  planId: string
): Promise<string> {
  const normalizedPlanId = planId.toLowerCase();
  
  try {
    // Try to get USD price from database table first
    console.log(`🔵 [DEBUG] Querying database for plan: ${normalizedPlanId}, currency: usd`);
    const { data: priceData, error } = await supabaseClient
      .from("stripe_prices")
      .select("stripe_price_id, currency, active")
      .eq("plan_id", normalizedPlanId)
      .eq("currency", "usd")
      .eq("active", true)
      .single();

    if (error) {
      console.log(`⚠️ [WARN] Database query error:`, error.message);
    } else if (priceData?.stripe_price_id) {
      console.log(`✅ [SUCCESS] Found price ID in database: ${priceData.stripe_price_id} (currency: ${priceData.currency}, active: ${priceData.active})`);
      return priceData.stripe_price_id;
    } else {
      console.log(`⚠️ [WARN] No USD price found in database for plan: ${normalizedPlanId}`);
    }
  } catch (dbError) {
    console.log("⚠️ [WARN] Database query failed, falling back to env vars:", dbError);
  }

  // Fallback to environment variables (for backward compatibility)
  const envKey = `STRIPE_PRICE_ID_${planId.toUpperCase()}`;
  const envPrice = Deno.env.get(envKey);
  if (envPrice) {
    console.log(`⚠️ [WARN] Using price ID from env var ${envKey}: ${envPrice}`);
    console.log(`⚠️ [WARN] WARNING: Env vars may contain old BRL prices. Please use database table instead.`);
    return envPrice;
  }

  console.log(`❌ [ERROR] No price ID found in database or env vars for plan: ${normalizedPlanId}`);
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
    const { planId, planName, locale }: RequestBody = await req.json();
    console.log("🔵 [DEBUG] Request body - planId:", planId);
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

    // Get Stripe price ID for the plan (USD only)
    console.log("🔵 [DEBUG] Looking for USD price ID for plan:", planId);
    const priceId = await getPriceId(supabaseClient, planId);
    console.log("🔵 [DEBUG] Price ID found:", priceId || "❌ Not found");
    
    if (!priceId) {
      console.log("❌ [ERROR] Price ID not configured for plan:", planId);
      return new Response(
        JSON.stringify({ 
          error: `Price ID not found for plan: ${planId}. Please configure in stripe_prices table or environment variables.` 
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

    // Validate price ID - check if it's USD and active
    console.log("🔵 [DEBUG] Validating price ID in Stripe...");
    try {
      const price = await stripeClient.prices.retrieve(priceId);
      console.log("🔵 [DEBUG] Price details from Stripe:", {
        id: price.id,
        currency: price.currency,
        amount: price.unit_amount,
        active: price.active,
      });
      
      if (price.currency !== "usd") {
        console.log(`❌ [ERROR] Price ID ${priceId} is in ${price.currency.toUpperCase()}, expected USD!`);
        return new Response(
          JSON.stringify({ 
            error: `Invalid price configuration: Price ${priceId} is in ${price.currency.toUpperCase()}, but only USD is supported. Please check your stripe_prices table or environment variables.` 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }
      
      if (!price.active) {
        console.log(`❌ [ERROR] Price ID ${priceId} is archived/inactive in Stripe!`);
        return new Response(
          JSON.stringify({ 
            error: `Price ${priceId} is archived in Stripe. Please use an active price.` 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }
      
      console.log("✅ [SUCCESS] Price ID validated: USD and active");
    } catch (priceError) {
      console.log("❌ [ERROR] Could not validate price in Stripe:", priceError);
      return new Response(
        JSON.stringify({ 
          error: `Invalid price ID: ${priceId}. Please check your configuration.` 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

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
      .select("stripe_subscription_id, status, plan_id")
      .eq("user_id", user.id)
      .single();

    const finalLocale = locale || "auto";

    // Se já tem subscription ativa, bloquear criação de nova
    if (existingSubscription?.stripe_subscription_id && 
        existingSubscription.status !== "canceled" &&
        existingSubscription.status !== "unpaid" &&
        existingSubscription.status !== "incomplete_expired") {
      
      console.log("⚠️ [BLOCKED] User already has an active subscription");
      return new Response(
        JSON.stringify({ 
          error: "You already have an active subscription. Please use the billing portal to manage or change your plan.",
          has_subscription: true,
          current_plan: existingSubscription.plan_id,
          subscription_id: existingSubscription.stripe_subscription_id
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
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
    
    console.log("📋 [METADATA] Session will have plan_id:", planId);

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

