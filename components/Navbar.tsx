"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useI18n, Language } from "@/lib/i18n-context";
import { useRouter, usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface NavbarProps {
  onLogoClick?: () => void;
}

const LANGUAGE_OPTIONS = [
  { code: 'en' as Language, name: 'English', flag: '🇺🇸' },
  { code: 'es' as Language, name: 'Español', flag: '🇪🇸' },
  { code: 'fr' as Language, name: 'Français', flag: '🇫🇷' },
  { code: 'de' as Language, name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt' as Language, name: 'Português', flag: '🇵🇹' },
];

export function Navbar({ onLogoClick }: NavbarProps) {
  const { user, isLoading, signOut } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    // If we're on the home page and have a callback, prevent navigation and call the callback
    if (pathname === "/" && onLogoClick) {
      e.preventDefault();
      onLogoClick();
    }
  };

  const currentLang = LANGUAGE_OPTIONS.find(l => l.code === language) || LANGUAGE_OPTIONS[0];

  return (
    <header className="w-full p-6 flex justify-between items-center max-w-6xl mx-auto">
      <Link 
        href="/" 
        onClick={handleLogoClick}
        className="flex items-center gap-2 font-bold text-xl cursor-pointer"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-lg">V</span>
        </div>
        <span>ViralGen</span>
      </Link>
      
      <nav className="hidden md:flex gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400 items-center">
        <a href="#" className="hover:text-blue-600 transition-colors">{t.nav.features}</a>
        <Link href="/pricing" className="hover:text-blue-600 transition-colors">{t.nav.pricing}</Link>
        <a href="#" className="hover:text-blue-600 transition-colors">{t.nav.about}</a>
        
        {/* Language Switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Change language"
          >
            <Languages className="w-4 h-4" />
            <span className="text-lg">{currentLang.flag}</span>
          </button>
          
          {isLangDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-2 z-50">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsLangDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
                    language === lang.code ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''
                  }`}
                >
                  <span className="text-xl">{lang.flag}</span>
                  <span className="font-medium">{lang.name}</span>
                  {language === lang.code && (
                    <span className="ml-auto text-blue-600 dark:text-blue-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {isLoading ? (
          <div className="w-20 h-8 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-md" />
        ) : user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium truncate max-w-[150px]">{user.email}</span>
            <button 
              onClick={() => signOut()}
              className="text-red-600 hover:text-red-700 transition-colors"
            >
              {t.nav.signOut}
            </button>
          </div>
        ) : (
          <>
            <Link href="/login" className="hover:text-blue-600 transition-colors">{t.nav.login}</Link>
            <Link href="/signup" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              {t.nav.signUp}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

