"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n-context";

export default function PricingPage() {
  const { t, formatMessage } = useI18n();

  // Pricing data structure with translations
  const pricingPlans = [
    {
      name: t.pricing.starter.name,
      price: 10,
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
      name: t.pricing.professional.name,
      price: 25,
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
      name: t.pricing.elite.name,
      price: 50,
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
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
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
                    <span className="text-4xl font-extrabold">${plan.price}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">{t.pricing.perMonth}</span>
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
                  className={`w-full h-12 rounded-lg font-medium transition-all ${
                    plan.popular
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {t.pricing.getStarted}
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

