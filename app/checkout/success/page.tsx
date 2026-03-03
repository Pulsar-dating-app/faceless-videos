"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n-context";
import { Suspense } from "react";

function CheckoutSuccessContent() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 dark:bg-green-900 p-4">
              <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-bold">{t.checkoutSuccess.title}</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t.checkoutSuccess.message}
            </p>
          </div>

          <Link
            href="/dashboard"
            className="w-full bg-blue-600 text-white hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors text-center"
          >
            {t.checkoutSuccess.goToDashboard}
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}

