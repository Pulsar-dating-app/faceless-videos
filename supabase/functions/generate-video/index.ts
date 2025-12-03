// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Access OpenAI API Key from environment variables
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  text: string;
  voice?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, voice }: RequestBody = await req.json();

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    if (!text) {
      throw new Error("Text is required");
    }

    // 1. Generate Audio with OpenAI TTS
    console.log("Generating audio...");
    const audioResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: voice || "alloy",
        input: text,
      }),
    });

    if (!audioResponse.ok) {
      const errorData = await audioResponse.json();
      throw new Error(errorData.error?.message || "Failed to generate audio");
    }

    // Get audio as ArrayBuffer and convert to base64
    // Using chunked approach to avoid call stack overflow on large files
    const audioArrayBuffer = await audioResponse.arrayBuffer();
    const uint8Array = new Uint8Array(audioArrayBuffer);
    
    // Convert to base64 in chunks to avoid stack overflow
    let binaryString = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const audioBase64 = btoa(binaryString);
    const audioUrl = `data:audio/mp3;base64,${audioBase64}`;

    console.log("Audio generated successfully");

    // 2. Generate Subtitles with Whisper
    console.log("Generating subtitles...");
    let srtContent = "";
    
    try {
      // Create a Blob from the audio data for the transcription request
      const audioBlob = new Blob([audioArrayBuffer], { type: "audio/mp3" });
      
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.mp3");
      formData.append("model", "whisper-1");
      formData.append("response_format", "srt");

      const transcriptionResponse = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: formData,
        }
      );

      if (transcriptionResponse.ok) {
        srtContent = await transcriptionResponse.text();
        console.log("Subtitles generated successfully");
      } else {
        console.error("Whisper transcription failed, continuing without subtitles");
      }
    } catch (whisperError) {
      console.error("Error generating subtitles:", whisperError);
      // Continue without subtitles
    }

    return new Response(
      JSON.stringify({
        audioUrl,
        subtitles: srtContent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in generate-video:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

