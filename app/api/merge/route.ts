import { NextResponse } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ffmpegStatic from "ffmpeg-static";

// Tell fluent-ffmpeg where to find the ffmpeg binary
if (ffmpegStatic) {
  // On Windows, ffmpeg-static might return a path with backslashes, which could cause issues if not handled.
  // But generally it works. If "spawn ... ENOENT" happens, it usually means the file isn't at that path or permission denied.
  // However, the error message showed the path to node_modules/ffmpeg-static/ffmpeg.exe 
  // If the path has spaces or special chars (like "Área de Trabalho"), it might be an issue with how spawn handles it.
  
  // Let's try to use the path directly. 
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
    // We need to use ffmpeg.ffprobe to get duration, or just trust fluent-ffmpeg to cut
    // But to cut the video to match audio, we can set output duration to match audio input

    // We'll use a promise wrapper for the ffmpeg process
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        // Cut video to length of audio
        // -shortest in some contexts works, but better to explicitly set duration if we knew it
        // or use complex filter. 
        // Simple approach: Loop video if short, or just take video stream and map audio
        // We want the video to be cut to the audio duration.
        // The 'shortest' input option tells ffmpeg to finish encoding when the shortest input stream ends.
        .outputOptions([
          '-map 0:v',   // Map video from input 0 (minecraft)
          '-map 1:a',   // Map audio from input 1 (our tts)
          '-c:v copy',  // Copy video codec (fast, no re-encoding if possible, but might fail if container differs significantly or needs cutting exact frames)
          // If copying video fails or we need exact cut, use '-c:v libx264'
          // But to cut exactly at audio end, we generally need to re-encode or use -shortest with re-encoding
          '-c:v libx264', 
          '-c:a aac',
          '-shortest',   // Finish when the shortest input (audio) ends
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

