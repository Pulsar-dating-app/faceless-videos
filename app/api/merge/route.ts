import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import ffmpegStatic from "ffmpeg-static";
import { createClient } from "@supabase/supabase-js";

const execAsync = promisify(exec);

// Default background video URL (hosted on GitHub)
const DEFAULT_BACKGROUND_VIDEO_URL = "https://github.com/mateus-pulsar/static-video-hosting/releases/download/0.0.1/minecraft_1.mp4";

// Initialize Supabase client for storage uploads
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Storage bucket for generated videos
const VIDEO_STORAGE_BUCKET = "generated-videos";

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

    // 3. Get audio duration using ffmpeg (since ffprobe isn't available)
    let audioDuration = 0;
    console.log("Getting audio duration from:", audioPath);
    
    try {
      const ffmpegPath = ffmpegStatic || "ffmpeg";
      // Use ffmpeg to probe file - it outputs duration to stderr and exits with code 1
      // We catch the error to get stderr which contains the duration info
      try {
        await execAsync(`"${ffmpegPath}" -i "${audioPath}" 2>&1`, { maxBuffer: 10 * 1024 * 1024 });
      } catch (error: any) {
        // ffmpeg exits with code 1 when probing, but stderr contains the info we need
        const output = error.stderr || error.stdout || error.message || "";
        
        // Parse duration from output: Duration: 00:00:30.00, start: 0.000000, bitrate: 128 kb/s
        const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseInt(durationMatch[3]);
          const centiseconds = parseInt(durationMatch[4]);
          audioDuration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
          console.log(`Audio duration: ${audioDuration}s`);
        } else {
          console.warn("Could not parse audio duration from ffmpeg output, will use -shortest option");
        }
      }
    } catch (probeError: any) {
      console.error("Error getting audio duration:", probeError.message || probeError);
      // Continue without duration - will use -shortest option
    }

    // 4. Save subtitles if provided
    let srtPath: string | null = null;
    if (subtitles && subtitles.trim()) {
      srtPath = path.join(tempDir, `${tempId}.srt`);
      fs.writeFileSync(srtPath, subtitles);
      console.log("Subtitles saved.");
    }

    // 5. Merge video + audio + subtitles with FFmpeg using exec (more reliable than fluent-ffmpeg)
    console.log("Starting FFmpeg merge...");
    console.log("Video path:", videoPath);
    console.log("Audio path:", audioPath);
    console.log("Output path:", outputPath);
    console.log("SRT path:", srtPath);
    
    // Verify files exist
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const ffmpegPath = ffmpegStatic || "ffmpeg";
    
    // Build FFmpeg command
    const escapedVideoPath = videoPath.replace(/\\/g, "/").replace(/'/g, "'\\''");
    const escapedAudioPath = audioPath.replace(/\\/g, "/").replace(/'/g, "'\\''");
    const escapedOutputPath = outputPath.replace(/\\/g, "/").replace(/'/g, "'\\''");
    
    let ffmpegCommand = `"${ffmpegPath}" -i "${escapedVideoPath}" -i "${escapedAudioPath}"`;
    
    // Add duration limit or shortest option
    if (audioDuration > 0) {
      const durationWithBuffer = audioDuration + 0.1;
      ffmpegCommand += ` -t ${durationWithBuffer}`;
      console.log(`Using duration limit: ${durationWithBuffer}s`);
    } else {
      ffmpegCommand += ` -shortest`;
      console.log("Using -shortest option (no duration limit)");
    }
    
    // Add mapping and codec options
    ffmpegCommand += ` -map 0:v -map 1:a -c:v libx264 -c:a aac -pix_fmt yuv420p`;
    
    // Add subtitles filter if we have them
    if (srtPath) {
      const absoluteSrtPath = path.resolve(srtPath).replace(/\\/g, "/").replace(/'/g, "'\\''");
      const style = "FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Italic=0,Alignment=10,BorderStyle=1,Outline=1,Shadow=1,MarginL=10,MarginR=10,MarginV=10";
      ffmpegCommand += ` -vf subtitles='${absoluteSrtPath}':force_style='${style}'`;
      console.log("Adding subtitles filter");
    }
    
    // Add output file
    ffmpegCommand += ` -y "${escapedOutputPath}"`;
    
    console.log("Executing FFmpeg command...");
    console.log(ffmpegCommand);
    
    try {
      await execAsync(ffmpegCommand, { maxBuffer: 50 * 1024 * 1024 });
      console.log("FFmpeg merge completed successfully");
    } catch (error: any) {
      console.error("FFmpeg error:", error);
      console.error("FFmpeg stderr:", error.stderr);
      throw new Error(`FFmpeg failed: ${error.message || error.stderr || "Unknown error"}`);
    }

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

