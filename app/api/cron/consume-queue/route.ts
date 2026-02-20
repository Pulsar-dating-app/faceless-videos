import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET;

interface AutomationPayload {
  automation_id: string;
  user_uid: string;
  category: string;
  series_name: string;
  prompt?: string;
  duration: string | number;
  language: string;
  narrator_voice: string;
  video_type: string;
  background_video?: string;
  art_style?: string;
  social_platforms?: string[];
  scheduled_time: string;
  publish_time: string;
  timezone: string;
  [key: string]: any;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (only if CRON_SECRET is set)
    // If CRON_SECRET is not set, allow access (useful for local testing)
    if (CRON_SECRET) {
      const authHeader = request.headers.get("authorization");
      const cronSecret = request.nextUrl.searchParams.get("secret");

      // Vercel cron sends the secret in the Authorization header or query param
      if (authHeader !== `Bearer ${CRON_SECRET}` && cronSecret !== CRON_SECRET) {
        return NextResponse.json(
          {
            error:
              "Unauthorized. Provide CRON_SECRET via ?secret=YOUR_SECRET or Authorization: Bearer YOUR_SECRET header",
          },
          { status: 401 }
        );
      }
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500 }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Read only 1 job from pgmq (cron runs every 2 minutes)
    const { data: messages, error: readError } = await supabaseAdmin.rpc(
      "pgmq_read_video",
      {
        queue_name: "video_generation_queue",
        vt: 3600, // 1 hour visibility timeout for processing
        qty: 1, // Read only 1 message per cron execution
      }
    );

    if (readError) {
      console.error("[consume-queue] Error reading from pgmq:", readError);
      return NextResponse.json(
        { error: readError.message || "Failed to read from queue" },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No jobs in queue",
      });
    }

    console.log(`[consume-queue] Found ${messages.length} jobs in queue`);

    const results: any[] = [];
    const errors: any[] = [];

    // Process each job sequentially
    for (const job of messages) {
      const msgId: number = job.msg_id;
      const payload = job.message as AutomationPayload;

      console.log(
        "[consume-queue] Processing job",
        JSON.stringify({
          msg_id: msgId,
          automation_id: payload?.automation_id,
          user_uid: payload?.user_uid,
          scheduled_time: payload?.scheduled_time,
        })
      );

      try {
        let videoUrl: string;
        let audioUrl: string;
        let script: string;

        // Check video_type to determine which flow to use
        if (payload.video_type === "ai-images") {
          console.log(`[consume-queue] Processing AI-images video for job ${msgId}`);
          
          // 1) Call the generate-ai-video edge function to generate script, audio, and images
          const aiVideoResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/generate-ai-video`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                userId: payload.user_uid,
                category: payload.category,
                prompt: payload.prompt,
                duration: payload.duration,
                language: payload.language,
                voice: payload.narrator_voice,
                artStyle: payload.art_style,
              }),
            }
          );

          if (!aiVideoResponse.ok) {
            const errorText = await aiVideoResponse.text();
            throw new Error(`Generate-ai-video failed: ${errorText}`);
          }

          const aiVideoData = await aiVideoResponse.json();
          
          if (aiVideoData.error) {
            throw new Error(aiVideoData.error);
          }

          audioUrl = aiVideoData.audioUrl;
          script = aiVideoData.script || "";
          const subtitles = aiVideoData.subtitles || "";
          const generatedImages = aiVideoData.generatedImages || [];
          const audioDuration = aiVideoData.audioDuration;

          if (!audioUrl) {
            throw new Error("Missing audioUrl from generate-ai-video response");
          }

          if (!generatedImages || generatedImages.length === 0) {
            throw new Error("No images generated from generate-ai-video response");
          }

          console.log(`[consume-queue] Generated ${generatedImages.length} AI images and audio for job ${msgId}`);

          // 2) Call /api/merge-ai-video to merge images with audio
          const baseUrl =
            process.env.NEXT_PUBLIC_SITE_URL ||
            (process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "http://localhost:3000");

          const mergeAiResponse = await fetch(new URL("/api/merge-ai-video", baseUrl).toString(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              audioUrl,
              subtitles,
              generatedImages,
              audioDuration,
            }),
          });

          if (!mergeAiResponse.ok) {
            const errorText = await mergeAiResponse.text();
            throw new Error(`Merge-ai-video failed: ${errorText}`);
          }

          const mergeAiData = await mergeAiResponse.json();

          if (!mergeAiData?.url) {
            throw new Error("Merge-ai-video did not return url");
          }

          videoUrl = mergeAiData.url;

          console.log(`[consume-queue] Successfully merged AI video for job ${msgId}: ${videoUrl}`);

        } else {
          console.log(`[consume-queue] Processing gameplay video for job ${msgId}`);

          // Original flow: Call generate-video for audio/subtitles, then merge with background
          const generateResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/generate-video`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                category: payload.category,
                prompt: payload.prompt,
                duration: payload.duration,
                language: payload.language,
                voice: payload.narrator_voice,
              }),
            }
          );

          if (!generateResponse.ok) {
            const errorText = await generateResponse.text();
            throw new Error(`Generate-video failed: ${errorText}`);
          }

          const generateData = await generateResponse.json();
          
          if (generateData.error) {
            throw new Error(generateData.error);
          }

          audioUrl = generateData.audioUrl;
          script = generateData.script || "";

          if (!audioUrl) {
            throw new Error("Missing audioUrl from generate-video response");
          }

          console.log(`[consume-queue] Generated audio for job ${msgId} (${payload.series_name})`);

          // Call /api/merge with background video
          const baseUrl =
            process.env.NEXT_PUBLIC_SITE_URL ||
            (process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "http://localhost:3000");

          const mergeResponse = await fetch(new URL("/api/merge", baseUrl).toString(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              audioUrl,
              // Subtitles will be generated later by the FFmpeg worker (Python/stable-ts)
              subtitles: "",
              backgroundVideoUrl: payload.background_video,
            }),
          });

          if (!mergeResponse.ok) {
            const errorText = await mergeResponse.text();
            throw new Error(`Merge failed: ${errorText}`);
          }

          const mergeData = await mergeResponse.json();

          if (!mergeData?.success || !mergeData?.url) {
            throw new Error("Merge did not return success or url");
          }

          videoUrl = mergeData.url;

          console.log(`[consume-queue] Successfully merged gameplay video for job ${msgId}: ${videoUrl}`);
        }

        console.log(`[consume-queue] Successfully processed job ${msgId}: ${videoUrl}`);

        // 3) Archive the message on success
        const { error: archiveError } = await supabaseAdmin.rpc(
          "pgmq_archive_video",
          {
            queue_name: "video_generation_queue",
            msg_id: msgId,
          }
        );

        if (archiveError) {
          console.error(
            `[consume-queue] Error archiving message ${msgId}:`,
            archiveError
          );
          // Continue processing even if archive fails
        }

        results.push({
          msgId,
          automationId: payload.automation_id,
          seriesName: payload.series_name,
          videoUrl: videoUrl,
          videoType: payload.video_type,
          audioUrl,
          script,
        });

      } catch (error: any) {
        console.error(`[consume-queue] Error processing job ${msgId}:`, error);
        
        // Delete the message on hard failure to avoid infinite retries
        const { error: deleteError } = await supabaseAdmin.rpc(
          "pgmq_delete_video",
          {
            queue_name: "video_generation_queue",
            msg_id: msgId,
          }
        );

        if (deleteError) {
          console.error(
            `[consume-queue] Error deleting failed message ${msgId}:`,
            deleteError
          );
        }

        errors.push({
          msgId,
          automationId: payload.automation_id,
          seriesName: payload.series_name,
          error: error.message || "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      total: messages.length,
      results,
      errors,
    });

  } catch (error: any) {
    console.error("[consume-queue] Unexpected error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}