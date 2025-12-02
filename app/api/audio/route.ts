import { NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = "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" // process.env.OPENAI_API_KEY || "sk-mock-api-key";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { text, voice } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice || "alloy",
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString("base64");
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

    return NextResponse.json({ audioUrl });

  } catch (error: any) {
    console.error("Error generating audio:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate audio" },
      { status: 500 }
    );
  }
}

