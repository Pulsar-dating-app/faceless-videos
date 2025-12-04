"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Loader2, Video, FileText, Wand2, Play, Pause, User, Image, Gamepad2, Volume2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { CustomSelect } from "@/components/CustomSelect";

export default function Home() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("joke");
  const [duration, setDuration] = useState("30");
  const [videoType, setVideoType] = useState<"gameplay" | "ai-images">("gameplay");
  const [artStyle, setArtStyle] = useState("cartoon");
  const [voice, setVoice] = useState("alloy");
  const [customPrompt, setCustomPrompt] = useState("");
  const [script, setScript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(false);
  const [mockPayload, setMockPayload] = useState<string>("");
  const [playingVoicePreview, setPlayingVoicePreview] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewRef = useRef<HTMLAudioElement | null>(null);

  // Load mock payload from localStorage on mount
  useEffect(() => {
    const savedMock = localStorage.getItem("ai-video-mock-payload");
    if (savedMock) {
      setMockPayload(savedMock);
    }
  }, []);

  const handleGenerateScript = async () => {
    setIsGeneratingScript(true);
    try {
      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke("generate-script", {
        body: { category, prompt: customPrompt, duration },
      });

      if (error) throw error;
      
      if (data?.script) {
        setScript(data.script);
      }
    } catch (error) {
      console.error("Error generating script:", error);
      alert("Failed to generate script. Please check console for details.");
    } finally {
      setIsGeneratingScript(false);
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

  const playVoicePreview = (voiceName: string) => {
    // Stop currently playing preview if any
    if (voicePreviewRef.current) {
      voicePreviewRef.current.pause();
      voicePreviewRef.current.currentTime = 0;
    }

    // If clicking the same voice that's playing, just stop it
    if (playingVoicePreview === voiceName) {
      setPlayingVoicePreview(null);
      return;
    }

    // Play the new voice preview
    const audio = new Audio(`/voice-samples/${voiceName}.mp3`);
    voicePreviewRef.current = audio;
    
    audio.play().catch((error) => {
      console.error('Error playing voice preview:', error);
      alert(`Voice preview for "${voiceName}" not found. Please generate voice samples first.`);
    });

    setPlayingVoicePreview(voiceName);

    // Reset when audio ends
    audio.onended = () => {
      setPlayingVoicePreview(null);
    };
  };

  const handleGenerate = async () => {
    if (!user) {
      alert("Please sign in to generate videos!");
      window.location.href = "/login";
      return;
    }

    if (!script) {
      alert("Please generate or write a script first!");
      return;
    }
    
    setIsGenerating(true);
    setVideoUrl(null);

    try {
      if (videoType === "ai-images") {
        // AI Images flow
        let aiData: any;
        
        // Check if we should use mock data
        if (useMockData && mockPayload) {
          console.log("Using mock data instead of calling Edge Function");
          try {
            aiData = JSON.parse(mockPayload);
          } catch (e) {
            throw new Error("Invalid mock payload JSON");
          }
        } else {
          // 1. Generate Audio + Subtitles + Image Prompts via Supabase Edge Function
          const { data, error: aiError } = await supabase.functions.invoke("generate-ai-video", {
            body: { text: script, voice, artStyle },
          });

          if (aiError) throw aiError;
          aiData = data;
        }

        if (!aiData?.audioUrl) {
          throw new Error("Failed to generate audio");
        }

        const currentAudioUrl = aiData.audioUrl;
        const subtitles = aiData.subtitles || "";
        const generatedImages = aiData.generatedImages || [];
        const audioDuration = aiData.audioDuration || 0;
        setAudioUrl(currentAudioUrl);

        console.log("Generated images:", generatedImages.length);
        console.log("Audio duration:", audioDuration, "seconds");

        if (generatedImages.length === 0) {
          throw new Error("No images were generated");
        }

        // 2. Merge images + audio into video using local API (FFmpeg)
        const mergeResponse = await fetch("/api/merge-ai-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audioUrl: currentAudioUrl,
            subtitles: subtitles,
            generatedImages: generatedImages,
            audioDuration: audioDuration,
          }),
        });

        if (!mergeResponse.ok) {
          const errorData = await mergeResponse.json();
          throw new Error(errorData.error || "Failed to merge AI video");
        }

        const mergeData = await mergeResponse.json();
        
        if (mergeData.url) {
          setVideoUrl(mergeData.url);
        } else {
          throw new Error("No video URL returned from merge");
        }
        
      } else {
        // Gameplay video flow (existing logic)
        // 1. Generate Audio + Subtitles via Supabase Edge Function
        const { data: audioData, error: audioError } = await supabase.functions.invoke("generate-video", {
          body: { text: script, voice },
        });

        if (audioError) throw audioError;
        if (!audioData?.audioUrl) {
          throw new Error("Failed to generate audio");
        }
        
        const currentAudioUrl = audioData.audioUrl;
        const subtitles = audioData.subtitles || "";
        setAudioUrl(currentAudioUrl);

        // 2. Merge Video using local API (FFmpeg requires server)
        const response = await fetch("/api/merge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audioUrl: currentAudioUrl,
            subtitles: subtitles,
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
      <Navbar onLogoClick={() => setShowForm(false)} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12 sm:py-20">
        {!showForm ? (
          // Hero Section
          <div className="max-w-3xl space-y-8">
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
          <div className="max-w-xl w-full space-y-8 bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Video className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold">Configure Your Video</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Choose a viral topic or write your own.</p>
            </div>

            {!videoUrl ? (
              <div className="space-y-6 text-left">
                {/* Video Type Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Video Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setVideoType("gameplay")}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                        videoType === "gameplay"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        videoType === "gameplay"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                      }`}>
                        <Gamepad2 className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-sm">Gameplay Video</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Background gameplay</div>
                      </div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setVideoType("ai-images")}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                        videoType === "ai-images"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        videoType === "ai-images"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                      }`}>
                        <Image className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-sm">AI Images</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">AI generated visuals</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Voice Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Narrator Voice</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map((v) => (
                      <div key={v} className="relative">
                        <button
                          type="button"
                          onClick={() => setVoice(v)}
                          className={`w-full px-3 py-2 pr-8 text-sm capitalize rounded-lg border transition-all ${
                            voice === v
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                          }`}
                        >
                          {v}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playVoicePreview(v);
                          }}
                          className={`absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded transition-colors ${
                            playingVoicePreview === v
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400"
                          }`}
                          title="Preview voice"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Art Style Selector - Only shown for AI Images */}
                {videoType === "ai-images" && (
                  <CustomSelect
                    label="Art Style"
                    value={artStyle}
                    onChange={setArtStyle}
                    options={[
                      { value: "cartoon", label: "Cartoon" },
                      { value: "horror", label: "Horror" },
                      { value: "realistic", label: "Realistic" },
                      { value: "anime", label: "Anime" },
                      { value: "watercolor", label: "Watercolor" },
                      { value: "cyberpunk", label: "Cyberpunk" },
                      { value: "minimalist", label: "Minimalist" },
                      { value: "oil-painting", label: "Oil Painting" },
                      { value: "sketch", label: "Sketch" },
                      { value: "3d-render", label: "3D Render" },
                    ]}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <CustomSelect
                    label="Viral Category"
                    value={category}
                    onChange={setCategory}
                    options={[
                      { value: "joke", label: "Funny Joke" },
                      { value: "animal", label: "Cute Animals" },
                      { value: "motivational", label: "Daily Motivation" },
                      { value: "tech", label: "Tech Facts" },
                      { value: "scary", label: "Scary Story" },
                      { value: "history", label: "History Facts" },
                      { value: "reddit", label: "Reddit Story" },
                      { value: "reddit-relationship", label: "Reddit Relationship" },
                    ]}
                  />

                  <CustomSelect
                    label="Duration"
                    value={duration}
                    onChange={setDuration}
                    options={[
                      { value: "30", label: "30 Seconds" },
                      { value: "60", label: "1 Minute" },
                      { value: "120", label: "2 Minutes" },
                    ]}
                  />
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

                {/* Mock Mode Toggle (only for AI Images) */}
                {videoType === "ai-images" && (
                  <div className="space-y-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="mockMode"
                        checked={useMockData}
                        onChange={(e) => setUseMockData(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600"
                      />
                      <label htmlFor="mockMode" className="text-sm font-medium cursor-pointer">
                        Use Mock Data (Skip API calls)
                      </label>
                    </div>
                    {useMockData && (
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-600 dark:text-zinc-400">
                          Paste Edge Function response JSON here:
                        </label>
                        <textarea
                          value={mockPayload}
                          onChange={(e) => {
                            setMockPayload(e.target.value);
                            localStorage.setItem("ai-video-mock-payload", e.target.value);
                          }}
                          placeholder='{"audioUrl": "...", "subtitles": "...", "generatedImages": [...], ...}'
                          className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[100px] resize-none font-mono"
                        />
                        <button
                          onClick={() => {
                            setMockPayload("");
                            localStorage.removeItem("ai-video-mock-payload");
                          }}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Clear Mock Data
                        </button>
                      </div>
                    )}
                  </div>
                )}

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
