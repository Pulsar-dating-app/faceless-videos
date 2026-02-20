"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n-context";

export default function CheckoutCancelPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">Checkout closed</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              No charges were made. You can subscribe anytime from the pricing page.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Link
              href="/dashboard?section=subscription"
              className="w-full bg-blue-600 text-white hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors text-center"
            >
              My subscription
            </Link>
            <Link
              href="/pricing"
              className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 px-6 py-3 rounded-lg font-medium transition-colors text-center"
            >
              View plans
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

