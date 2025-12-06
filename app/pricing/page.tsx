"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Check, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

interface PriceData {
  plan_id: string;
  currency: string;
  amount: number;
}

export default function PricingPage() {
  const { t, formatMessage, language } = useI18n();
  const { session, isLoading: authLoading } = useAuth();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [currency, setCurrency] = useState<string>("usd");
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);

  // Detect currency from browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      const detectedCurrency = new Intl.NumberFormat().resolvedOptions().currency?.toLowerCase() || "usd";
      setCurrency(detectedCurrency);
    }
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

        // Create a map: "plan_id_currency" -> price data
        const priceMap: Record<string, PriceData> = {};
        data?.forEach((price) => {
          const key = `${price.plan_id}_${price.currency}`;
          priceMap[key] = price;
        });
        setPrices(priceMap);
      } catch (error) {
        console.error("Error loading prices:", error);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchPrices();
  }, []);

  // Get price for a plan and currency
  const getPrice = (planId: string, currencyCode: string): number | null => {
    // Try specific currency first
    const key = `${planId}_${currencyCode}`;
    if (prices[key]) {
      return prices[key].amount;
    }
    // Fallback to USD
    const usdKey = `${planId}_usd`;
    if (prices[usdKey]) {
      return prices[usdKey].amount;
    }
    return null;
  };

  // Format price based on currency
  const formatPrice = (amount: number | null, currencyCode: string): string => {
    if (amount === null) return "—";
    
    const currencySymbols: Record<string, string> = {
      usd: "$",
      brl: "R$",
      eur: "€",
      gbp: "£",
    };

    const symbol = currencySymbols[currencyCode.toLowerCase()] || "$";
    return `${symbol}${amount.toFixed(2)}`;
  };

  // Pricing data structure with translations
  const pricingPlans = [
    {
      id: "starter",
      name: t.pricing.starter.name,
      price: getPrice("starter", currency),
      description: t.pricing.starter.description,
      features: [
        t.pricing.starter.feature1,
        t.pricing.starter.feature2,
        t.pricing.starter.feature3,
        t.pricing.starter.feature4,
      ],
      popular: false,
    },
    {
      id: "professional",
      name: t.pricing.professional.name,
      price: getPrice("professional", currency),
      description: t.pricing.professional.description,
      features: [
        t.pricing.professional.feature1,
        t.pricing.professional.feature2,
        t.pricing.professional.feature3,
        t.pricing.professional.feature4,
        t.pricing.professional.feature5,
      ],
      popular: true,
    },
    {
      id: "elite",
      name: t.pricing.elite.name,
      price: getPrice("elite", currency),
      description: t.pricing.elite.description,
      features: [
        t.pricing.elite.feature1,
        t.pricing.elite.feature2,
        t.pricing.elite.feature3,
        t.pricing.elite.feature4,
        t.pricing.elite.feature5,
        t.pricing.elite.feature6,
        t.pricing.elite.feature7,
      ],
      popular: false,
    },
  ];

  const handleCheckout = async (planId: string, currency?: string) => {
    
    // Check if user is authenticated
    if (!session) {
      window.location.href = "/login";
      return;
    }

    setLoadingPlanId(planId);

    try {
      // Get Supabase session token
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        window.location.href = "/login";
        return;
      }

      // Get Supabase project URL from environment
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      console.log("🔵 [DEBUG] Supabase URL:", supabaseUrl);
      console.log("🔵 [DEBUG] User token:", currentSession.access_token ? "✅ Present" : "❌ Missing");
      
      if (!supabaseUrl) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
      }

      // Detect currency from browser if not provided
      const detectedCurrency = currency || 
        (typeof window !== "undefined" 
          ? new Intl.NumberFormat().resolvedOptions().currency?.toLowerCase() || "usd"
          : "usd");

      const functionUrl = `${supabaseUrl}/functions/v1/create-checkout-session`;

      // Get plan data for translated name
      const selectedPlan = pricingPlans.find(p => p.id === planId);

      // Map app language to Stripe locale
      // Only map languages available in the Navbar: en, es, fr, de, pt
      const stripeLocale = language === "pt" ? "pt" : 
                          language === "es" ? "es" : 
                          language === "fr" ? "fr" : 
                          language === "de" ? "de" : 
                          language === "en" ? "en" : 
                          "auto"; // Stripe will auto-detect if language not supported
        debugger;
      // Call Edge Function to create checkout session
      const response = await fetch(
        functionUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({ 
            planId,
            currency: detectedCurrency,
            planName: selectedPlan?.name, // Translated plan name
            locale: stripeLocale, // Stripe Checkout locale
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
      console.error("Checkout error:", error);
      alert(error.message || "Failed to start checkout. Please try again.");
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
          <div className="text-center space-y-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              {t.pricing.title}
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              {t.pricing.subtitle}
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {pricingPlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border ${
                  plan.popular
                    ? "border-blue-500 dark:border-blue-500 shadow-2xl scale-105"
                    : "border-zinc-200 dark:border-zinc-800 shadow-xl"
                } bg-white dark:bg-zinc-900 p-8 transition-all hover:shadow-2xl`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-semibold px-4 py-1 rounded-full">
                      {t.pricing.mostPopular}
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline justify-center gap-1">
                    {isLoadingPrices ? (
                      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                    ) : (
                      <>
                        <span className="text-4xl font-extrabold">
                          {formatPrice(plan.price, currency)}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400">{t.pricing.perMonth}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Features List */}
                <ul className="flex-1 space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={authLoading || loadingPlanId === plan.id}
                  className={`w-full h-12 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    plan.popular
                      ? "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                  }`}
                >
                  {loadingPlanId === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    t.pricing.getStarted
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-sm text-zinc-500 dark:text-zinc-600">
        <p>{formatMessage(t.footer.copyright, { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}

