import { NextResponse } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { pipeline } from "stream/promises";
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync, statSync } from "fs";
import { supabase } from "@/lib/supabase";

// Binary Setup
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
if (ffprobeStatic.path) ffmpeg.setFfprobePath(ffprobeStatic.path);

const isProduction = process.env.VERCEL === "1";
const DEFAULT_BACKGROUND_VIDEO_URL = "https://github.com/mateus-pulsar/static-video-hosting/releases/download/0.0.1/minecraft_1.mp4";

export const maxDuration = 300; 
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const tempId = uuidv4();
  const tempDir = isProduction ? "/tmp" : path.join(process.cwd(), "public", "temp");
  
  const audioPath = path.join(tempDir, `${tempId}.mp3`);
  const outputPath = path.join(tempDir, `${tempId}.mp4`);
  const srtPath = path.join(tempDir, `${tempId}.srt`);
  
  try {
    const { audioUrl, subtitles, backgroundVideoUrl } = await request.json();
    if (!audioUrl) return NextResponse.json({ error: "Audio URL is required" }, { status: 400 });

    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

    const videoUrl = backgroundVideoUrl || DEFAULT_BACKGROUND_VIDEO_URL;
    const isDefaultVideo = videoUrl === DEFAULT_BACKGROUND_VIDEO_URL;
    const videoPath = isDefaultVideo 
      ? path.join(tempDir, "cached_minecraft_bg.mp4") 
      : path.join(tempDir, `${tempId}_bg.mp4`);

    // 1. Parallel Downloads (Speed Boost)
    console.log("🚀 Preparing assets...");
    const audioTask = (async () => {
      const audioBuffer = Buffer.from(audioUrl.split(",")[1], "base64");
      fs.writeFileSync(audioPath, audioBuffer);
    })();

    const videoTask = (async () => {
      if (isDefaultVideo && existsSync(videoPath)) return;
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Video download failed");
      await pipeline(response.body, createWriteStream(videoPath));
    })();

    const subtitleTask = (async () => {
      if (subtitles?.trim()) fs.writeFileSync(srtPath, subtitles);
    })();

    await Promise.all([audioTask, videoTask, subtitleTask]);

    // 2. Duration Logic (Your original fallback logic)
    let audioDuration = await new Promise((resolve) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        resolve(metadata?.format?.duration || 0);
      });
    });

    if (audioDuration === 0) {
      try {
        const stats = statSync(audioPath);
        audioDuration = (stats.size * 8) / (128 * 1024); // Estimate 128kbps
      } catch (e) { audioDuration = 300; }
    }

    // 3. FFmpeg Processing
    console.log(`🎬 Encoding ${audioDuration}s video...`);
    await new Promise((resolve, reject) => {
      let command = ffmpeg().input(videoPath).input(audioPath);

      const outputOptions = [
        '-map 0:v', '-map 1:a',
        '-c:v libx264',
        '-preset superfast', 
        '-crf 30', 
        '-c:a aac', '-b:a 128k',
        '-threads 1', // Best for 1 vCPU
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        `-t ${Number(audioDuration) + 0.1}`
      ];

      // Scaling and Subtitles
      const videoFilters = ['scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2'];
      
      if (existsSync(srtPath) && !isProduction) {
        // Subtitles only work easily in local dev (due to Fontconfig issues on Vercel)
        const escapedPath = srtPath.replace(/\\/g, '/').replace(/'/g, "'\\''");
        videoFilters.push(`subtitles='${escapedPath}'`);
      }
      
      command.outputOptions(outputOptions).videoFilters(videoFilters)
        .on('progress', (p) => console.log(`Processing: ${p.percent}%`))
        .on('error', (err) => reject(err))
        .on('end', () => resolve(null))
        .save(outputPath);
    });

    // 4. Supabase Upload
    console.log("☁️ Uploading result...");
    const videoFile = readFileSync(outputPath);
    const fileName = `generated/${tempId}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(fileName, videoFile, { contentType: "video/mp4" });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from("videos").getPublicUrl(fileName);

    // Cleanup
    [audioPath, outputPath, srtPath].forEach(p => { if (existsSync(p)) unlinkSync(p); });
    if (!isDefaultVideo && existsSync(videoPath)) unlinkSync(videoPath);

    return NextResponse.json({ url: publicUrl });

  } catch (error) {
    console.error("❌ Critical Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}