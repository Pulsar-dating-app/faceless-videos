import { NextResponse } from "next/server";

// Default background video URL (hosted on GitHub)
const DEFAULT_BACKGROUND_VIDEO_URL = "https://github.com/mateus-pulsar/static-video-hosting/releases/download/0.0.1/minecraft_1.mp4";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: Request) {
  if (CRON_SECRET) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { audioUrl, subtitles, backgroundVideoUrl } = await req.json();
  const videoUrl = backgroundVideoUrl || DEFAULT_BACKGROUND_VIDEO_URL;

  const jobId = crypto.randomUUID();

  // tell worker to start
  const response = await fetch("http://167.235.140.200:3000/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioUrl,
      subtitles,
      backgroundUrl: videoUrl,
      outputPath: `/tmp/${jobId}.mp4`,
      duration: 60
    })
  });

  const data = await response.json();

  return NextResponse.json({
    jobId,
    success: data.success,
    url: data.url || null
  });
}