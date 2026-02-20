import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n-context";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Viral Faceless Reels - AI Faceless Video Generator | Create Viral TikTok & Instagram Reels",
  description: "Create viral faceless videos in seconds with AI. Generate engaging scripts, voiceovers, and visuals for TikTok, Instagram Reels, and YouTube Shorts. Automate your content creation with AI-powered video generation.",
  keywords: [
    "faceless videos",
    "AI video generator",
    "TikTok video maker",
    "Instagram Reels generator",
    "YouTube Shorts creator",
    "viral video maker",
    "AI content creation",
    "automated video creation",
    "faceless channel",
    "AI voiceover",
    "short video generator",
  ],
  authors: [{ name: "Viral Faceless Reels" }],
  creator: "Viral Faceless Reels",
  publisher: "Viral Faceless Reels",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.viralfacelessreels.com",
    title: "Viral Faceless Reels - AI Faceless Video Generator",
    description: "Create viral faceless videos in seconds with AI. Generate engaging scripts, voiceovers, and visuals automatically.",
    siteName: "Viral Faceless Reels",
    images: [
      {
        url: "/og-image.png", // You'll need to add this image
        width: 1200,
        height: 630,
        alt: "Viral Faceless Reels - AI Faceless Video Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Viral Faceless Reels - AI Faceless Video Generator",
    description: "Create viral faceless videos in seconds with AI. Generate engaging scripts, voiceovers, and visuals automatically.",
    images: ["/og-image.png"], // You'll need to add this image
    creator: "@viralfacelessreels", // Replace with your Twitter handle if you have one
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your verification codes when you have them
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // bing: "your-bing-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegistrar />
        <I18nProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
