import { NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = "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" // process.env.OPENAI_API_KEY || "sk-mock-api-key";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { category, prompt, duration } = await request.json();

    // Estimate word count based on duration (approx. 150 words per minute for normal speech)
    const durationNum = parseInt(duration) || 30;
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
    
    Target Duration: ${durationNum} seconds (approx ${wordCount} words).
    Category: ${category}
    User Prompt: ${prompt || "Create something relevant to the category"}
    
    Output ONLY the raw spoken text. Do not include any scene directions, sound effects, or intro/outro labels.`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: systemPrompt }],
      model: "gpt-4o",
    });

    const script = completion.choices[0].message.content;

    return NextResponse.json({ script });

  } catch (error: any) {
    console.error("Error generating script:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate script" },
      { status: 500 }
    );
  }
}

