"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n-context";

export function Footer() {
  const { t, formatMessage } = useI18n();

  return (
    <footer className="w-full py-6 text-center text-sm text-zinc-500 dark:text-zinc-600">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
        <p>{formatMessage(t.footer.copyright, { year: new Date().getFullYear() })}</p>
        <span className="hidden sm:inline">•</span>
        <Link 
          href="/terms" 
          className="hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors underline underline-offset-4"
        >
          Terms and Conditions
        </Link>
      </div>
    </footer>
  );
}
