import { NextResponse } from "next/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const {
      audioUrl,
      subtitles,
      generatedImages,
      audioDuration
    } = await req.json();

    if (!audioUrl || !generatedImages || generatedImages.length === 0) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const response = await fetch(
      "https://video-worker-faceless.fly.dev/process-images",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioUrl,
          subtitles,
          generatedImages,
          audioDuration
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Fly worker failed: ${text}`);
    }

    const data = await response.json();

    // ✅ RETURN EXACT SAME SHAPE AS BEFORE
    return NextResponse.json({
      url: data.url
    });

  } catch (err) {
    console.error("Vercel API error:", err);
    return NextResponse.json(
      { error: err || "Video generation failed" },
      { status: 500 }
    );
  }
}
