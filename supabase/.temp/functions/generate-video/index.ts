// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Access API Keys from environment variables
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
);

interface RequestBody {
  category: string;
  prompt?: string;
  duration?: string | number;
  language?: string;
  voice?: string;
}

// Validate user has enough credits and deduct 1 token
async function validateAndDeductCredits(
  authHeader: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Invalid or expired token" };
  }

  const { data: subscription, error: subError } = await supabaseClient
    .from("subscriptions")
    .select("id, credits_balance, status")
    .eq("user_id", user.id)
    .single();

  if (subError || !subscription) {
    return { success: false, error: "No active subscription found." };
  }

  if (subscription.status !== "active") {
    return { success: false, error: "Subscription not active." };
  }

  if (subscription.credits_balance < 1) {
    return { success: false, error: "Insufficient credits." };
  }

  const { error: updateError } = await supabaseClient
    .from("subscriptions")
    .update({ credits_balance: subscription.credits_balance - 1 })
    .eq("id", subscription.id);

  if (updateError) {
    return { success: false, error: "Failed to process credits." };
  }

  return { success: true, userId: user.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const creditsResult = await validateAndDeductCredits(authHeader);
    if (!creditsResult.success) {
      return new Response(
        JSON.stringify({ error: creditsResult.error, code: "INSUFFICIENT_CREDITS" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
      );
    }

    const { category, prompt, duration, language = 'en', voice }: RequestBody = await req.json();

    const durationNum = typeof duration === 'string' ? parseInt(duration) : (duration || 30);
    const wordCount = Math.round((durationNum / 60) * 150);

    const systemPrompt = `
You are a narrator for viral short videos.
Target duration ${durationNum}s (~${wordCount} words).
Category: ${category}
User prompt: ${prompt || ""}
Write ONLY the narration text.
Language: ${language}.
`;

    // Generate script
    const scriptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }],
      }),
    });

    const scriptData = await scriptResponse.json();
    const text = scriptData.choices?.[0]?.message?.content;

    if (!text) throw new Error("Script generation failed");

    // Generate audio
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
      const err = await audioResponse.text();
      throw new Error(err);
    }

    const audioArrayBuffer = await audioResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioArrayBuffer);

    // Upload to Supabase Storage
    const filePath = `tts/${creditsResult.userId}/${Date.now()}.mp3`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("audios")
      .upload(filePath, audioBytes, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("audios")
      .getPublicUrl(filePath);

    const audioUrl = publicUrlData.publicUrl;

    // Generate subtitles with Whisper
    let srtContent = "";
    try {
      const audioBlob = new Blob([audioArrayBuffer], { type: "audio/mp3" });

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.mp3");
      formData.append("model", "whisper-1");
      formData.append("response_format", "srt");

      const transcriptionResponse = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
          body: formData,
        }
      );

      if (transcriptionResponse.ok) {
        srtContent = await transcriptionResponse.text();
      }
    } catch {}

    return new Response(
      JSON.stringify({
        script: text,
        audioUrl,
        subtitles: srtContent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
