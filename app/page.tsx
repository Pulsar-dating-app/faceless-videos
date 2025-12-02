"use client";

import { ArrowRight, Sparkles, Loader2, Video, FileText, Wand2, Play, Pause } from "lucide-react";
import { useState, useRef } from "react";

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("joke");
  const [duration, setDuration] = useState("30");
  const [customPrompt, setCustomPrompt] = useState("");
  const [script, setScript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerateScript = async () => {
    setIsGeneratingScript(true);
    try {
      const response = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, prompt: customPrompt, duration }),
      });
      
      const data = await response.json();
      if (data.script) {
        setScript(data.script);
      }
    } catch (error) {
      console.error("Error generating script:", error);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!script) return;
    setIsGeneratingAudio(true);
    try {
      const response = await fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script, voice: "alloy" }),
      });
      
      const data = await response.json();
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
      }
    } catch (error) {
      console.error("Error generating audio:", error);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlayingAudio(!isPlayingAudio);
    }
  };

  const handleGenerate = async () => {
    if (!script) {
      alert("Please generate or write a script first!");
      return;
    }
    
    setIsGenerating(true);
    setVideoUrl(null);

    try {
      // 1. Generate Audio
      const audioResponse = await fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script, voice: "alloy" }),
      });
      
      const audioData = await audioResponse.json();
      if (!audioData.audioUrl) {
         throw new Error("Failed to generate audio");
      }
      
      const currentAudioUrl = audioData.audioUrl;
      setAudioUrl(currentAudioUrl);

      // 2. Generate Video using Audio
      const response = await fetch("/api/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioUrl: currentAudioUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate video");
      }

      const data = await response.json();
      
      if (data.url) {
        setVideoUrl(data.url);
      } else {
        throw new Error("No video URL returned");
      }
    } catch (error) {
      console.error("Error generating video:", error);
      alert("Something went wrong while generating the video.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar / Header */}
      <header className="w-full p-6 flex justify-between items-center max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl cursor-pointer" onClick={() => { setShowForm(false); setVideoUrl(null); }}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">V</span>
          </div>
          <span>ViralGen</span>
        </div>
        {/* Placeholder for future auth/menu */}
        <nav className="hidden md:flex gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <a href="#" className="hover:text-blue-600 transition-colors">Features</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Pricing</a>
          <a href="#" className="hover:text-blue-600 transition-colors">About</a>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12 sm:py-20">
        {!showForm ? (
          // Hero Section
          <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3 h-3" />
              <span>AI-Powered Automation</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
              Create Viral Short Videos <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                in Seconds
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Automate your faceless channels on TikTok and Instagram. 
              Generate engaging scripts, visuals, and voiceovers with just one click.
            </p>

            {/* CTA Button */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => setShowForm(true)}
                className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-blue-600 px-8 font-medium text-white transition-all duration-300 hover:bg-blue-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-background"
              >
                <span className="mr-2">Generate Video</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              
              <button className="inline-flex h-12 items-center justify-center rounded-full px-8 font-medium text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Watch Demo
              </button>
            </div>
          </div>
        ) : (
          // Generation Form Section
          <div className="max-w-xl w-full space-y-8 animate-in fade-in zoom-in-95 duration-300 bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Video className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold">Configure Your Videoo</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Choose a viral topic or write your own.</p>
            </div>

            {!videoUrl ? (
              <div className="space-y-6 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Viral Category</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="joke">Funny Joke</option>
                      <option value="animal">Cute Animals</option>
                      <option value="motivational">Daily Motivation</option>
                      <option value="tech">Tech Facts</option>
                      <option value="scary">Scary Story</option>
                      <option value="history">History Facts</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Duration</label>
                    <select 
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="30">30 Seconds</option>
                      <option value="60">1 Minute</option>
                      <option value="120">2 Minutes</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Video Script</label>
                    <button
                      onClick={handleGenerateScript}
                      disabled={isGeneratingScript}
                      className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                    >
                      {isGeneratingScript ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      Generate with AI
                    </button>
                  </div>
                  <textarea 
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Enter your script here or generate one..."
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[120px] resize-none font-mono text-sm"
                  />
                </div>

                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full h-12 flex items-center justify-center rounded-lg bg-blue-600 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Generating Magic...
                    </>
                  ) : (
                    "Create Video"
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-inner border border-zinc-800">
                  <video 
                    src={videoUrl} 
                    controls 
                    autoPlay 
                    loop 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setVideoUrl(null)}
                    className="flex-1 h-11 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium transition-all"
                  >
                    Generate Another
                  </button>
                  <a 
                    href={videoUrl} 
                    download="viral-video.mp4"
                    className="flex-1 h-11 flex items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition-all"
                  >
                    Download
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Simple Footer */}
      <footer className="w-full py-6 text-center text-sm text-zinc-500 dark:text-zinc-600">
        <p>© {new Date().getFullYear()} ViralGen. All rights reserved.</p>
      </footer>
    </div>
  );
}
