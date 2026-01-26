// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Access API Keys from environment variables
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  text: string;
  voice?: string;
}

// Validate user has enough credits and deduct 1 token
async function validateAndDeductCredits(
  authHeader: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: "Supabase environment variables are not set" };
  }

  // Create client with user's auth token (RLS will use user_id automatically)
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  // Validate token and get user
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Invalid or expired token" };
  }

  // Check user's credits_balance in subscriptions table (RLS filters by user_id)
  const { data: subscription, error: subError } = await supabaseClient
    .from("subscriptions")
    .select("id, credits_balance, status")
    .eq("user_id", user.id)
    .single();

  if (subError || !subscription) {
    console.log(`❌ [CREDITS] No subscription found for user ${user.id}`);
    return { success: false, error: "No active subscription found. Please subscribe to generate videos." };
  }

  // Check if subscription is active
  if (subscription.status !== "active") {
    console.log(`❌ [CREDITS] Subscription not active for user ${user.id}. Status: ${subscription.status}`);
    return { success: false, error: "Your subscription is not active. Please renew to generate videos." };
  }

  // Check if user has enough credits
  if (subscription.credits_balance < 1) {
    console.log(`❌ [CREDITS] Insufficient credits for user ${user.id}. Balance: ${subscription.credits_balance}`);
    return { success: false, error: "Insufficient credits. Please wait for your next billing cycle or upgrade your plan." };
  }

  // Deduct 1 credit (RLS ensures user can only update their own subscription)
  const newBalance = subscription.credits_balance - 1;
  const { error: updateError } = await supabaseClient
    .from("subscriptions")
    .update({ credits_balance: newBalance })
    .eq("id", subscription.id);

  if (updateError) {
    console.log(`❌ [CREDITS] Failed to deduct credit for user ${user.id}:`, updateError);
    return { success: false, error: "Failed to process credits. Please try again." };
  }

  console.log(`✅ [CREDITS] Deducted 1 credit for user ${user.id}. New balance: ${newBalance}`);
  return { success: true, userId: user.id };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Validate credits and deduct 1 token before proceeding
    const creditsResult = await validateAndDeductCredits(authHeader);
    if (!creditsResult.success) {
      return new Response(
        JSON.stringify({ 
          error: creditsResult.error,
          code: "INSUFFICIENT_CREDITS"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 402, // Payment Required
        }
      );
    }

    console.log(`🎬 [GENERATE-VIDEO] Starting video generation for user ${creditsResult.userId}`);

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

