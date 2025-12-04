import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import ffmpegStatic from "ffmpeg-static";

const execAsync = promisify(exec);

interface GeneratedImage {
  order: number;
  prompt: string;
  timestamp: string;
  imageUrl: string; // base64 data URL
}

interface RequestBody {
  audioUrl: string; // base64 data URL
  subtitles: string; // SRT content
  generatedImages: GeneratedImage[];
  audioDuration: number;
}

export async function POST(request: Request) {
  try {
    const { audioUrl, subtitles, generatedImages, audioDuration }: RequestBody = await request.json();

    if (!audioUrl || !generatedImages || generatedImages.length === 0) {
      return NextResponse.json(
        { error: "Audio URL and images are required" },
        { status: 400 }
      );
    }

    const ffmpegPath = ffmpegStatic || "ffmpeg";
    const tempId = uuidv4();
    const tempDir = path.join(process.cwd(), "public", "temp");
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const audioPath = path.join(tempDir, `${tempId}.mp3`);
    const srtPath = path.join(tempDir, `${tempId}.srt`);
    const outputPath = path.join(tempDir, `${tempId}.mp4`);
    const imagesDir = path.join(tempDir, `${tempId}_images`);

    // Create images directory
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // 1. Save the audio to a temp file
    const audioBuffer = Buffer.from(audioUrl.split(",")[1], "base64");
    fs.writeFileSync(audioPath, audioBuffer);
    console.log("Audio saved to:", audioPath);

    // 2. Save subtitles to a temp file
    let srtContent: string | null = null;
    if (subtitles) {
      srtContent = subtitles;
      fs.writeFileSync(srtPath, srtContent);
      console.log("Subtitles saved to:", srtPath);
    }

    // 3. Save each image to a temp file
    const imagePaths: string[] = [];
    const sortedImages = [...generatedImages].sort((a, b) => a.order - b.order);
    
    for (let i = 0; i < sortedImages.length; i++) {
      const image = sortedImages[i];
      const imagePath = path.join(imagesDir, `image_${String(i + 1).padStart(3, "0")}.png`);
      
      // Extract base64 data from data URL
      const base64Data = image.imageUrl.split(",")[1];
      const imageBuffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(imagePath, imageBuffer);
      imagePaths.push(imagePath);
      console.log(`Image ${i + 1} saved to:`, imagePath);
    }

    // 4. Calculate durations
    const numImages = sortedImages.length;
    const fadeDuration = 0.5; // Crossfade duration in seconds
    const fps = 30;
    
    // Each image duration accounts for fade overlap
    // Total duration = (numImages * durationPerImage) - ((numImages - 1) * fadeDuration)
    // So: durationPerImage = (audioDuration + (numImages - 1) * fadeDuration) / numImages
    const durationPerImage = (audioDuration + (numImages - 1) * fadeDuration) / numImages;
    const framesPerImage = Math.ceil(durationPerImage * fps);
    
    console.log(`Duration per image: ${durationPerImage.toFixed(2)}s (${framesPerImage} frames)`);
    console.log(`Fade duration: ${fadeDuration}s`);

    // 5. Build complex filter for zoompan + xfade transitions
    // zoompan creates a slow zoom effect (Ken Burns)
    // xfade creates crossfade transitions between segments
    
    let inputs = "";
    let filterComplex = "";
    
    // Add each image as input (no zoom effect)
    for (let i = 0; i < imagePaths.length; i++) {
      const escapedPath = imagePaths[i].replace(/\\/g, "/");
      inputs += ` -loop 1 -t ${durationPerImage} -i "${escapedPath}"`;
      
      // Simple scale to output size, no zoom
      filterComplex += `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,fps=${fps}[v${i}];`;
    }
    
    // Chain all videos together with xfade transitions
    if (imagePaths.length === 1) {
      filterComplex += `[v0]setpts=PTS-STARTPTS[video]`;
    } else {
      // First xfade
      let lastOutput = "v0";
      for (let i = 1; i < imagePaths.length; i++) {
        const offset = (durationPerImage * i) - (fadeDuration * i);
        const outputLabel = i === imagePaths.length - 1 ? "xfaded" : `xf${i}`;
        filterComplex += `[${lastOutput}][v${i}]xfade=transition=fade:duration=${fadeDuration}:offset=${offset.toFixed(3)}[${outputLabel}];`;
        lastOutput = outputLabel;
      }
      filterComplex += `[xfaded]setpts=PTS-STARTPTS[video]`;
    }
    
    // Add subtitles filter if we have them
    if (srtPath && srtContent) {
      const absoluteSrtPath = path.resolve(srtPath).replace(/\\/g, "/").replace(/'/g, "'\\''");
      const style = "FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Italic=0,Alignment=10,BorderStyle=1,Outline=2,Shadow=1,MarginL=10,MarginR=10,MarginV=40";
      filterComplex += `;[video]subtitles='${absoluteSrtPath}':force_style='${style}'[final]`;
    } else {
      // No subtitles - just rename video to final
      filterComplex = filterComplex.replace("[video]", "[final]");
    }

    // 6. Build and execute FFmpeg command
    const ffmpegCommand = `"${ffmpegPath}"${inputs} -i "${audioPath}" -filter_complex "${filterComplex}" -map "[final]" -map ${imagePaths.length}:a -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -pix_fmt yuv420p -t ${audioDuration + 0.1} -y "${outputPath}"`;
    
    console.log("Executing FFmpeg command...");
    console.log(ffmpegCommand);
    
    await execAsync(ffmpegCommand, { maxBuffer: 50 * 1024 * 1024 });
    
    console.log("Video created successfully:", outputPath);

    // 7. Cleanup temp files (keep the output video)
    try {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
      
      // Remove images directory
      for (const imagePath of imagePaths) {
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }
      if (fs.existsSync(imagesDir)) fs.rmdirSync(imagesDir);
    } catch (e) {
      console.error("Error cleaning up temp files:", e);
    }

    // 8. Return the public URL for the new video
    const publicVideoUrl = `/temp/${tempId}.mp4`;

    return NextResponse.json({ url: publicVideoUrl });

  } catch (error: any) {
    console.error("Error generating AI video:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate AI video" },
      { status: 500 }
    );
  }
}
