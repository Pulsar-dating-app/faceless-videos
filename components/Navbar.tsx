"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useI18n, Language } from "@/lib/i18n-context";
import { useRouter, usePathname } from "next/navigation";
import { Languages, Menu, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface NavbarProps {
  onLogoClick?: () => void;
}

const LANGUAGE_OPTIONS = [
  { code: 'en' as Language, name: 'English', flag: '🇺🇸' },
  { code: 'es' as Language, name: 'Español', flag: '🇪🇸' },
  { code: 'fr' as Language, name: 'Français', flag: '🇫🇷' },
  { code: 'de' as Language, name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt' as Language, name: 'Português', flag: '🇧🇷' },
];

export function Navbar({ onLogoClick }: NavbarProps) {
  const { user, isLoading, signOut } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogoClick = (e: React.MouseEvent) => {
    // If we're on the home page and have a callback, prevent navigation and call the callback
    if (pathname === "/" && onLogoClick) {
      e.preventDefault();
      onLogoClick();
    }
  };

  const currentLang = LANGUAGE_OPTIONS.find(l => l.code === language) || LANGUAGE_OPTIONS[0];

  return (
    <header className="w-full p-4 sm:p-6 flex justify-between items-center max-w-6xl mx-auto relative">
      <Link 
        href="/" 
        onClick={handleLogoClick}
        className="flex items-center gap-2 font-bold text-xl cursor-pointer z-50"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-lg">V</span>
        </div>
        <span>ViralGen</span>
      </Link>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-50"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Menu className="w-6 h-6" />
        )}
      </button>

      {/* Desktop Navigation */}
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

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Navigation Menu */}
      <nav className={`fixed top-0 right-0 h-full w-72 bg-white dark:bg-zinc-900 z-40 transform transition-transform duration-300 ease-in-out md:hidden shadow-xl ${
        isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col p-6 pt-20 gap-4">
          <a href="#" className="px-4 py-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium transition-colors">
            {t.nav.features}
          </a>
          <Link href="/pricing" className="px-4 py-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium transition-colors">
            {t.nav.pricing}
          </Link>
          <a href="#" className="px-4 py-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium transition-colors">
            {t.nav.about}
          </a>
          
          {/* Language Switcher Mobile */}
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-2">
            <p className="px-4 text-sm text-zinc-500 dark:text-zinc-400 mb-2">Language</p>
            <div className="space-y-1">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                  }}
                  className={`w-full px-4 py-2 text-left flex items-center gap-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
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
          </div>

          {/* Auth Links Mobile */}
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-2">
            {isLoading ? (
              <div className="w-full h-10 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-lg" />
            ) : user ? (
              <div className="space-y-3">
                <p className="px-4 text-sm text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
                <button 
                  onClick={() => signOut()}
                  className="w-full px-4 py-3 rounded-lg text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors"
                >
                  {t.nav.signOut}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link 
                  href="/login" 
                  className="block px-4 py-3 rounded-lg text-center hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium transition-colors"
                >
                  {t.nav.login}
                </Link>
                <Link 
                  href="/signup" 
                  className="block px-4 py-3 rounded-lg text-center bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
                >
                  {t.nav.signUp}
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
