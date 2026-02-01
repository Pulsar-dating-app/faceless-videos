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

// Initialize Supabase client for storage uploads
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Storage bucket for generated videos
const VIDEO_STORAGE_BUCKET = "generated-videos";

interface GeneratedImage {
  order: number;
  imageUrl: string; // FLUX CDN URL or base64 data URL (for backward compatibility)
}

interface RequestBody {
  audioUrl: string; // base64 data URL (audio is still base64, it's small)
  subtitles: string; // SRT content
  generatedImages: GeneratedImage[];
  audioDuration: number;
}

// Helper function to check if a string is a base64 data URL
function isBase64DataUrl(str: string): boolean {
  return str.startsWith("data:");
}

// Helper function to download a file from URL
async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
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
    // Use OS temp directory (works on Vercel where filesystem is read-only)
    const tempDir = os.tmpdir();

    const audioPath = path.join(tempDir, `${tempId}.mp3`);
    const srtPath = path.join(tempDir, `${tempId}.srt`);
    const outputPath = path.join(tempDir, `${tempId}.mp4`);
    const imagesDir = path.join(tempDir, `${tempId}_images`);

    // Create images directory in temp folder
    fs.mkdirSync(imagesDir, { recursive: true });

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

    // 3. Save each image to a temp file (download from FLUX CDN URLs or handle base64)
    const imagePaths: string[] = [];
    const sortedImages = [...generatedImages].sort((a, b) => a.order - b.order);
    
    // Download images in parallel for better performance
    await Promise.all(sortedImages.map(async (image, i) => {
      const imagePath = path.join(imagesDir, `image_${String(i + 1).padStart(3, "0")}.png`);
      
      if (isBase64DataUrl(image.imageUrl)) {
        // Legacy base64 format (for backward compatibility)
        const base64Data = image.imageUrl.split(",")[1];
        const imageBuffer = Buffer.from(base64Data, "base64");
        fs.writeFileSync(imagePath, imageBuffer);
      } else {
        // New format: download from FLUX CDN URL
        await downloadFile(image.imageUrl, imagePath);
      }
      
      imagePaths[i] = imagePath;
      console.log(`Image ${i + 1} saved to:`, imagePath);
    }));

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
    // Workaround for shaky zoom: upscale BEFORE zoompan to reduce rounding errors
    // See: https://superuser.com/questions/1112617/ffmpeg-smooth-zoompan-with-no-jiggle/1112680
    // xfade creates crossfade transitions between segments
    
    let inputs = "";
    let filterComplex = "";
    
    // Zoom parameters - zoom from 1.0 to 1.15 (15% zoom) smoothly over duration
    const zoomStart = 1.0;
    const zoomEnd = 1.15;
    const zoomIncrement = (zoomEnd - zoomStart) / framesPerImage;
    
    // Upscale factor to reduce rounding errors (4x upscale for smooth zoom)
    // Higher resolution = smaller rounding impact = smoother motion
    const upscaleFactor = 4;
    const upscaledWidth = 720 * upscaleFactor;
    const upscaledHeight = 1280 * upscaleFactor;
    
    // Define 4 zoom directions: top-left, top-right, bottom-left, bottom-right
    const zoomDirections = [
      { name: 'top-left', x: '0', y: '0' },
      { name: 'top-right', x: 'iw-(iw/zoom)', y: '0' },
      { name: 'bottom-left', x: '0', y: 'ih-(ih/zoom)' },
      { name: 'bottom-right', x: 'iw-(iw/zoom)', y: 'ih-(ih/zoom)' }
    ];
    
    // Add each image as input with smooth zoom effect
    for (let i = 0; i < imagePaths.length; i++) {
      const escapedPath = imagePaths[i].replace(/\\/g, "/");
      inputs += ` -loop 1 -t ${durationPerImage} -i "${escapedPath}"`;
      
      // Randomly select one of the 4 zoom directions for this image
      const randomDirection = zoomDirections[Math.floor(Math.random() * zoomDirections.length)];
      
      // Workaround: Upscale first, then apply zoompan, then scale down to output size
      // This reduces rounding errors in x/y expressions that cause jitter
      // 1. Scale up to high resolution (reduces rounding impact)
      // 2. Apply zoompan with smooth zoom expression and random direction
      // 3. Use zoompan's 's' parameter to output at final size
      filterComplex += `[${i}:v]scale=${upscaledWidth}:${upscaledHeight}:force_original_aspect_ratio=decrease,pad=${upscaledWidth}:${upscaledHeight}:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+${zoomIncrement.toFixed(8)},${zoomEnd})':x='${randomDirection.x}':y='${randomDirection.y}':d=${framesPerImage}:s=720x1280,fps=${fps}[v${i}];`;
      
      console.log(`Image ${i + 1} zoom direction: ${randomDirection.name}`);
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

    // 7. Upload video to Supabase Storage
    const videoBuffer = fs.readFileSync(outputPath);
    const storagePath = `videos/${tempId}.mp4`;
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from(VIDEO_STORAGE_BUCKET)
      .upload(storagePath, videoBuffer, {
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

    // 8. Cleanup ALL temp files (including the output video since it's now in storage)
    try {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (srtPath && fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      
      // Remove images directory
      for (const imgPath of imagePaths) {
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }
      if (fs.existsSync(imagesDir)) fs.rmdirSync(imagesDir);
    } catch (e) {
      console.error("Error cleaning up temp files:", e);
    }

    // 9. Return the Supabase Storage URL
    return NextResponse.json({ url: publicVideoUrl });

  } catch (error: any) {
    console.error("Error generating AI video:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate AI video" },
      { status: 500 }
    );
  }
}
