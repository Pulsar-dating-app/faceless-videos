"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const { user, isLoading, signOut } = useAuth();

  return (
    <header className="w-full p-6 flex justify-between items-center max-w-6xl mx-auto">
      <Link href="/" className="flex items-center gap-2 font-bold text-xl cursor-pointer">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-lg">V</span>
        </div>
        <span>ViralGen</span>
      </Link>
      
      <nav className="hidden md:flex gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400 items-center">
        <a href="#" className="hover:text-blue-600 transition-colors">Features</a>
        <Link href="/pricing" className="hover:text-blue-600 transition-colors">Pricing</Link>
        <a href="#" className="hover:text-blue-600 transition-colors">About</a>
        
        {isLoading ? (
          <div className="w-20 h-8 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-md" />
        ) : user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium truncate max-w-[150px]">{user.email}</span>
            <button 
              onClick={() => signOut()}
              className="text-red-600 hover:text-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <>
            <Link href="/login" className="hover:text-blue-600 transition-colors">Login</Link>
            <Link href="/signup" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Sign Up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

