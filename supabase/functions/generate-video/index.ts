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

    const { category, prompt, duration, language = 'en', voice }: RequestBody = await req.json();

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    if (!category) {
      throw new Error("Category is required");
    }

    // Language name mapping
    const languageNames: { [key: string]: string } = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'pt': 'Portuguese',
      'it': 'Italian',
      'nl': 'Dutch',
      'pl': 'Polish',
      'ru': 'Russian',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'tr': 'Turkish',
      'sv': 'Swedish',
      'da': 'Danish',
      'no': 'Norwegian',
      'fi': 'Finnish',
      'id': 'Indonesian',
      'vi': 'Vietnamese',
      'th': 'Thai',
      'uk': 'Ukrainian',
      'cs': 'Czech',
      'ro': 'Romanian',
    };

    const languageName = languageNames[language] || 'English';

    // Estimate word count based on duration (approx. 150 words per minute for normal speech)
    const durationNum = typeof duration === 'string' ? parseInt(duration) : (duration || 30);
    const wordCount = Math.round((durationNum / 60) * 150);

    let specificInstructions = "";
    
    if (category === "reddit") {
      specificInstructions = `
      You are narrating a viral Reddit story (like r/AskReddit, r/TIFU, or r/confession).
      Start immediately with a hook like "I accidentally..." or "My boss fired me because..." or "TIFU by...".
      Do not say "Here is a story" or "Welcome to Reddit". Just jump straight into the first-person narration.
      The tone should be conversational, slightly dramatic, and engaging, like someone telling a crazy story to a friend.
      Keep it strictly first-person ("I did this", "She told me").
      `;
    } else if (category === "reddit-relationship") {
      specificInstructions = `
      You are narrating a viral Reddit Relationship story (like r/relationships, r/AITAH, or r/marriage).
      START IMMEDIATELY with the format: "Me [Age][Gender] and my [Relation] [Age][Gender]..." (e.g., "Me 23M and my girlfriend 24F were having...").
      Focus on relationship drama, confessions, or wholesome moments.
      The tone should be personal, confessional, and engaging.
      Keep it strictly first-person.
      Do NOT include title or intro like "Here is a relationship story". Start directly with the "Me [Age][Gender]..." hook.
      `;
    }

    const systemPrompt = `You are a narrator speaking in a continuous, single-voice monologue designed for text-to-speech. 
    You never include dialogue between multiple characters. You never switch perspectives or include more than one speaking voice. 
    Everything you say must sound like a narrated story, explanation, reflection, or spoken thought. 
    You may tell stories, jokes, descriptions, or explanations—but always as a solo narrator talking directly to the listener. 
    No character conversations, no quotes, no role-playing other voices. 
    Your tone should be clear, expressive, and naturally paced for TTS. 
    You may create vivid imagery and emotion, but always through narration alone.

    The content must be highly engaging and viral-worthy for TikTok/Reels/Shorts.
    ${specificInstructions}
    
    IMPORTANT: You MUST write the entire script in ${languageName}. Every single word must be in ${languageName}.
    
    Target Duration: ${durationNum} seconds (approx ${wordCount} words).
    Category: ${category}
    User Prompt: ${prompt || "Create something relevant to the category"}
    
    Output ONLY the raw spoken text in ${languageName}. Do not include any scene directions, sound effects, or intro/outro labels.`;

    // 1. Generate Script with GPT-4o
    console.log("Generating script...");
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
    
    if (scriptData.error) {
      console.error("OpenAI API Error:", scriptData.error);
      throw new Error(scriptData.error.message || "Failed to generate script via OpenAI");
    }

    const text = scriptData.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error("Failed to generate script");
    }

    console.log("Script generated successfully");

    // 3. Generate Audio with OpenAI TTS
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

    // 4. Generate Subtitles with Whisper
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
        script: text,
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

