import { NextResponse } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ffmpegStatic from "ffmpeg-static";

// Tell fluent-ffmpeg where to find the ffmpeg binary
if (ffmpegStatic) {
  console.log("ffmpeg-static path:", ffmpegStatic);
  ffmpeg.setFfmpegPath(ffmpegStatic);
} else {
  console.warn("ffmpeg-static not found, relying on system ffmpeg");
}

export async function POST(request: Request) {
  try {
    const { audioUrl } = await request.json();

    if (!audioUrl) {
      return NextResponse.json(
        { error: "Audio URL is required" },
        { status: 400 }
      );
    }

    // 1. Save the audio (which is base64) to a temp file
    const audioBuffer = Buffer.from(audioUrl.split(",")[1], "base64");
    const tempId = uuidv4();
    const tempDir = path.join(process.cwd(), "public", "temp");
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const audioPath = path.join(tempDir, `${tempId}.mp3`);
    const outputPath = path.join(tempDir, `${tempId}.mp4`);
    
    // Use the uploaded minecraft video as base
    // In a real app, we might have multiple background videos or select randomly
    const videoPath = path.join(process.cwd(), "public", "videos", "minecraft_1.mp4");

    if (!fs.existsSync(videoPath)) {
       return NextResponse.json(
        { error: "Base video not found. Please ensure public/videos/minecraft_1.mp4 exists." },
        { status: 500 }
      );
    }

    fs.writeFileSync(audioPath, audioBuffer);

    // 2. Get audio duration to cut video accordingly
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

    // We'll use a promise wrapper for the ffmpeg process
    await new Promise((resolve, reject) => {
      // Use complex filter to ensure audio drives the duration
      // "apad" adds silence to the end of the audio stream if needed (though we want the opposite, we want video to stop)
      // The most reliable way is to use -t explicitly with the audio duration
      
      let command = ffmpeg()
        .input(videoPath)
        .input(audioPath);

      // If we successfully got the duration, use it to limit the video
      if (audioDuration > 0) {
        // Add a small buffer (0.1s) to avoid cutting off the very last millisecond of audio
        const durationWithBuffer = audioDuration + 0.1;
        command = command.outputOptions([`-t ${durationWithBuffer}`]);
      } else {
        // Fallback to shortest if probe failed
        command = command.outputOptions(['-shortest']);
      }

      command
        .outputOptions([
          '-map 0:v',   // Map video from input 0
          '-map 1:a',   // Map audio from input 1
          '-c:v libx264', // Re-encode video
          '-c:a aac',     // Re-encode audio
          '-pix_fmt yuv420p' // Ensure compatibility
        ])
        .save(outputPath)
        .on('end', resolve)
        .on('error', (err) => {
            console.error("FFmpeg error:", err);
            reject(err);
        });
    });

    // 3. Cleanup temp audio
    fs.unlinkSync(audioPath);

    // 4. Return the public URL for the new video
    // Since we saved it in public/temp, it's accessible via /temp/...
    const publicVideoUrl = `/temp/${tempId}.mp4`;

    return NextResponse.json({ url: publicVideoUrl });

  } catch (error: any) {
    console.error("Error generating final video:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate final video" },
      { status: 500 }
    );
  }
}

