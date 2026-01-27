"use client";

import { ArrowRight, Sparkles, Loader2, UserX, DollarSign, Clock, TrendingUp, Star, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";

// Carousel configuration
const CAROUSEL_MAX_WIDTH = "1300px"; // Easy to configure - max width of the carousel

// Sample video URLs - replace with your actual video URLs
const CAROUSEL_VIDEOS = [
  "/videos/minecraft_1.mp4",
  "/videos/category_examples/preview_background.mp4",
  "/videos/category_examples/preview_full_ai.mp4",
  "/videos/minecraft_1.mp4",
  "/videos/minecraft_1.mp4",
  "/videos/minecraft_1.mp4",
  "/videos/minecraft_1.mp4",
  // Add more video URLs here as you create them
  // "/videos/example2.mp4",
  // "/videos/example3.mp4",
];

// Reviews - Easy to edit and add new ones
const REVIEWS = [
  {
    name: "Sarah Chen",
    rating: 5,
    comment: "This platform is a game-changer! I've been creating 10+ videos daily without any editing skills. My TikTok account grew from 500 to 50K followers in just 2 months.",
  },
  {
    name: "Marcus Johnson",
    rating: 5,
    comment: "Finally, a tool that lets me create content without showing my face. The AI-generated scripts are amazing and the videos look professional. Highly recommend!",
  },
  {
    name: "Emma Rodriguez",
    rating: 5,
    comment: "I was spending $500/month on video editors. Now I create everything myself in minutes. This has saved me so much time and money. Best investment ever!",
  },
  {
    name: "David Kim",
    rating: 5,
    comment: "The passive income potential is incredible. I'm generating content for multiple platforms simultaneously. My Instagram reels are getting millions of views!",
  },
  {
    name: "Lisa Anderson",
    rating: 5,
    comment: "As someone who's camera-shy, this is perfect. I can build my brand and make money without ever appearing on camera. The quality is outstanding!",
  },
  {
    name: "James Wilson",
    rating: 5,
    comment: "What used to take me 4-5 hours per video now takes 5 minutes. I've scaled my content creation to 20+ videos per day. My revenue has tripled!",
  },
];

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { t, formatMessage } = useI18n();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

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
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8 sm:py-12">
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
        <div className="w-full mt-12 sm:mt-16 overflow-hidden relative" style={{ maxWidth: CAROUSEL_MAX_WIDTH, marginLeft: 'auto', marginRight: 'auto' }}>
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

        {/* Why Choose Us Section */}
        <section className="w-full mt-8 sm:mt-12 px-4 pt-16 sm:pt-24 pb-4 sm:pb-6">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
                {t.whyChooseUs.title}
              </h2>
              <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                {t.whyChooseUs.subtitle}
              </p>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Card 1: No Face Required */}
              <div className="group relative p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20 hover:-translate-y-1">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                    <UserX className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl sm:text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">
                      {t.whyChooseUs.card1.title}
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {t.whyChooseUs.card1.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: No Video Editors Needed */}
              <div className="group relative p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 dark:hover:shadow-purple-500/20 hover:-translate-y-1">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                    <DollarSign className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl sm:text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">
                      {t.whyChooseUs.card2.title}
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {t.whyChooseUs.card2.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 3: Hours to Minutes */}
              <div className="group relative p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-green-300 dark:hover:border-green-700 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10 dark:hover:shadow-green-500/20 hover:-translate-y-1">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 flex items-center justify-center text-white shadow-lg shadow-green-500/30">
                    <Clock className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl sm:text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">
                      {t.whyChooseUs.card3.title}
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {t.whyChooseUs.card3.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 4: Passive Income Ready */}
              <div className="group relative p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20 border border-zinc-200/50 dark:border-zinc-800/50 hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 dark:hover:shadow-orange-500/20 hover:-translate-y-1">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                    <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl sm:text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">
                      {t.whyChooseUs.card4.title}
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {t.whyChooseUs.card4.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Reviews Section */}
        <section className="w-full mt-0 px-4 py-16 sm:py-24 bg-zinc-50/50 dark:bg-zinc-950/50">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
                {t.reviews.title}
              </h2>
              <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                {t.reviews.subtitle}
              </p>
            </div>

            {/* Reviews Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {REVIEWS.map((review, index) => (
                <div
                  key={index}
                  className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20 hover:-translate-y-1"
                >
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-5 h-5 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>

                  {/* Comment */}
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                    &quot;{review.comment}&quot;
                  </p>

                  {/* Name */}
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    — {review.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="w-full mt-0 px-4 py-16 sm:py-24">
          <div className="max-w-4xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
                {t.faq.title}
              </h2>
              <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400">
                {t.faq.subtitle}
              </p>
            </div>

            {/* FAQ Items */}
            <div className="space-y-4">
              {t.faq.questions.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-700"
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <span className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 pr-8">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 transition-transform duration-300 ${
                        openFaqIndex === index ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      openFaqIndex === index ? "max-h-96" : "max-h-0"
                    }`}
                  >
                    <div className="px-6 pb-5 sm:px-8 sm:pb-6 pt-2">
                      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Simple Footer */}
      <footer className="w-full py-6 text-center text-sm text-zinc-500 dark:text-zinc-600">
        <p>{formatMessage(t.footer.copyright, { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}
