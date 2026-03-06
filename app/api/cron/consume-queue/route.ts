import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET;
/** Optional: bypass Vercel Deployment Protection when cron calls internal APIs (merge, merge-ai-video). Set in Vercel Dashboard > Deployment Protection > Bypass for Automation. */
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

/** Maximum number of processing attempts before a queue message is permanently archived as failed. */
const MAX_RETRIES = 10;

/** Builds full URL for internal API call; adds Vercel protection bypass params when VERCEL_AUTOMATION_BYPASS_SECRET is set. */
function internalApiUrl(path: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const url = new URL(path, baseUrl);
  if (VERCEL_BYPASS_SECRET) {
    url.searchParams.set("x-vercel-set-bypass-cookie", "true");
    url.searchParams.set("x-vercel-protection-bypass", VERCEL_BYPASS_SECRET);
  }
  return url.toString();
}

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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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
      const retryCount: number = job.read_ct ?? 1;

      // If message exceeded max retries, archive it for audit and skip processing
      if (retryCount > MAX_RETRIES) {
        console.error(
          `[consume-queue] Job ${msgId} permanently failed after ${retryCount} attempts (max ${MAX_RETRIES}). Archiving for audit.`
        );

        const { error: archiveFailedError } = await supabaseAdmin.rpc(
          "pgmq_archive_video",
          {
            queue_name: "video_generation_queue",
            msg_id: msgId,
          }
        );

        if (archiveFailedError) {
          console.error(
            `[consume-queue] Failed to archive permanently failed message ${msgId}:`,
            archiveFailedError
          );
        }

        errors.push({
          msgId,
          automationId: payload.automation_id,
          seriesName: payload.series_name,
          error: `Permanently failed after ${retryCount} attempts`,
          permanentlyFailed: true,
        });

        continue;
      }

      console.log(
        "[consume-queue] Processing job",
        JSON.stringify({
          msg_id: msgId,
          attempt: `${retryCount}/${MAX_RETRIES}`,
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
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
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
          const metadata = aiVideoData.metadata; // Extract metadata

          if (!audioUrl) {
            throw new Error("Missing audioUrl from generate-ai-video response");
          }

          if (!generatedImages || generatedImages.length === 0) {
            throw new Error("No images generated from generate-ai-video response");
          }

          console.log(`[consume-queue] Generated ${generatedImages.length} AI images and audio for job ${msgId}`);

          // 2) Call /api/merge-ai-video to merge images with audio
          const mergeAiHeaders: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (CRON_SECRET) {
            mergeAiHeaders["Authorization"] = `Bearer ${CRON_SECRET}`;
          }
          if (VERCEL_BYPASS_SECRET) {
            mergeAiHeaders["x-vercel-protection-bypass"] = VERCEL_BYPASS_SECRET;
          }
          const mergeAiResponse = await fetch(internalApiUrl("/api/merge-ai-video"), {
            method: "POST",
            headers: mergeAiHeaders,
            body: JSON.stringify({
              audioUrl,
              subtitles,
              generatedImages,
              audioDuration,
              scheduledTime: payload.scheduled_time,
              platforms: payload.social_platforms || [],
              userId: payload.user_uid,
              metadata, // Add metadata
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
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
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
          const metadata = generateData.metadata; // Extract metadata

          if (!audioUrl) {
            throw new Error("Missing audioUrl from generate-video response");
          }

          console.log(`[consume-queue] Generated audio for job ${msgId} (${payload.series_name})`);

          // Call /api/merge with background video
          const mergeHeaders: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (CRON_SECRET) {
            mergeHeaders["Authorization"] = `Bearer ${CRON_SECRET}`;
          }
          if (VERCEL_BYPASS_SECRET) {
            mergeHeaders["x-vercel-protection-bypass"] = VERCEL_BYPASS_SECRET;
          }
          const mergeResponse = await fetch(internalApiUrl("/api/merge"), {
            method: "POST",
            headers: mergeHeaders,
            body: JSON.stringify({
              audioUrl,
              // Subtitles will be generated later by the FFmpeg worker (Python/stable-ts)
              subtitles: "",
              backgroundVideoUrl: payload.background_video,
              scheduledTime: payload.scheduled_time,
              platforms: payload.social_platforms || [],
              userId: payload.user_uid,
              metadata, // Add metadata
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

        // Archive the message on success
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
        console.error(
          `[consume-queue] Error processing job ${msgId} (attempt ${retryCount}/${MAX_RETRIES}):`,
          error
        );

        // Release the message back to the queue immediately (VT = 0)
        // so it can be retried on the next cron tick instead of waiting 1 hour.
        // Requires the pgmq_set_vt_video RPC in Supabase (see docs/supabase-rpcs.sql).
        // If the RPC is missing, the message will reappear automatically when the VT expires (1h).
        const { error: setVtError } = await supabaseAdmin.rpc("pgmq_set_vt_video", {
          queue_name: "video_generation_queue",
          msg_id: msgId,
          vt: 0,
        });
        if (setVtError) {
          console.warn(
            `[consume-queue] set_vt failed for msg ${msgId} (message will reappear when VT expires):`,
            setVtError.message
          );
        }

        errors.push({
          msgId,
          automationId: payload.automation_id,
          seriesName: payload.series_name,
          error: error.message || "Unknown error",
          attempt: retryCount,
          remainingRetries: MAX_RETRIES - retryCount,
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