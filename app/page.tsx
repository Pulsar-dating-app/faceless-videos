"use client";

import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";

// Carousel configuration
const CAROUSEL_MAX_WIDTH = "1300px"; // Easy to configure - max width of the carousel

// Sample video URLs - replace with your actual video URLs
const CAROUSEL_VIDEOS = [
  "/videos/minecraft_1.mp4",
  "/videos/minecraft_1.mp4",
  "/videos/minecraft_1.mp4",
  "/videos/minecraft_1.mp4",
  "/videos/minecraft_1.mp4",
  "/videos/minecraft_1.mp4",
  "/videos/minecraft_1.mp4",
  // Add more video URLs here as you create them
  // "/videos/example2.mp4",
  // "/videos/example3.mp4",
];

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { t, formatMessage } = useI18n();

  const handleGenerateVideo = () => {
    if (user) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  // Duplicate videos for seamless infinite loop
  const carouselVideos = [...CAROUSEL_VIDEOS, ...CAROUSEL_VIDEOS];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar onLogoClick={() => {}} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12 sm:py-20">
        {/* Hero Section */}
        <div className="max-w-3xl space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3 h-3" />
            <span>{t.hero.badge}</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            {t.hero.headline1} <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {t.hero.headline2}
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            {t.hero.subheadline}
          </p>

          {/* CTA Button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={handleGenerateVideo}
              disabled={isLoading}
              className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-blue-600 px-8 font-medium text-white transition-all duration-300 hover:bg-blue-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <span className="mr-2">{t.hero.cta}</span>
              )}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            
            <button className="inline-flex h-12 items-center justify-center rounded-full px-8 font-medium text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              {t.hero.demo}
            </button>
          </div>
        </div>

        {/* Video Carousel */}
        <div className="w-full mt-20 sm:mt-32 overflow-hidden relative" style={{ maxWidth: CAROUSEL_MAX_WIDTH, marginLeft: 'auto', marginRight: 'auto' }}>
          {/* Left fade gradient */}
          <div className="absolute left-0 top-0 bottom-0 w-32 sm:w-48 z-10 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none" />
          
          {/* Right fade gradient */}
          <div className="absolute right-0 top-0 bottom-0 w-32 sm:w-48 z-10 bg-gradient-to-l from-background via-background/80 to-transparent pointer-events-none" />
          
          <div className="relative w-full">
            <div className="flex gap-4 animate-scroll">
              {carouselVideos.map((video, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 w-[140px] sm:w-[180px] rounded-2xl overflow-hidden shadow-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-900"
                >
                  <video
                    src={video}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ aspectRatio: '9/16' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="w-full py-6 text-center text-sm text-zinc-500 dark:text-zinc-600">
        <p>{formatMessage(t.footer.copyright, { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}
