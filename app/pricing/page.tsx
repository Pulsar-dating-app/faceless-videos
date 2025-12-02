"use client";

import Link from "next/link";
import { Check } from "lucide-react";

// Easy-to-edit pricing data structure
const pricingPlans = [
  {
    name: "Starter",
    price: 10,
    description: "Perfect for getting started",
    features: [
      "10 videos per month",
      "Basic templates",
      "HD quality export",
      "Email support",
    ],
    popular: false,
  },
  {
    name: "Professional",
    price: 25,
    description: "For content creators",
    features: [
      "50 videos per month",
      "All templates",
      "4K quality export",
      "Priority support",
      "Custom branding",
    ],
    popular: true,
  },
  {
    name: "Elite",
    price: 50,
    description: "For agencies and teams",
    features: [
      "Unlimited videos",
      "All templates + custom",
      "4K quality export",
      "24/7 priority support",
      "Custom branding",
      "API access",
      "Team collaboration",
    ],
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar / Header */}
      <header className="w-full p-6 flex justify-between items-center max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">V</span>
          </div>
          <span>ViralGen</span>
        </Link>
        <nav className="hidden md:flex gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400 items-center">
          <Link href="#" className="hover:text-blue-600 transition-colors">
            Features
          </Link>
          <Link href="/pricing" className="hover:text-blue-600 transition-colors">
            Pricing
          </Link>
          <Link href="#" className="hover:text-blue-600 transition-colors">
            About
          </Link>
          <Link href="/login" className="hover:text-blue-600 transition-colors">
            Login
          </Link>
          <Link href="/signup" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            Sign Up
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-20">
        <div className="max-w-6xl w-full space-y-12">
          {/* Header Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Choose the plan that fits your needs. All plans include our core features.
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
                      Most Popular
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
                    <span className="text-zinc-500 dark:text-zinc-400">/month</span>
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
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-sm text-zinc-500 dark:text-zinc-600">
        <p>© {new Date().getFullYear()} ViralGen. All rights reserved.</p>
      </footer>
    </div>
  );
}

