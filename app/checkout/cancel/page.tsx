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
            <h1 className="text-3xl font-bold">{t.checkoutCancel.title}</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t.checkoutCancel.message}
            </p>
          </div>

          <Link
            href="/pricing"
            className="w-full bg-blue-600 text-white hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors text-center"
          >
            {t.checkoutCancel.goToPricing}
          </Link>
        </div>
      </main>
    </div>
  );
}

