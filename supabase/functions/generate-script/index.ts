// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Access OpenAI API Key from environment variables (you need to set this in Supabase)
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  category: string;
  prompt?: string;
  duration?: string | number;
  language?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get request body
    const { category, prompt, duration, language = 'en' }: RequestBody = await req.json();

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
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

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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

    const data = await response.json();
    
    if (data.error) {
        console.error("OpenAI API Error:", data.error);
        throw new Error(data.error.message || "Failed to generate script via OpenAI");
    }

    const script = data.choices?.[0]?.message?.content;

    return new Response(JSON.stringify({ script }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Error generating script:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});