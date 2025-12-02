import { NextResponse } from "next/server";
import OpenAI from "openai";

// Toggle this to switch between mock and real API calls
const USE_MOCK = false;

// Mock API Key for development
const OPENAI_API_KEY = "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" // process.env.OPENAI_API_KEY || "sk-mock-api-key";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { category, prompt } = await request.json();

    // Construct a prompt based on user input
    const videoPrompt = prompt 
      ? prompt 
      : `A short 3-second viral video about ${category}. Cinematic, high quality.`;

    console.log("Generating video with prompt:", videoPrompt);

    if (USE_MOCK) {
      // MOCK RESPONSE FOR MVP to save credits/work without real access yet
      // Simulating API delay
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Return a mock video URL (placeholder)
      const mockVideoUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

      return NextResponse.json({ url: mockVideoUrl });
    } else {
      // Real OpenAI Sora 2 API call
      const video = await openai.videos.create({
        model: "sora-2",
        prompt: videoPrompt,
        size: "720x1280",
      });

      console.log("Video created:", JSON.stringify(video, null, 2));

      // Try to get URL from video object (might be available even if not in types)
      const videoAny = video as any;
      if (videoAny.url) {
        return NextResponse.json({ url: videoAny.url, id: video.id, status: video.status });
      }

      // If video is completed, try to retrieve it to get the URL
      if (video.status === "completed") {
        try {
          const retrievedVideo = await openai.videos.retrieve(video.id);
          const retrievedAny = retrievedVideo as any;
          if (retrievedAny.url) {
            return NextResponse.json({ url: retrievedAny.url, id: video.id, status: video.status });
          }
        } catch (retrieveError) {
          console.error("Error retrieving video:", retrieveError);
        }
      }

      // If still no URL, return video info for polling
      return NextResponse.json({ 
        id: video.id, 
        status: video.status,
        model: video.model,
        seconds: video.seconds,
        message: video.status === "completed" 
          ? "Video completed but URL not available. Please try retrieving again."
          : "Video is being generated. Please poll using videos.retrieve(video.id)."
      });
    }

  } catch (error: any) {
    console.error("Error generating video:", error);
    const errorMessage = error?.message || error?.error?.message || "Failed to generate video";
    return NextResponse.json(
      { error: errorMessage, details: error?.response?.data || error },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json(
        { error: "Missing videoId parameter" },
        { status: 400 }
      );
    }

    if (USE_MOCK) {
      return NextResponse.json({ 
        status: "completed", 
        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" 
      });
    }

    const retrievedVideo = await openai.videos.retrieve(videoId);
    const retrievedAny = retrievedVideo as any;
    
    console.log("Polled video status:", retrievedVideo.status);

    if (retrievedAny.url) {
      return NextResponse.json({ 
        status: "completed", 
        url: retrievedAny.url 
      });
    }

    return NextResponse.json({ 
      status: retrievedVideo.status,
      message: "Video is still processing"
    });

  } catch (error: any) {
    console.error("Error polling video:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to poll video status" },
      { status: 500 }
    );
  }
}

