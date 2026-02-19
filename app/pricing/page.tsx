"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

interface PriceData {
  plan_id: string;
  currency: string;
  amount: number;
}

/** Headers with user JWT for Edge Functions (required when deploying without --no-verify-jwt) */
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export default function PricingPage() {
  const { t, formatMessage, language } = useI18n();
  const { session, isLoading: authLoading } = useAuth();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({
    starter: 1,
    daily: 1,
    elite: 1,
  });

  // When user has active subscription, only their plan's button is enabled ("Gerenciar Séries")
  const [activeSubscription, setActiveSubscription] = useState<{ plan_id: string } | null>(null);

  const QUANTITY_OPTIONS = [1, 2, 3, 5, 10];

  // === PROMOTION CONFIG - Edit these values ===
  const PROMO_END_DATE = new Date("2026-03-31T23:59:59");
  
  // Professional plan promo
  const DAILY_ORIGINAL_PRICE = 49.99;
  const DAILY_DISCOUNT_PERCENT = 50;
  
  // Elite plan promo
  const ELITE_ORIGINAL_PRICE = 89.99;
  const ELITE_DISCOUNT_PERCENT = 50;
  // ============================================

  // Countdown state
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => {
      const diff = PROMO_END_DATE.getTime() - Date.now();
      if (diff > 0) {
        setCountdown({
          d: Math.floor(diff / 86400000),
          h: Math.floor((diff % 86400000) / 3600000),
          m: Math.floor((diff % 3600000) / 60000),
          s: Math.floor((diff % 60000) / 1000),
        });
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch prices from database
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const { data, error } = await supabase
          .from("stripe_prices")
          .select("plan_id, currency, amount")
          .eq("active", true);

        if (error) {
          console.error("Error fetching prices:", error);
          return;
        }

        // Create a map: "plan_id" -> price data (USD only)
        const priceMap: Record<string, PriceData> = {};
        data?.forEach((price) => {
          if (price.currency === 'usd') {
            priceMap[price.plan_id] = price;
          }
        });
        console.log("✅ [PRICES] Loaded USD prices from database:", Object.keys(priceMap));
        setPrices(priceMap);
      } catch (error) {
        console.error("Error loading prices:", error);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchPrices();
  }, []);

  // Fetch active subscription when user is logged in (to show "Gerenciar Séries" on current plan only)
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!session?.user?.id) {
        setActiveSubscription(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("plan_id, status")
          .eq("user_id", session.user.id)
          .single();

        if (!error && data && data.status !== "canceled" && data.status !== "unpaid") {
          setActiveSubscription({ plan_id: data.plan_id });
        } else {
          setActiveSubscription(null);
        }
      } catch {
        setActiveSubscription(null);
      }
    };

    fetchSubscription();
  }, [session?.user?.id]);

  // Get price for a plan (USD only). Prices come from Supabase table "stripe_prices" (plan_id, currency, amount).
  const getPrice = (planId: string): number | null => {
    if (prices[planId]) return prices[planId].amount;
    console.log(`❌ [PRICE] No USD price found for ${planId}`);
    return null;
  };

  // Format price (USD only) - always 2 decimals
  const formatPrice = (amount: number | null): string => {
    if (amount === null) return "—";
    return `$${Number(amount).toFixed(2)}`;
  };

  // Pricing data structure with translations
  const pricingPlans = [
    {
      id: "starter",
      name: t.pricing.starter.name,
      price: getPrice("starter"),
      description: t.pricing.starter.description,
      videosPerSeries: t.pricing.starter.videosPerSeries,
      features: [
        t.pricing.starter.feature2,
        t.pricing.starter.feature3,
        t.pricing.starter.feature4,
      ],
      popular: false,
      promo: false,
    },
    {
      id: "daily",
      name: t.pricing.daily.name,
      price: getPrice("daily"),
      description: t.pricing.daily.description,
      videosPerSeries: t.pricing.daily.videosPerSeries,
      features: [
        t.pricing.daily.feature2,
        t.pricing.daily.feature3,
        t.pricing.daily.feature4,
      ],
      popular: true,
      promo: true,
    },
    {
      id: "elite",
      name: t.pricing.elite.name,
      price: getPrice("elite"),
      description: t.pricing.elite.description,
      videosPerSeries: t.pricing.elite.videosPerSeries,
      features: [
        t.pricing.elite.feature2,
        t.pricing.elite.feature3,
        t.pricing.elite.feature4,
      ],
      popular: false,
      promo: true,
    },
  ];

  const handleCheckout = async (planId: string) => {
    if (!session) {
      window.location.href = "/login";
      return;
    }

    const selectedQuantity = selectedQuantities[planId] || 1;
    setLoadingPlanId(planId);

    try {
      // If user already has an active subscription, send them to manage it
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", session.user.id)
        .single();

      if (subData && subData.status !== "canceled" && subData.status !== "unpaid") {
        window.location.href = "/dashboard?section=subscription";
        return;
      }

      // Headers with user JWT
      const headers = await getAuthHeaders();

      // Get Supabase project URL from environment
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
      }

      // Create checkout session
      const functionUrl = `${supabaseUrl}/functions/v1/create-checkout-session`;

      // Get plan data for translated name
      const selectedPlan = pricingPlans.find(p => p.id === planId);

      // Map app language to Stripe locale for UI translation
      // Only map languages available in the Navbar: en, es, fr, de, pt
      const stripeLocale = language === "pt" ? "pt" : 
                          language === "es" ? "es" : 
                          language === "fr" ? "fr" : 
                          language === "de" ? "de" : 
                          language === "en" ? "en" : 
                          "auto"; // Stripe will auto-detect if language not supported

      console.log("🟢 [CHECKOUT] Starting checkout with:", {
        planId,
        quantity: selectedQuantity,
        planName: selectedPlan?.name,
        stripeLocale,
        language,
      });

      // Call Edge Function to create checkout session (headers include user JWT)
      const response = await fetch(
        functionUrl,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ 
            planId,
            quantity: selectedQuantity,
            planName: selectedPlan?.name, // Translated plan name
            locale: stripeLocale, // Stripe Checkout locale for UI translation
          }),
        }
      );

      console.log("🔵 [DEBUG] Response status:", response.status);
      console.log("🔵 [DEBUG] Response ok:", response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create checkout session");
      }

      const { url } = await response.json();

      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Not authenticated") {
        window.location.href = "/login";
        return;
      }
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
      setLoadingPlanId(null);
    }
  };
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-20">
        <div className="max-w-6xl w-full space-y-12">
          {/* Header Section */}
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                {t.pricing.headerTitle}
              </h1>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                {t.pricing.headerSubtitle}
              </p>
            </div>
            
            {/* Explanation Card */}
            <div className="max-w-3xl mx-auto bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <div className="bg-blue-600 text-white rounded-full p-2 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                    {t.pricing.whatIsSeriesTitle}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t.pricing.whatIsSeriesDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {pricingPlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border overflow-hidden ${
                  plan.popular
                    ? "border-blue-500 dark:border-blue-500 shadow-2xl scale-105"
                    : "border-zinc-200 dark:border-zinc-800 shadow-xl"
                } bg-white dark:bg-zinc-900 transition-all hover:shadow-2xl`}
              >
                {/* Promo Banner */}
                {plan.promo ? (
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 px-4 text-center text-sm font-semibold flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {plan.id === "daily" ? DAILY_DISCOUNT_PERCENT : ELITE_DISCOUNT_PERCENT}% {t.pricing.off} – {t.pricing.limitedTime}
                    </span>
                  </div>
                ) : (
                  /* Spacer for non-promo cards to align */
                  plan.popular ? null : <div className="h-0" />
                )}

                {/* Popular Badge - only if not promo */}
                {plan.popular && !plan.promo && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-blue-600 text-white text-xs font-semibold px-4 py-1 rounded-full">
                      {t.pricing.mostPopular}
                    </span>
                  </div>
                )}

                <div className="p-8 flex flex-col flex-1">
                  {/* Plan Header */}
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                      {plan.description}
                    </p>

                    {/* Price Display */}
                    {isLoadingPrices ? (
                      <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto" />
                    ) : plan.promo ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xl text-zinc-400 line-through">
                            {formatPrice((plan.id === "daily" ? DAILY_ORIGINAL_PRICE : ELITE_ORIGINAL_PRICE) * selectedQuantities[plan.id])}
                          </span>
                          <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                            -{plan.id === "daily" ? DAILY_DISCOUNT_PERCENT : ELITE_DISCOUNT_PERCENT}%
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">
                              {formatPrice(plan.price ? plan.price * selectedQuantities[plan.id] : null)}
                            </span>
                            <span className="text-zinc-500 dark:text-zinc-400">{t.pricing.perMonth}</span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {formatPrice(plan.price)} × {selectedQuantities[plan.id]}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-extrabold">
                            {formatPrice(plan.price ? plan.price * selectedQuantities[plan.id] : null)}
                          </span>
                          <span className="text-zinc-500 dark:text-zinc-400">{t.pricing.perMonth}</span>
                        </div>
                        {selectedQuantities[plan.id] > 1 && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {formatPrice(plan.price)} × {selectedQuantities[plan.id]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Features List */}
                  <ul className="flex-1 space-y-4 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Quantity Selector */}
                  <div className="mb-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-3 text-center">
                      {t.pricing.quantityLabel}
                    </label>
                    <div className="flex justify-center gap-2 mb-3">
                      {QUANTITY_OPTIONS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setSelectedQuantities({ ...selectedQuantities, [plan.id]: q })}
                          className={`min-w-[3rem] py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${
                            selectedQuantities[plan.id] === q
                              ? "bg-blue-600 text-white shadow-lg scale-105"
                              : "bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600 border border-zinc-200 dark:border-zinc-600"
                          }`}
                        >
                          {q}×
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CTA Button */}
                  {activeSubscription && plan.id === activeSubscription.plan_id ? (
                    <button
                      type="button"
                      onClick={() => { window.location.href = "/dashboard?section=subscription"; }}
                      className="w-full h-14 rounded-lg font-semibold text-base transition-all flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-xl hover:shadow-2xl"
                    >
                      {t.pricing.manageSeries}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={authLoading || !!activeSubscription || loadingPlanId === plan.id}
                      className={`w-full h-14 rounded-lg font-semibold text-base transition-all flex items-center justify-center gap-2 ${
                        plan.popular
                          ? "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 shadow-xl hover:shadow-2xl"
                          : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
                      }`}
                    >
                      {loadingPlanId === plan.id ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>{t.pricing.processing}</span>
                        </>
                      ) : plan.promo ? (
                        <>{t.pricing.claimOffer}</>
                      ) : (
                        <>{t.pricing.getStarted}</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}