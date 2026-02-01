import { NextResponse } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ffmpegStatic from "ffmpeg-static";
import { supabase } from "@/lib/supabase";

// Default background video URL (hosted on GitHub)
const DEFAULT_BACKGROUND_VIDEO_URL = "https://github.com/mateus-pulsar/static-video-hosting/releases/download/0.0.1/minecraft_1.mp4";

// Tell fluent-ffmpeg where to find the ffmpeg binary
if (ffmpegStatic) {
  console.log("ffmpeg-static path:", ffmpegStatic);
  ffmpeg.setFfmpegPath(ffmpegStatic);
} else {
  console.warn("ffmpeg-static not found, relying on system ffmpeg");
}

// Determine if we're in production (Vercel) or local development
const isProduction = process.env.VERCEL === "1";
console.log(`Running in ${isProduction ? "production" : "development"} mode`);

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
    
    // Use /tmp for production (Vercel) or public/temp for local development
    const tempDir = isProduction 
      ? path.join("/tmp", tempId)
      : path.join(process.cwd(), "public", "temp");
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

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

    // 6. Cleanup temp files (keep output video)
    try {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
    } catch (e) {
      console.error("Error cleaning up temp files:", e);
    }

    // 7. Upload video to Supabase Storage in production, or return local path in development
    let publicVideoUrl: string;
    
    if (isProduction) {
      // Upload to Supabase Storage
      console.log("Uploading video to Supabase Storage...");
      const videoBuffer = fs.readFileSync(outputPath);
      const fileName = `${tempId}.mp4`;
      const storagePath = `generated-videos/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(storagePath, videoBuffer, {
          contentType: "video/mp4",
          cacheControl: "3600",
          upsert: false
        });
      
      if (uploadError) {
        console.error("Error uploading to Supabase Storage:", uploadError);
        throw new Error(`Failed to upload video: ${uploadError.message}`);
      }
      
      // Get public URL
      const { data } = supabase.storage
        .from("videos")
        .getPublicUrl(storagePath);
      
      publicVideoUrl = data.publicUrl;
      console.log("Video uploaded successfully:", publicVideoUrl);
      
      // Clean up the output file
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      
      // Clean up temp directory in production
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir, { recursive: true });
      }
    } else {
      // Return local path for development
      publicVideoUrl = `/temp/${tempId}.mp4`;
      console.log("Video saved locally:", publicVideoUrl);
    }

    return NextResponse.json({ url: publicVideoUrl });

  } catch (error: any) {
    console.error("Error generating final video:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate final video" },
      { status: 500 }
    );
  }
}

