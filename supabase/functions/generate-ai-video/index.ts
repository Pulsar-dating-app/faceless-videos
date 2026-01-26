// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Access API Keys from environment variables
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const FLUX_API_KEY = Deno.env.get("FLUX_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  text: string;
  voice?: string;
  artStyle: string;
}

interface ImagePrompt {
  order: number;
  prompt: string;
  timestamp: string;
}

interface GeneratedImage {
  order: number;
  prompt: string;
  timestamp: string;
  imageUrl: string;
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

    console.log(`🎬 [GENERATE-AI-VIDEO] Starting video generation for user ${creditsResult.userId}`);

    const { text, voice, artStyle }: RequestBody = await req.json();

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
    }

    // 3. Calculate number of images based on audio duration
    // Parse SRT to get the last timestamp (audio duration)
    let audioDurationSeconds = 30; // default fallback
    if (srtContent) {
      const timestampRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/g;
      const matches = [...srtContent.matchAll(timestampRegex)];
      if (matches.length > 0) {
        // Get the last timestamp (end time of last subtitle)
        const lastMatch = matches[matches.length - 1];
        const hours = parseInt(lastMatch[1]);
        const minutes = parseInt(lastMatch[2]);
        const seconds = parseInt(lastMatch[3]);
        const milliseconds = parseInt(lastMatch[4]);
        audioDurationSeconds = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
      }
    }
    
    // Calculate number of images: duration / 5 seconds per image
    const numberOfImages = Math.max(3, Math.ceil(audioDurationSeconds / 5));
    console.log(`Audio duration: ${audioDurationSeconds}s, generating ${numberOfImages} images`);

    // 4. Use GPT to break script into image generation prompts
    console.log("Generating image prompts...");
    
    const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a visual storytelling expert. Your task is to break down a script into exactly ${numberOfImages} sequential image prompts for AI image generation. Each image will be shown for approximately 5 seconds.

Each image prompt should:
1. Capture a key moment or scene from that part of the script
2. Be detailed enough for an AI image generator to create a compelling visual
3. Include the art style: "${artStyle}"
4. Be in a consistent visual style throughout
5. Include relevant details about composition, lighting, mood, and subject

Return your response as a JSON array with exactly ${numberOfImages} objects containing:
- "order": sequential number (1-${numberOfImages})
- "prompt": the detailed image generation prompt
- "timestamp": approximate relative timing (e.g., "0:00-0:05", "0:05-0:10")

IMPORTANT: Return ONLY the JSON array, no other text. Generate exactly ${numberOfImages} prompts.`
          },
          {
            role: "user",
            content: `Break this script into exactly ${numberOfImages} image prompts:\n\n${text}`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!gptResponse.ok) {
      const errorData = await gptResponse.json();
      throw new Error(errorData.error?.message || "Failed to generate image prompts");
    }

    const gptData = await gptResponse.json();
    const gptContent = gptData.choices[0]?.message?.content || "[]";
    
    // Parse the JSON response
    let imagePrompts: ImagePrompt[] = [];
    try {
      // Clean the response in case GPT wrapped it in markdown code blocks
      let cleanedContent = gptContent.trim();
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent.slice(7);
      }
      if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.slice(3);
      }
      if (cleanedContent.endsWith("```")) {
        cleanedContent = cleanedContent.slice(0, -3);
      }
      imagePrompts = JSON.parse(cleanedContent.trim());
      console.log(`Generated ${imagePrompts.length} image prompts`);
    } catch (parseError) {
      console.error("Error parsing image prompts:", parseError);
      throw new Error("Failed to parse image prompts from GPT response");
    }

    // 5. Generate images for each prompt using FLUX.2 from Black Forest Labs
    console.log("Generating images with FLUX.2...");
    const generatedImages: GeneratedImage[] = [];

    if (!FLUX_API_KEY) {
      throw new Error("FLUX_API_KEY is not set");
    }

    for (const imagePrompt of imagePrompts) {
      console.log(`Generating image ${imagePrompt.order}/${imagePrompts.length}...`);
      
      try {
        // Step 1: Create generation request
        const createResponse = await fetch("https://api.bfl.ai/v1/flux-2-pro", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-key": FLUX_API_KEY,
          },
          body: JSON.stringify({
            prompt: imagePrompt.prompt,
            width: 720,   // Portrait format - divisible by 16
            height: 1280, // Portrait format - divisible by 16
            output_format: "png",
            safety_tolerance: 2,
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          console.error(`Failed to create image request ${imagePrompt.order}:`, errorData);
          continue;
        }

        const createData = await createResponse.json();
        const pollingUrl = createData.polling_url;

        if (!pollingUrl) {
          console.error(`No polling URL for image ${imagePrompt.order}`);
          continue;
        }

        // Step 2: Poll until ready (max 60 seconds)
        let imageUrl: string | null = null;
        const maxAttempts = 60;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

          const pollResponse = await fetch(pollingUrl, {
            method: "GET",
            headers: {
              "x-key": FLUX_API_KEY,
            },
          });

          if (!pollResponse.ok) {
            console.error(`Poll failed for image ${imagePrompt.order}`);
            continue;
          }

          const pollData = await pollResponse.json();
          
          if (pollData.status === "Ready") {
            imageUrl = pollData.result?.sample;
            console.log(`Image ${imagePrompt.order} ready after ${attempt + 1} seconds`);
            break;
          } else if (pollData.status === "Error") {
            console.error(`Image generation failed for ${imagePrompt.order}:`, pollData);
            break;
          }
          // Status is "Pending" - continue polling
        }

        if (imageUrl) {
          // Step 3: Fetch the image and convert to base64
          const imageDataResponse = await fetch(imageUrl);
          if (imageDataResponse.ok) {
            const imageArrayBuffer = await imageDataResponse.arrayBuffer();
            const imageUint8Array = new Uint8Array(imageArrayBuffer);
            
            // Convert to base64 in chunks
            let imageBinaryString = "";
            const chunkSize = 8192;
            for (let i = 0; i < imageUint8Array.length; i += chunkSize) {
              const chunk = imageUint8Array.subarray(i, i + chunkSize);
              imageBinaryString += String.fromCharCode.apply(null, Array.from(chunk));
            }
            const imageBase64 = btoa(imageBinaryString);

            generatedImages.push({
              order: imagePrompt.order,
              prompt: imagePrompt.prompt,
              timestamp: imagePrompt.timestamp,
              imageUrl: `data:image/png;base64,${imageBase64}`,
            });
            console.log(`Image ${imagePrompt.order} downloaded and encoded successfully`);
          }
        }
      } catch (imageError) {
        console.error(`Error generating image ${imagePrompt.order}:`, imageError);
        // Continue with other images
      }
    }

    console.log(`Successfully generated ${generatedImages.length}/${imagePrompts.length} images`);

    return new Response(
      JSON.stringify({
        audioUrl,
        subtitles: srtContent,
        imagePrompts,
        generatedImages,
        artStyle,
        audioDuration: audioDurationSeconds,
        numberOfImages,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in generate-ai-video:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

