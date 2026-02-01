import { NextResponse } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { supabase } from "@/lib/supabase";

// Default background video URL (hosted on GitHub)
const DEFAULT_BACKGROUND_VIDEO_URL = "https://github.com/mateus-pulsar/static-video-hosting/releases/download/0.0.1/minecraft_1.mp4";

// Tell fluent-ffmpeg where to find the ffmpeg and ffprobe binaries
if (ffmpegStatic) {
  console.log("ffmpeg-static path:", ffmpegStatic);
  ffmpeg.setFfmpegPath(ffmpegStatic);
} else {
  console.warn("ffmpeg-static not found, relying on system ffmpeg");
}

if (ffprobeStatic.path) {
  console.log("ffprobe-static path:", ffprobeStatic.path);
  ffmpeg.setFfprobePath(ffprobeStatic.path);
} else {
  console.warn("ffprobe-static not found, relying on system ffprobe");
}

// Determine if we're in production (Vercel) or local development
const isProduction = process.env.VERCEL === "1";
console.log(`Running in ${isProduction ? "production" : "development"} mode`);

// Configure route for longer execution time (Vercel)
export const maxDuration = 60; // 60 seconds (requires Pro plan, otherwise 10s for Hobby)
export const dynamic = 'force-dynamic';

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
        if (err) {
          console.error("ffprobe error:", err);
          // Don't reject, just log and continue with 0 duration
          resolve();
        } else {
          audioDuration = metadata.format.duration || 0;
          console.log(`Audio duration detected: ${audioDuration}s`);
          resolve();
        }
      });
    });

    // If we couldn't get the duration, try to calculate from file size
    // MP3 bitrate is typically around 128kbps
    if (audioDuration === 0) {
      try {
        const audioStats = fs.statSync(audioPath);
        const fileSizeInBytes = audioStats.size;
        // Rough estimate: assuming 128kbps MP3
        const estimatedDuration = (fileSizeInBytes * 8) / (128 * 1024);
        audioDuration = estimatedDuration;
        console.log(`Audio duration estimated from file size: ${audioDuration}s`);
      } catch (e) {
        console.error("Failed to estimate audio duration:", e);
        // Set a reasonable default maximum (5 minutes)
        audioDuration = 300;
        console.log(`Using default maximum duration: ${audioDuration}s`);
      }
    }

    // 4. Save subtitles if provided
    let srtPath: string | null = null;
    if (subtitles && subtitles.trim()) {
      srtPath = path.join(tempDir, `${tempId}.srt`);
      fs.writeFileSync(srtPath, subtitles);
      console.log("Subtitles saved.");
    }

    // 5. Merge video + audio + subtitles with FFmpeg
    console.log("Starting FFmpeg processing...");
    console.log("Video path:", videoPath);
    console.log("Audio path:", audioPath);
    console.log("Output path:", outputPath);
    console.log("Audio duration:", audioDuration);
    
    // Create a timeout wrapper to prevent hanging
    const ffmpegPromise = new Promise((resolve, reject) => {
      let command = ffmpeg()
        .input(videoPath)
        .input(audioPath);

      // Always use explicit duration - never rely on -shortest alone
      // This prevents FFmpeg from processing the entire background video
      if (audioDuration > 0) {
        const durationWithBuffer = audioDuration + 0.1;
        command = command.outputOptions([`-t ${durationWithBuffer}`]);
        console.log(`Setting output duration to: ${durationWithBuffer}s`);
      } else {
        // Fallback: if we couldn't detect duration, limit to 5 minutes max
        console.warn("Could not detect audio duration, limiting to 5 minutes");
        command = command.outputOptions(['-t 300', '-shortest']);
      }

      const outputOptions = [
        '-map 0:v',
        '-map 1:a',
        '-c:v libx264',
        '-preset veryfast', // Use fast preset for serverless (reduces processing time)
        '-crf 23', // Good quality/size balance
        '-c:a aac',
        '-pix_fmt yuv420p',
        '-movflags', '+faststart' // Optimize for streaming
      ];

      // Add subtitles filter if we have them
      // Note: Subtitle rendering may not work in serverless due to missing fontconfig
      if (srtPath && !isProduction) {
        // Only use subtitle filter in development (requires fontconfig)
        const normalizedPath = srtPath.replace(/\\/g, '/');
        const escapedSrtPath = normalizedPath.replace(/'/g, "'\\''");
        
        const style = "FontName=Arial,FontSize=14,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BackColour=&H80000000,Bold=1,Alignment=10,Outline=2,Shadow=1,MarginV=40";
        outputOptions.push(`-vf subtitles='${escapedSrtPath}':force_style='${style}'`);
        console.log("Subtitles will be burned into video");
      } else if (srtPath && isProduction) {
        // In production, subtitles filter often fails due to missing fonts/fontconfig
        // Skip subtitles for now - client can add them in post-processing
        console.log("Skipping subtitle burn-in in production (fontconfig not available)");
        console.log("Subtitles will need to be added client-side or use alternative method");
      }

      command
        .outputOptions(outputOptions)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Processing: ${Math.round(progress.percent)}% done`);
          } else if (progress.timemark) {
            console.log(`Processing: ${progress.timemark}`);
          }
        })
        .on('end', () => {
          console.log('FFmpeg processing completed successfully');
          resolve(null);
        })
        .on('error', (err, stdout, stderr) => {
          console.error("FFmpeg error:", err.message);
          console.error("FFmpeg stderr:", stderr);
          reject(err);
        })
        .save(outputPath);
    });
    
    // Add timeout (50 seconds to leave buffer for upload)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('FFmpeg processing timeout after 50 seconds')), 50000);
    });
    
    await Promise.race([ffmpegPromise, timeoutPromise]);

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

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to generate final video";
    console.error("Error generating final video:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

