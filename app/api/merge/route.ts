import { NextResponse } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import ffmpegStatic from "ffmpeg-static";
import { createClient } from "@supabase/supabase-js";

// Default background video URL (hosted on GitHub)
const DEFAULT_BACKGROUND_VIDEO_URL = "https://github.com/mateus-pulsar/static-video-hosting/releases/download/0.0.1/minecraft_1.mp4";

// Initialize Supabase client for storage uploads
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Storage bucket for generated videos
const VIDEO_STORAGE_BUCKET = "generated-videos";

// Tell fluent-ffmpeg where to find the ffmpeg binary
if (ffmpegStatic) {
  console.log("ffmpeg-static path:", ffmpegStatic);
  ffmpeg.setFfmpegPath(ffmpegStatic);
} else {
  console.warn("ffmpeg-static not found, relying on system ffmpeg");
}

export async function POST(request: Request) {
  try {
    const { audioUrl, subtitles, backgroundVideoUrl } = await request.json();

    if (!audioUrl) {
      return NextResponse.json(
        { error: "Audio URL is required" },
        { status: 400 }
      );
    }

    // Use provided background video URL or fall back to default
    const videoUrl = backgroundVideoUrl || DEFAULT_BACKGROUND_VIDEO_URL;

    // 1. Save the audio (which is base64) to a temp file
    const audioBuffer = Buffer.from(audioUrl.split(",")[1], "base64");
    const tempId = uuidv4();
    // Use OS temp directory (works on Vercel where filesystem is read-only)
    const tempDir = os.tmpdir();

    const audioPath = path.join(tempDir, `${tempId}.mp3`);
    const outputPath = path.join(tempDir, `${tempId}.mp4`);
    const videoPath = path.join(tempDir, `${tempId}_bg.mp4`);

    fs.writeFileSync(audioPath, audioBuffer);

    // 2. Download background video from URL
    console.log("Downloading background video from:", videoUrl);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error("Failed to download background video");
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    fs.writeFileSync(videoPath, videoBuffer);
    console.log("Background video downloaded.");

    // 3. Get audio duration to cut video accordingly
    let audioDuration = 0;
    await new Promise<void>((resolve) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (!err) {
          audioDuration = metadata.format.duration || 0;
          console.log(`Audio duration: ${audioDuration}s`);
        }
        resolve();
      });
    });

    // 4. Save subtitles if provided
    let srtPath: string | null = null;
    if (subtitles && subtitles.trim()) {
      srtPath = path.join(tempDir, `${tempId}.srt`);
      fs.writeFileSync(srtPath, subtitles);
      console.log("Subtitles saved.");
    }

    // 5. Merge video + audio + subtitles with FFmpeg
    await new Promise((resolve, reject) => {
      let command = ffmpeg()
        .input(videoPath)
        .input(audioPath);

      // If we successfully got the duration, use it to limit the video
      if (audioDuration > 0) {
        const durationWithBuffer = audioDuration + 0.1;
        command = command.outputOptions([`-t ${durationWithBuffer}`]);
      } else {
        command = command.outputOptions(['-shortest']);
      }

      const outputOptions = [
        '-map 0:v',
        '-map 1:a',
        '-c:v libx264',
        '-c:a aac',
        '-pix_fmt yuv420p'
      ];

      // Add subtitles filter if we have them
      if (srtPath) {
        const style = "FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Italic=0,Alignment=10,BorderStyle=1,Outline=1,Shadow=1,MarginL=10,MarginR=10,MarginV=10";
        outputOptions.push(`-vf subtitles='${srtPath}':force_style='${style}'`);
      }

      command
        .outputOptions(outputOptions)
        .save(outputPath)
        .on('end', resolve)
        .on('error', (err) => {
            console.error("FFmpeg error:", err);
            reject(err);
        });
    });

    // 6. Upload video to Supabase Storage
    const finalVideoBuffer = fs.readFileSync(outputPath);
    const storagePath = `videos/${tempId}.mp4`;
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from(VIDEO_STORAGE_BUCKET)
      .upload(storagePath, finalVideoBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload video to storage:", uploadError);
      throw new Error("Failed to upload video to storage");
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(VIDEO_STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const publicVideoUrl = urlData.publicUrl;
    console.log("Video uploaded to storage:", publicVideoUrl);

    // 7. Cleanup ALL temp files (including output video since it's now in storage)
    try {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
    } catch (e) {
      console.error("Error cleaning up temp files:", e);
    }

    // 8. Return the Supabase Storage URL
    return NextResponse.json({ url: publicVideoUrl });

  } catch (error: any) {
    console.error("Error generating final video:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate final video" },
      { status: 500 }
    );
  }
}

