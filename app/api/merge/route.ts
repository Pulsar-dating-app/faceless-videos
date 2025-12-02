import { NextResponse } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ffmpegStatic from "ffmpeg-static";
import OpenAI from "openai";

const OPENAI_API_KEY = "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";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

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

    // 3. Transcribe audio to subtitles (SRT) using Whisper
    console.log("Transcribing audio...");
    let srtPath = null;
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
        response_format: "srt",
      });
      
      const srtContent = transcription as unknown as string;
      srtPath = path.join(tempDir, `${tempId}.srt`);
      fs.writeFileSync(srtPath, srtContent);
      console.log("Subtitles generated.");
    } catch (transcribeError) {
      console.error("Error generating subtitles:", transcribeError);
      // Continue without subtitles if it fails
    }

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

      const outputOptions = [
        '-map 0:v',   // Map video from input 0
        '-map 1:a',   // Map audio from input 1
        '-c:v libx264', // Re-encode video
        '-c:a aac',     // Re-encode audio
        '-pix_fmt yuv420p' // Ensure compatibility
      ];

      // Add subtitles filter if we have them
      if (srtPath) {
        // Escape path for ffmpeg filter
        // On Windows this needs backslashes escaped, on Mac/Linux usually fine.
        // FFmpeg filter path syntax: subtitles='path/to/file.srt':force_style='...'
        // Style: Centered in middle of screen (Alignment=10 which is middle-center in ASS or Alignment=5 in libass legacy)
        // Libass standard:
        // 1=Bottom Left, 2=Bottom Center, 3=Bottom Right
        // 5=Top Left ... Wait, standard ASS is numpad: 1=SW, 2=S, 3=SE, 4=W, 5=Center, 6=E, 7=NW, 8=N, 9=NE
        // However, sometimes ffmpeg/libass defaults differ.
        // Let's use Alignment=10 (Middle Center) which works for some versions, or stick to Alignment=5 if using numpad layout.
        // Actually, standard ASS: 5 is TOP-LEFT in some docs, but numpad layout is usually:
        // 7 8 9
        // 4 5 6
        // 1 2 3
        // BUT SubStation Alpha legacy alignment: 1=Left, 2=Center, 3=Right (Sub titles).
        // 5 usually means Top-Left in legacy SSA, but in ASS (Advanced SS) it uses numpad.
        // Let's try Alignment=5 (Numpad Center) but with MarginV centered.
        // Alternatively, we can try Alignment=10 which is a common "Middle Center" value in some tools.
        // Let's try standard Numpad 5 for center.
        
        const style = "FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Italic=0,Alignment=10,BorderStyle=1,Outline=1,Shadow=1,MarginL=10,MarginR=10,MarginV=10";
        
        // Important: Ensure path is absolute and properly formatted for FFmpeg
        // complex_filter or vf
        // We use outputOptions with -vf because complexFilter api in fluent-ffmpeg sometimes conflicts with simple map
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

    // 4. Cleanup temp files
    try {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
    } catch (e) {
      console.error("Error cleaning up temp files:", e);
    }

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

