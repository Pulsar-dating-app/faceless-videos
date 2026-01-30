"use client";

import { ArrowRight, ArrowLeft, Sparkles, Loader2, Video, Wand2, Image, Gamepad2, Volume2, Check, Laugh, Zap, Ghost, BookOpen, MessageCircle, Heart, Clock, DollarSign, Link2, Menu, X, Info, Share2, Send, AlertCircle, CreditCard } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { supabase } from "@/lib/supabase";
import NextImage from "next/image";

// Language configurations (flags only - names come from translations)
const LANGUAGE_FLAGS: { [key: string]: string } = {
  'en': '🇺🇸',
  'es': '🇪🇸',
  'fr': '🇫🇷',
  'de': '🇩🇪',
  'pt': '🇧🇷',
  'it': '🇮🇹',
  'nl': '🇳🇱',
  'pl': '🇵🇱',
  'ru': '🇷🇺',
  'zh': '🇨🇳',
  'ja': '🇯🇵',
  'ko': '🇰🇷',
  'ar': '🇸🇦',
  'hi': '🇮🇳',
  'tr': '🇹🇷',
  'sv': '🇸🇪',
  'da': '🇩🇰',
  'no': '🇳🇴',
  'fi': '🇫🇮',
  'id': '🇮🇩',
  'vi': '🇻🇳',
  'th': '🇹🇭',
  'uk': '🇺🇦',
  'cs': '🇨🇿',
  'ro': '🇷🇴',
};

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

// Art styles with preview images
const ART_STYLES = [
  { value: "anime", preview: "/images/anime_preview.png" },
  { value: "cartoon", preview: "/images/cartoon_preview.png" },
  { value: "ghibli", preview: "/images/ghibli_preview.png" },
  { value: "horror", preview: "/images/horror_preview.png" },
  { value: "realistic", preview: "/images/realistic_preview.png" },
];

// Background videos with preview images and URLs
const BACKGROUND_VIDEOS = [
  { 
    value: "minecraft", 
    label: "Minecraft",
    preview: "/images/minecraft_preview.png",
    url: "https://github.com/mateus-pulsar/static-video-hosting/releases/download/0.0.2/minecraft_preview.mp4"
  },
  { 
    value: "gta", 
    label: "GTA",
    preview: "/images/gta_preview.png",
    url: "https://github.com/mateus-pulsar/static-video-hosting/releases/download/0.0.2/gta_preview.mp4"
  },
  { 
    value: "satisfying", 
    label: "Satisfying",
    preview: "/images/satisfying_preview.png",
    url: "https://github.com/mateus-pulsar/static-video-hosting/releases/download/0.0.2/satisfying_preview.mp4"
  },
  { 
    value: "mario_kart", 
    label: "Mario Kart",
    preview: "/images/mario_kart_preview.png",
    url: "https://github.com/mateus-pulsar/static-video-hosting/releases/download/0.0.2/mario_kart_preview.mp4"
  },
];

// Category icons mapping
const CATEGORY_ICONS: { [key: string]: React.ReactNode } = {
  joke: <Laugh className="w-5 h-5" />,
  motivational: <Zap className="w-5 h-5" />,
  scary: <Ghost className="w-5 h-5" />,
  history: <BookOpen className="w-5 h-5" />,
  reddit: <MessageCircle className="w-5 h-5" />,
  "reddit-relationship": <Heart className="w-5 h-5" />,
};

// Duration options with monetization info
const DURATION_OPTIONS = [
  { value: "30", label: "25-35s", monetizable: false },
  { value: "70", label: "65-75s", monetizable: true },
];

type DashboardSection = "video-creation" | "social-media";

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { t, formatMessage } = useI18n();
  const [activeSection, setActiveSection] = useState<DashboardSection>("video-creation");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Step state (1-4 for gameplay, 1-5 for AI images)
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form state
  const [videoType, setVideoType] = useState<"gameplay" | "ai-images">("gameplay");
  const [category, setCategory] = useState("joke");
  const [duration, setDuration] = useState("30");
  const [language, setLanguage] = useState("en");
  const [voice, setVoice] = useState("alloy");
  const [artStyle, setArtStyle] = useState("cartoon");
  const [backgroundVideo, setBackgroundVideo] = useState("minecraft");
  const [customPrompt, setCustomPrompt] = useState("");
  const [script, setScript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(false);
  const [mockPayload, setMockPayload] = useState<string>("");
  const [playingVoicePreview, setPlayingVoicePreview] = useState<string | null>(null);
  const [previewVideoType, setPreviewVideoType] = useState<"gameplay" | "ai-images" | null>(null);
  
  // Social media posting states
  const [showPostPanel, setShowPostPanel] = useState(false);
  const [postingTo, setPostingTo] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postDescription, setPostDescription] = useState("");
  const [postHashtags, setPostHashtags] = useState("#viral #fyp #trending");
  
  // Social media connection states
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [tiktokUsername, setTiktokUsername] = useState<string | null>(null);
  const [tiktokAvatar, setTiktokAvatar] = useState<string | null>(null);
  const [isConnectingTiktok, setIsConnectingTiktok] = useState(false);
  const [isDisconnectingTiktok, setIsDisconnectingTiktok] = useState(false);
  
  // Instagram connection states
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [instagramUsername, setInstagramUsername] = useState<string | null>(null);
  const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);
  const [isDisconnectingInstagram, setIsDisconnectingInstagram] = useState(false);

  // YouTube connection states
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [youtubeChannelTitle, setYoutubeChannelTitle] = useState<string | null>(null);
  const [youtubeThumbnail, setYoutubeThumbnail] = useState<string | null>(null);
  const [isConnectingYoutube, setIsConnectingYoutube] = useState(false);
  const [isDisconnectingYoutube, setIsDisconnectingYoutube] = useState(false);

  // Error dialog state
  const [errorDialog, setErrorDialog] = useState<{
    isOpen: boolean;
    type: "credits" | "error";
    title: string;
    message: string;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewRef = useRef<HTMLAudioElement | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Check TikTok/Instagram/YouTube connection status on mount and when returning from OAuth
  useEffect(() => {
    if (user) {
      checkTiktokConnection();
      checkInstagramConnection();
      checkYoutubeConnection();
    }

    // Check for OAuth callback parameters
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    const section = params.get('section');

    if (connected === 'tiktok') {
      // Get TikTok data from URL
      const tiktokDataParam = params.get('tiktok_data');
      
      if (tiktokDataParam) {
        try {
          // Decode and save to localStorage
          const decodedData = Buffer.from(tiktokDataParam, 'base64').toString('utf-8');
          const tiktokData = JSON.parse(decodedData);
          localStorage.setItem('tiktok_connection', JSON.stringify(tiktokData));
        } catch (e) {
          console.error('Error saving TikTok data:', e);
        }
      }
      
      // Show success message
      alert(formatMessage(t.dashboard.socialMedia.connectSuccess, { platform: 'TikTok' }));
      checkTiktokConnection();
      
      // Switch to social media section if specified
      if (section === 'social-media') {
        setActiveSection('social-media');
      }
      
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }

    if (connected === 'instagram') {
      // Get Instagram data from URL
      const instagramDataParam = params.get('instagram_data');
      
      if (instagramDataParam) {
        try {
          // Decode and save to localStorage
          const decodedData = Buffer.from(instagramDataParam, 'base64').toString('utf-8');
          const instagramData = JSON.parse(decodedData);
          localStorage.setItem('instagram_connection', JSON.stringify(instagramData));
        } catch (e) {
          console.error('Error saving Instagram data:', e);
        }
      }
      
      // Show success message
      alert(formatMessage(t.dashboard.socialMedia.connectSuccess, { platform: 'Instagram' }));
      checkInstagramConnection();
      
      // Switch to social media section if specified
      if (section === 'social-media') {
        setActiveSection('social-media');
      }
      
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }

    if (connected === 'youtube') {
      // Get YouTube data from URL
      const youtubeDataParam = params.get('youtube_data');
      
      if (youtubeDataParam) {
        try {
          // Decode and save to localStorage
          const decodedData = Buffer.from(youtubeDataParam, 'base64').toString('utf-8');
          const youtubeData = JSON.parse(decodedData);
          localStorage.setItem('youtube_connection', JSON.stringify(youtubeData));
        } catch (e) {
          console.error('Error saving YouTube data:', e);
        }
      }
      
      // Show success message
      alert(formatMessage(t.dashboard.socialMedia.connectSuccess, { platform: 'YouTube' }));
      checkYoutubeConnection();
      
      // Switch to social media section if specified
      if (section === 'social-media') {
        setActiveSection('social-media');
      }
      
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }

    if (error) {
      // Show error message
      const errorMessages: { [key: string]: string } = {
        'missing_params': 'OAuth parameters missing',
        'oauth_failed': 'Failed to connect to social media',
        'access_denied': 'You denied access',
      };
      alert(`Error: ${errorMessages[error] || 'Unknown error occurred'}`);
      
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const checkTiktokConnection = () => {
    if (!user) return;

    try {
      // Check localStorage for TikTok connection (no API call needed!)
      const tiktokData = localStorage.getItem('tiktok_connection');
      
      if (tiktokData) {
        const data = JSON.parse(tiktokData);
        setTiktokConnected(true);
        setTiktokUsername(data.username);
        setTiktokAvatar(data.avatar_url);
        console.log('✅ TikTok conectado:', data.username);
      } else {
        setTiktokConnected(false);
        setTiktokUsername(null);
        setTiktokAvatar(null);
        console.log('❌ TikTok não conectado');
      }
    } catch (error) {
      console.error('Error checking TikTok connection:', error);
    }
  };

  const checkInstagramConnection = () => {
    if (!user) return;

    try {
      // Check localStorage for Instagram connection
      const instagramData = localStorage.getItem('instagram_connection');
      
      if (instagramData) {
        const data = JSON.parse(instagramData);
        setInstagramConnected(true);
        setInstagramUsername(data.username);
        console.log('✅ Instagram conectado:', data.username);
      } else {
        setInstagramConnected(false);
        setInstagramUsername(null);
        console.log('❌ Instagram não conectado');
      }
    } catch (error) {
      console.error('Error checking Instagram connection:', error);
    }
  };

  const checkYoutubeConnection = () => {
    if (!user) return;

    try {
      // Check localStorage for YouTube connection
      const youtubeData = localStorage.getItem('youtube_connection');
      
      if (youtubeData) {
        const data = JSON.parse(youtubeData);
        setYoutubeConnected(true);
        setYoutubeChannelTitle(data.channel_title);
        setYoutubeThumbnail(data.thumbnail_url);
        console.log('✅ YouTube conectado:', data.channel_title);
      } else {
        setYoutubeConnected(false);
        setYoutubeChannelTitle(null);
        setYoutubeThumbnail(null);
        console.log('❌ YouTube não conectado');
      }
    } catch (error) {
      console.error('Error checking YouTube connection:', error);
    }
  };

  const handleConnectTiktok = () => {
    if (!user) return;
    
    setIsConnectingTiktok(true);
    // Redirect to TikTok OAuth
    window.location.href = `/api/tiktok/auth?user_id=${user.id}`;
  };

  const handleConnectInstagram = () => {
    if (!user) return;
    
    setIsConnectingInstagram(true);
    // Redirect to Instagram OAuth
    window.location.href = `/api/instagram/auth?user_id=${user.id}`;
  };

  const handleConnectYoutube = () => {
    if (!user) return;
    
    setIsConnectingYoutube(true);
    // Redirect to YouTube OAuth
    window.location.href = `/api/youtube/auth?user_id=${user.id}`;
  };

  const handleDisconnectTiktok = async () => {
    if (!user) return;

    const confirmed = confirm(formatMessage(t.dashboard.socialMedia.disconnectConfirm, { platform: 'TikTok' }));
    if (!confirmed) return;

    setIsDisconnectingTiktok(true);

    try {
      // Remove from localStorage
      localStorage.removeItem('tiktok_connection');
      
      setTiktokConnected(false);
      setTiktokUsername(null);
      setTiktokAvatar(null);
      alert(formatMessage(t.dashboard.socialMedia.disconnectSuccess, { platform: 'TikTok' }));
    } catch (error) {
      console.error('Error disconnecting TikTok:', error);
      alert(formatMessage(t.dashboard.socialMedia.disconnectError, { platform: 'TikTok' }));
    } finally {
      setIsDisconnectingTiktok(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    if (!user) return;

    const confirmed = confirm(formatMessage(t.dashboard.socialMedia.disconnectConfirm, { platform: 'Instagram' }));
    if (!confirmed) return;

    setIsDisconnectingInstagram(true);

    try {
      // Remove from localStorage
      localStorage.removeItem('instagram_connection');
      
      setInstagramConnected(false);
      setInstagramUsername(null);
      alert(formatMessage(t.dashboard.socialMedia.disconnectSuccess, { platform: 'Instagram' }));
    } catch (error) {
      console.error('Error disconnecting Instagram:', error);
      alert(formatMessage(t.dashboard.socialMedia.disconnectError, { platform: 'Instagram' }));
    } finally {
      setIsDisconnectingInstagram(false);
    }
  };

  const handleDisconnectYoutube = async () => {
    if (!user) return;

    const confirmed = confirm(formatMessage(t.dashboard.socialMedia.disconnectConfirm, { platform: 'YouTube' }));
    if (!confirmed) return;

    setIsDisconnectingYoutube(true);

    try {
      // Remove from localStorage
      localStorage.removeItem('youtube_connection');
      
      setYoutubeConnected(false);
      setYoutubeChannelTitle(null);
      setYoutubeThumbnail(null);
      alert(formatMessage(t.dashboard.socialMedia.disconnectSuccess, { platform: 'YouTube' }));
    } catch (error) {
      console.error('Error disconnecting YouTube:', error);
      alert(formatMessage(t.dashboard.socialMedia.disconnectError, { platform: 'YouTube' }));
    } finally {
      setIsDisconnectingYoutube(false);
    }
  };

  // Calculate total steps based on video type
  const totalSteps = 4; // Both gameplay and AI images have 4 steps now (script auto-generated)
  
  // Step labels
  const getStepLabel = (step: number) => {
    if (videoType === "ai-images") {
      switch (step) {
        case 1: return t.steps.videoType;
        case 2: return t.steps.categoryDuration;
        case 3: return t.steps.voiceSettings;
        case 4: return t.steps.artStyle;
        default: return "";
      }
    } else {
      switch (step) {
        case 1: return t.steps.videoType;
        case 2: return t.steps.categoryDuration;
        case 3: return t.steps.voiceSettings;
        case 4: return "Background Video";
        default: return "";
      }
    }
  };

  // Load mock payload from localStorage on mount
  useEffect(() => {
    const savedMock = localStorage.getItem("ai-video-mock-payload");
    if (savedMock) {
      setMockPayload(savedMock);
    }
  }, []);

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

    // Play the new voice preview with language
    const audio = new Audio(`/voice-samples/${language}/${voiceName}.mp3`);
    voicePreviewRef.current = audio;
    
    audio.play().catch((error) => {
      console.error('Error playing voice preview:', error);
      alert(formatMessage(t.messages.voicePreviewError, { voice: voiceName, language }));
    });

    setPlayingVoicePreview(voiceName);

    // Reset when audio ends
    audio.onended = () => {
      setPlayingVoicePreview(null);
    };
  };

  const handleGenerate = async () => {
    if (!user) {
      alert(t.messages.signInRequired);
      router.push("/login");
      return;
    }
    
    setIsGenerating(true);
    setVideoUrl(null);

    try {
      if (videoType === "ai-images") {
        // AI Images flow
        let aiData: {
          script: string;
          audioUrl: string;
          subtitles: string;
          generatedImages: string[];
          audioDuration: number;
        };
        
        // Check if we should use mock data
        if (useMockData && mockPayload) {
          console.log("Using mock data instead of calling Edge Function");
          try {
            aiData = JSON.parse(mockPayload);
          } catch (e) {
            throw new Error("Invalid mock payload JSON");
          }
        } else {
          // 1. Generate Script + Audio + Subtitles + Image Prompts via Supabase Edge Function
          const { data, error: aiError } = await supabase.functions.invoke("generate-ai-video", {
            body: { category, prompt: customPrompt, duration, language, voice, artStyle },
          });

          // Check for insufficient credits error in response data
          if (data?.code === "INSUFFICIENT_CREDITS" || data?.error?.includes("credits") || data?.error?.includes("subscription")) {
            throw new Error("INSUFFICIENT_CREDITS");
          }
          
          if (aiError) {
            // Check if it's a credits-related error
            if (aiError.message?.includes("402") || aiError.message?.includes("non-2xx")) {
              throw new Error("INSUFFICIENT_CREDITS");
            }
            throw aiError;
          }
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
        
        // Store the generated script for display if needed
        if (aiData.script) {
          setScript(aiData.script);
        }

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
        // 1. Generate Script + Audio + Subtitles via Supabase Edge Function
        const { data: audioData, error: audioError } = await supabase.functions.invoke("generate-video", {
          body: { category, prompt: customPrompt, duration, language, voice },
        });

        // Check for insufficient credits error in response data
        if (audioData?.code === "INSUFFICIENT_CREDITS" || audioData?.error?.includes("credits") || audioData?.error?.includes("subscription")) {
          throw new Error("INSUFFICIENT_CREDITS");
        }
        
        if (audioError) {
          // Check if it's a credits-related error
          if (audioError.message?.includes("402") || audioError.message?.includes("non-2xx")) {
            throw new Error("INSUFFICIENT_CREDITS");
          }
          throw audioError;
        }
        if (!audioData?.audioUrl) {
          throw new Error("Failed to generate audio");
        }
        
        const currentAudioUrl = audioData.audioUrl;
        const subtitles = audioData.subtitles || "";
        setAudioUrl(currentAudioUrl);
        
        // Store the generated script for display if needed
        if (audioData.script) {
          setScript(audioData.script);
        }

        // 2. Merge Video using local API (FFmpeg requires server)
        const selectedBackgroundVideo = BACKGROUND_VIDEOS.find(bg => bg.value === backgroundVideo);
        const backgroundVideoUrl = selectedBackgroundVideo?.url || BACKGROUND_VIDEOS[0].url;
        
        const response = await fetch("/api/merge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audioUrl: currentAudioUrl,
            subtitles: subtitles,
            backgroundVideoUrl: backgroundVideoUrl,
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
    } catch (error: unknown) {
      console.error("Error generating video:", error);
      
      // Check for insufficient credits error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isCreditsError = errorMessage === "INSUFFICIENT_CREDITS" ||
                            errorMessage.includes("Insufficient credits") || 
                            errorMessage.includes("No active subscription") ||
                            errorMessage.includes("not active") ||
                            errorMessage.includes("402") ||
                            errorMessage.includes("non-2xx");
      
      if (isCreditsError) {
        setErrorDialog({
          isOpen: true,
          type: "credits",
          title: t.errors?.insufficientCredits?.title || "Insufficient Credits",
          message: t.errors?.insufficientCredits?.message || "You don't have enough credits to generate this video. Please upgrade your plan or wait for your credits to refresh.",
        });
      } else {
        setErrorDialog({
          isOpen: true,
          type: "error",
          title: t.errors?.generic?.title || "Something went wrong",
          message: t.errors?.generic?.message || "An error occurred while generating your video. Please try again.",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleVideoTypeChange = (type: "gameplay" | "ai-images") => {
    setVideoType(type);
    // Reset step if changing video type
    if (currentStep > 1) {
      setCurrentStep(1);
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setVideoUrl(null);
    setScript("");
    setShowPostPanel(false);
    setPostTitle("");
    setPostDescription("");
    setPostHashtags("#viral #fyp #trending");
  };

  const handlePostToSocial = async (platform: string) => {
    if (!videoUrl) {
      alert("No video to post");
      return;
    }

    // Get connection data from localStorage
    let connectionData;
    let accessToken;
    let refreshToken;

    switch (platform) {
      case 'tiktok':
        connectionData = localStorage.getItem('tiktok_connection');
        if (!connectionData) {
          alert("Please connect your TikTok account first in the Social Media section");
          return;
        }
        accessToken = JSON.parse(connectionData).access_token;
        break;
      case 'instagram':
        connectionData = localStorage.getItem('instagram_connection');
        if (!connectionData) {
          alert("Please connect your Instagram account first in the Social Media section");
          return;
        }
        accessToken = JSON.parse(connectionData).access_token;
        break;
      case 'youtube':
        connectionData = localStorage.getItem('youtube_connection');
        if (!connectionData) {
          alert("Please connect your YouTube account first in the Social Media section");
          return;
        }
        const youtubeData = JSON.parse(connectionData);
        accessToken = youtubeData.access_token;
        refreshToken = youtubeData.refresh_token;
        break;
      default:
        alert("Platform not supported yet");
        return;
    }

    setPostingTo(platform);

    try {
      // Convert video URL to absolute URL
      const absoluteVideoUrl = videoUrl.startsWith('http') 
        ? videoUrl 
        : `${window.location.origin}${videoUrl}`;

      const hashtags = postHashtags.split(' ').filter(tag => tag.trim());

      const response = await fetch('/api/post-to-social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          videoUrl: absoluteVideoUrl,
          accessToken,
          refreshToken,
          title: postTitle || 'Amazing Viral Video',
          description: postDescription,
          hashtags,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post');
      }

      const data = await response.json();
      
      if (platform === 'youtube' && data.url) {
        alert(`✅ Successfully posted to YouTube!\n\nView at: ${data.url}`);
      } else if (platform === 'tiktok') {
        alert(`✅ Successfully posted to TikTok!\n\nYour video is being processed.`);
      } else {
        alert(`✅ Successfully posted to ${platform}!`);
      }

      setShowPostPanel(false);
    } catch (error) {
      console.error('Error posting to social media:', error);
      alert(`Failed to post to ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPostingTo(null);
    }
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-xl font-semibold">{t.steps.selectVideoType}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.steps.selectVideoTypeDesc}</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => handleVideoTypeChange("gameplay")}
                  className={`w-full flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all ${
                    videoType === "gameplay"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                  }`}
                >
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                    videoType === "gameplay"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                  }`}>
                    <Gamepad2 className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-lg">{t.form.gameplay}</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t.form.gameplayDesc}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewVideoType("gameplay");
                  }}
                  className="absolute top-2 right-2 p-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                  title="View example"
                >
                  <Info className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                </button>
              </div>
              
              <div className="relative">
                <button
                  type="button"
                  onClick={() => handleVideoTypeChange("ai-images")}
                  className={`w-full flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all ${
                    videoType === "ai-images"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                  }`}
                >
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                    videoType === "ai-images"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                  }`}>
                    <Image className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-lg">{t.form.aiImages}</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t.form.aiImagesDesc}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewVideoType("ai-images");
                  }}
                  className="absolute top-2 right-2 p-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                  title="View example"
                >
                  <Info className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                </button>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">{t.steps.chooseCategoryDuration}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.steps.chooseCategoryDurationDesc}</p>
            </div>
            
            {/* Category Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">{t.form.category}</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(CATEGORY_ICONS).map(([key, icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      category === key
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      category === key
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}>
                      {icon}
                    </div>
                    <span className={`text-xs font-medium text-center leading-tight ${
                      category === key ? "text-blue-700 dark:text-blue-300" : ""
                    }`}>
                      {t.categories[key as keyof typeof t.categories]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">{t.form.duration}</label>
              <div className="grid grid-cols-2 gap-3">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDuration(opt.value)}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      duration === opt.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }`}
                  >
                    {/* Monetizable badge */}
                    {opt.monetizable && (
                      <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500 text-white text-[10px] font-semibold shadow-sm">
                        <DollarSign className="w-3 h-3" />
                        <span>{t.steps.monetizable}</span>
                      </div>
                    )}
                    
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      duration === opt.value
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}>
                      <Clock className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <div className={`text-lg font-bold ${
                        duration === opt.value ? "text-blue-700 dark:text-blue-300" : ""
                      }`}>
                        {opt.label}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t.durations[opt.value as keyof typeof t.durations]}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center flex items-center justify-center gap-1">
                <DollarSign className="w-3 h-3 text-green-500" />
                {t.steps.monetizableHint}
              </p>
            </div>
          </div>
        );

      case 3:
        // Voice step for both Gameplay and AI Images
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-xl font-semibold">{t.steps.chooseVoice}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.steps.chooseVoiceDesc}</p>
            </div>
            
            <div className="space-y-4">
              {/* Language Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.form.voiceLanguage}</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  {Object.entries(LANGUAGE_FLAGS).map(([code, flag]) => (
                    <option key={code} value={code}>
                      {flag} {t.languages[code as keyof typeof t.languages]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Voice Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.form.narratorVoice}</label>
                <div className="grid grid-cols-3 gap-2">
                  {VOICES.map((v) => (
                    <div key={v} className="relative">
                      <button
                        type="button"
                        onClick={() => setVoice(v)}
                        className={`w-full px-3 py-3 pr-8 text-sm capitalize rounded-lg border transition-all ${
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
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded transition-colors ${
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
            </div>
          </div>
        );

      case 4:
        // Background Video step for Gameplay, Art Style step for AI Images
        if (videoType === "gameplay") {
          return (
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-8">
                <h3 className="text-xl font-semibold">Choose Background Video</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Select the background video for your gameplay video</p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {BACKGROUND_VIDEOS.map((bgVideo) => (
                  <button
                    key={bgVideo.value}
                    type="button"
                    onClick={() => setBackgroundVideo(bgVideo.value)}
                    className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                      backgroundVideo === bgVideo.value
                        ? "border-blue-500 ring-2 ring-blue-500/50"
                        : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div className="aspect-[9/16] relative">
                      <NextImage
                        src={bgVideo.preview}
                        alt={bgVideo.value}
                        fill
                        className="object-cover"
                      />
                      {backgroundVideo === bgVideo.value && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={`p-2 text-center text-sm font-medium ${
                      backgroundVideo === bgVideo.value
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}>
                      {bgVideo.label || bgVideo.value.charAt(0).toUpperCase() + bgVideo.value.slice(1)}
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Optional Custom Prompt */}
              <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <label className="text-sm font-medium">{t.form.customPrompt || "Custom Prompt (optional)"}</label>
                <textarea 
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={t.form.customPromptPlaceholder || "Add specific details for your video..."}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[80px] resize-none text-sm"
                />
              </div>
            </div>
          );
        } else {
          // Art Style step for AI Images
          return (
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-8">
                <h3 className="text-xl font-semibold">{t.steps.chooseArtStyle}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.steps.chooseArtStyleDesc}</p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {ART_STYLES.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => setArtStyle(style.value)}
                    className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                      artStyle === style.value
                        ? "border-blue-500 ring-2 ring-blue-500/50"
                        : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div className="aspect-[3/4] relative">
                      <NextImage
                        src={style.preview}
                        alt={t.artStyles[style.value as keyof typeof t.artStyles]}
                        fill
                        className="object-cover"
                      />
                      {artStyle === style.value && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={`p-2 text-center text-sm font-medium ${
                      artStyle === style.value
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}>
                      {t.artStyles[style.value as keyof typeof t.artStyles]}
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Optional Custom Prompt */}
              <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <label className="text-sm font-medium">{t.form.customPrompt || "Custom Prompt (optional)"}</label>
                <textarea 
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={t.form.customPromptPlaceholder || "Add specific details for your video..."}
                  className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[80px] resize-none text-sm"
                />
              </div>
            </div>
          );
        }

      default:
        return null;
    }
  };


  const renderSocialMediaPage = () => (
    <div className="max-w-4xl w-full">
      <div className="space-y-6">
        <div className="text-center space-y-2 mb-8">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Link2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold">{t.dashboard.socialMedia.title}</h2>
          <p className="text-zinc-500 dark:text-zinc-400">{t.dashboard.socialMedia.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TikTok */}
          <div className={`p-6 rounded-xl border-2 transition-all ${
            tiktokConnected 
              ? "border-green-500 dark:border-green-500 bg-green-50 dark:bg-green-900/10" 
              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
          }`}>
            <div className="flex items-center gap-4 mb-4">
              {tiktokAvatar ? (
                <NextImage 
                  src={tiktokAvatar} 
                  alt="TikTok Avatar"
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">TT</span>
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">TikTok</h3>
                {tiktokConnected ? (
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      @{tiktokUsername}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t.dashboard.socialMedia.notConnected}
                  </p>
                )}
              </div>
            </div>
            {tiktokConnected ? (
              <button 
                onClick={handleDisconnectTiktok}
                disabled={isDisconnectingTiktok}
                className="w-full px-4 py-2 rounded-lg border-2 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {isDisconnectingTiktok ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.dashboard.socialMedia.disconnecting}
                  </span>
                ) : (
                  t.dashboard.socialMedia.disconnect
                )}
              </button>
            ) : (
              <button 
                onClick={handleConnectTiktok}
                disabled={isConnectingTiktok}
                className="w-full px-4 py-2 rounded-lg bg-black text-white font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {isConnectingTiktok ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.dashboard.socialMedia.connecting}
                  </span>
                ) : (
                  t.dashboard.socialMedia.connect
                )}
              </button>
            )}
          </div>

          {/* Instagram */}
          <div className={`p-6 rounded-xl border-2 transition-all ${
            instagramConnected 
              ? "border-green-500 dark:border-green-500 bg-green-50 dark:bg-green-900/10" 
              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
          }`}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">IG</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Instagram</h3>
                {instagramConnected ? (
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      @{instagramUsername}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t.dashboard.socialMedia.notConnected}
                  </p>
                )}
              </div>
            </div>
            {instagramConnected ? (
              <button 
                onClick={handleDisconnectInstagram}
                disabled={isDisconnectingInstagram}
                className="w-full px-4 py-2 rounded-lg border-2 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {isDisconnectingInstagram ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.dashboard.socialMedia.disconnecting}
                  </span>
                ) : (
                  t.dashboard.socialMedia.disconnect
                )}
              </button>
            ) : (
              <button 
                onClick={handleConnectInstagram}
                disabled={isConnectingInstagram}
                className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:from-purple-700 hover:to-pink-700 transition-colors disabled:opacity-50"
              >
                {isConnectingInstagram ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.dashboard.socialMedia.connecting}
                  </span>
                ) : (
                  t.dashboard.socialMedia.connect
                )}
              </button>
            )}
          </div>

          {/* YouTube */}
          <div className={`p-6 rounded-xl border-2 transition-all ${
            youtubeConnected 
              ? "border-green-500 dark:border-green-500 bg-green-50 dark:bg-green-900/10" 
              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
          }`}>
            <div className="flex items-center gap-4 mb-4">
              {youtubeThumbnail ? (
                <NextImage 
                  src={youtubeThumbnail} 
                  alt="YouTube Channel"
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">YT</span>
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">YouTube</h3>
                {youtubeConnected ? (
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      {youtubeChannelTitle}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t.dashboard.socialMedia.notConnected}
                  </p>
                )}
              </div>
            </div>
            {youtubeConnected ? (
              <button 
                onClick={handleDisconnectYoutube}
                disabled={isDisconnectingYoutube}
                className="w-full px-4 py-2 rounded-lg border-2 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {isDisconnectingYoutube ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.dashboard.socialMedia.disconnecting}
                  </span>
                ) : (
                  t.dashboard.socialMedia.disconnect
                )}
              </button>
            ) : (
              <button 
                onClick={handleConnectYoutube}
                disabled={isConnectingYoutube}
                className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isConnectingYoutube ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.dashboard.socialMedia.connecting}
                  </span>
                ) : (
                  t.dashboard.socialMedia.connect
                )}
              </button>
            )}
          </div>

          {/* Facebook */}
          <div className="p-6 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">FB</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Facebook</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.dashboard.socialMedia.notConnected}</p>
              </div>
            </div>
            <button className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors">
              {t.dashboard.socialMedia.connect}
            </button>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t.dashboard.socialMedia.description}
          </p>
        </div>
      </div>
    </div>
  );

  const handleSectionChange = (section: DashboardSection) => {
    setActiveSection(section);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-foreground flex flex-col">
      <Navbar onLogoClick={() => resetWizard()} />

      {/* Main Content with Sidebar */}
      <div className="flex-1 flex relative">
        {/* Mobile Sidebar Toggle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden fixed bottom-4 right-4 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
          aria-label="Toggle menu"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 md:hidden" 
            onClick={() => setIsSidebarOpen(false)} 
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-40 
          w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          md:transform-none
        `}>
          <div className="pt-16 md:pt-0 space-y-2">
            <button
              onClick={() => handleSectionChange("video-creation")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                activeSection === "video-creation"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Video className={`w-5 h-5 ${activeSection === "video-creation" ? "text-blue-600 dark:text-blue-400" : ""}`} />
              <span>{t.dashboard.menu.videoCreation}</span>
            </button>

            <button
              onClick={() => handleSectionChange("social-media")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                activeSection === "social-media"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Link2 className={`w-5 h-5 ${activeSection === "social-media" ? "text-blue-600 dark:text-blue-400" : ""}`} />
              <span>{t.dashboard.menu.socialMedia}</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-6 md:py-8 overflow-y-auto">
          {activeSection === "video-creation" ? (
            /* Multi-step Wizard */
            <div className="max-w-2xl w-full">
          {!videoUrl ? (
            <>
              {/* Header */}
              <div className="text-center space-y-2 mb-8">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Video className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold">{t.form.title}</h2>
                <p className="text-zinc-500 dark:text-zinc-400">{t.form.subtitle}</p>
              </div>

              {/* Progress Steps */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                          step < currentStep
                            ? "bg-blue-600 text-white"
                            : step === currentStep
                            ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/50"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                        }`}
                      >
                        {step < currentStep ? <Check className="w-4 h-4" /> : step}
                      </div>
                      {step < totalSteps && (
                        <div className={`flex-1 h-1 mx-2 rounded transition-all ${
                          step < currentStep
                            ? "bg-blue-600"
                            : "bg-zinc-200 dark:bg-zinc-700"
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {t.steps.stepOf.replace("{current}", currentStep.toString()).replace("{total}", totalSteps.toString())} - {getStepLabel(currentStep)}
                </div>
              </div>

              {/* Step Content */}
              <div className="min-h-[300px]">
                {renderStepContent()}
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                    currentStep === 1
                      ? "opacity-50 cursor-not-allowed text-zinc-400"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t.steps.back}
                </button>

                {currentStep < totalSteps ? (
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all"
                  >
                    {t.steps.next}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t.form.generating}
                      </>
                    ) : (
                      <>
                        {t.form.createVideo}
                        <Sparkles className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          ) : (
            // Video Result
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-6">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold">{t.steps.videoReady}</h2>
                <p className="text-zinc-500 dark:text-zinc-400">{t.steps.videoReadyDesc}</p>
              </div>
              
              <div className="relative aspect-[9/16] max-h-[500px] mx-auto bg-black rounded-xl overflow-hidden shadow-inner border border-zinc-800">
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-contain"
                />
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={resetWizard}
                  className="flex-1 h-11 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium transition-all"
                >
                  {t.form.generateAnother}
                </button>
                <a 
                  href={videoUrl} 
                  download="viral-video.mp4"
                  className="flex-1 h-11 flex items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition-all"
                >
                  {t.form.download}
                </a>
              </div>

              {/* Post to Social Media Button */}
              <button
                onClick={() => setShowPostPanel(!showPostPanel)}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-all shadow-sm"
              >
                <Share2 className="w-5 h-5" />
                Post to Social Media
              </button>

              {/* Social Media Post Panel */}
              {showPostPanel && (
                <div className="p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Share2 className="w-5 h-5" />
                    Share Your Video
                  </h3>

                  {/* Post Details Form */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium block mb-1.5">Title</label>
                      <input
                        type="text"
                        value={postTitle}
                        onChange={(e) => setPostTitle(e.target.value)}
                        placeholder="Amazing viral video..."
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium block mb-1.5">Description (optional)</label>
                      <textarea
                        value={postDescription}
                        onChange={(e) => setPostDescription(e.target.value)}
                        placeholder="Add a description..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium block mb-1.5">Hashtags</label>
                      <input
                        type="text"
                        value={postHashtags}
                        onChange={(e) => setPostHashtags(e.target.value)}
                        placeholder="#viral #fyp #trending"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Platform Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {/* TikTok */}
                    <button
                      onClick={() => handlePostToSocial('tiktok')}
                      disabled={!tiktokConnected || postingTo !== null}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        tiktokConnected
                          ? 'border-zinc-300 dark:border-zinc-700 hover:border-black dark:hover:border-white hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          : 'border-zinc-200 dark:border-zinc-800 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">TT</span>
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-sm">TikTok</div>
                          {tiktokConnected ? (
                            postingTo === 'tiktok' ? (
                              <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Posting...
                              </div>
                            ) : (
                              <div className="text-xs text-green-600 dark:text-green-400">Connected</div>
                            )
                          ) : (
                            <div className="text-xs text-zinc-500">Not connected</div>
                          )}
                        </div>
                        {tiktokConnected && postingTo !== 'tiktok' && <Send className="w-4 h-4 text-zinc-400" />}
                      </div>
                    </button>

                    {/* YouTube */}
                    <button
                      onClick={() => handlePostToSocial('youtube')}
                      disabled={!youtubeConnected || postingTo !== null}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        youtubeConnected
                          ? 'border-zinc-300 dark:border-zinc-700 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10'
                          : 'border-zinc-200 dark:border-zinc-800 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">YT</span>
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-sm">YouTube</div>
                          {youtubeConnected ? (
                            postingTo === 'youtube' ? (
                              <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Posting...
                              </div>
                            ) : (
                              <div className="text-xs text-green-600 dark:text-green-400">Connected</div>
                            )
                          ) : (
                            <div className="text-xs text-zinc-500">Not connected</div>
                          )}
                        </div>
                        {youtubeConnected && postingTo !== 'youtube' && <Send className="w-4 h-4 text-zinc-400" />}
                      </div>
                    </button>

                    {/* Instagram */}
                    <button
                      onClick={() => handlePostToSocial('instagram')}
                      disabled={!instagramConnected || postingTo !== null}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        instagramConnected
                          ? 'border-zinc-300 dark:border-zinc-700 hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/10'
                          : 'border-zinc-200 dark:border-zinc-800 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">IG</span>
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-sm">Instagram</div>
                          {instagramConnected ? (
                            postingTo === 'instagram' ? (
                              <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Posting...
                              </div>
                            ) : (
                              <div className="text-xs text-orange-600 dark:text-orange-400">Coming soon</div>
                            )
                          ) : (
                            <div className="text-xs text-zinc-500">Not connected</div>
                          )}
                        </div>
                        {instagramConnected && postingTo !== 'instagram' && <Send className="w-4 h-4 text-zinc-400 opacity-50" />}
                      </div>
                    </button>

                    {/* Facebook - Coming Soon */}
                    <button
                      disabled={true}
                      className="p-4 rounded-lg border-2 border-zinc-200 dark:border-zinc-800 opacity-50 cursor-not-allowed"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">FB</span>
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-sm">Facebook</div>
                          <div className="text-xs text-zinc-500">Coming soon</div>
                        </div>
                      </div>
                    </button>
                  </div>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center pt-2">
                    Connect accounts in the Social Media section to post
                  </p>
                </div>
              )}
            </div>
          )}
            </div>
          ) : (
            renderSocialMediaPage()
          )}
        </main>
      </div>

      {/* Preview Video Dialog */}
      {previewVideoType && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewVideoType(null)}
        >
          <div 
            className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {previewVideoType === "gameplay" ? t.form.gameplay : t.form.aiImages}
              </h3>
              <button
                onClick={() => setPreviewVideoType(null)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </button>
            </div>

            {/* Video Preview */}
            <div className="flex items-center justify-center">
              <video
                src={previewVideoType === "gameplay" 
                  ? "/videos/category_examples/preview_background.mp4"
                  : "/videos/category_examples/preview_full_ai.mp4"
                }
                controls
                autoPlay
                loop
                className="max-h-[calc(90vh-80px)] w-auto"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error Dialog */}
      {errorDialog?.isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setErrorDialog(null)}
        >
          <div 
            className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-w-md w-full animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  errorDialog.type === "credits" 
                    ? "bg-amber-100 dark:bg-amber-900/30" 
                    : "bg-red-100 dark:bg-red-900/30"
                }`}>
                  {errorDialog.type === "credits" ? (
                    <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {errorDialog.title}
                </h3>
              </div>
              <button
                onClick={() => setErrorDialog(null)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                {errorDialog.message}
              </p>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setErrorDialog(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t.form?.close || "Close"}
                </button>
                {errorDialog.type === "credits" && (
                  <button
                    onClick={() => {
                      setErrorDialog(null);
                      router.push("/pricing");
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    {t.form?.upgradePlan || "Upgrade Plan"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

