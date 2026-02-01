import { NextResponse } from "next/server";

// Default background video URL (hosted on GitHub)
const DEFAULT_BACKGROUND_VIDEO_URL = "https://github.com/mateus-pulsar/static-video-hosting/releases/download/0.0.1/minecraft_1.mp4";

export async function POST(req: Request) {
  const { audioUrl, backgroundVideoUrl } = await req.json();
  const videoUrl = backgroundVideoUrl || DEFAULT_BACKGROUND_VIDEO_URL;

  const jobId = crypto.randomUUID();

  // tell worker to start
  await fetch("https://video-worker-faceless.fly.dev/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioUrl,
      backgroundUrl: videoUrl,
      outputPath: `/tmp/${jobId}.mp4`,
      duration: 60
    })
  });

  return NextResponse.json({ jobId });
}
