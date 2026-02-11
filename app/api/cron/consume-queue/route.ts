import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET;

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

    // Read a single job from pgmq with a visibility timeout (e.g. 60 seconds)
    const { data: messages, error: readError } = await supabaseAdmin.rpc(
      "pgmq_read_video",
      {
        queue_name: "video_generation_queue",
        vt: 60,
        qty: 1,
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

    const job = messages[0] as any;
    const msgId: number = job.msg_id;
    const payload = job.message as any;

    console.log(
      "[consume-queue] Processing job",
      JSON.stringify({
        msg_id: msgId,
        automation_id: payload?.automation_id,
        user_uid: payload?.user_uid,
        scheduled_time: payload?.scheduled_time,
      })
    );

    // Create Supabase client for functions (can use service role key)
    const supabaseFunctions = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // Invoke generate-video edge function with internal queue header
    const { data, error } = await supabaseFunctions.functions.invoke(
      "generate-video",
      {
        body: payload,
        headers: {
          "x-internal-queue": "video_generation",
        },
      }
    );

    if (error || data?.error) {
      console.error(
        "[consume-queue] Error from generate-video:",
        error || data?.error
      );

      // On hard failure, delete the message to avoid infinite retries
      const { error: deleteError } = await supabaseAdmin.rpc(
        "pgmq_delete_video",
        {
          queue_name: "video_generation_queue",
          msg_id: msgId,
        }
      );

      if (deleteError) {
        console.error(
          "[consume-queue] Error deleting failed message from pgmq:",
          deleteError
        );
      }

      return NextResponse.json(
        {
          success: false,
          processed: 0,
          msg_id: msgId,
          automation_id: payload?.automation_id,
          error: error?.message || data?.error || "Failed to generate video",
        },
        { status: 500 }
      );
    }

    // On success, archive the message
    const { error: archiveError } = await supabaseAdmin.rpc(
      "pgmq_archive_video",
      {
        queue_name: "video_generation_queue",
        msg_id: msgId,
      }
    );

    if (archiveError) {
      console.error(
        "[consume-queue] Error archiving message in pgmq:",
        archiveError
      );
      return NextResponse.json(
        {
          success: false,
          processed: 0,
          msg_id: msgId,
          automation_id: payload?.automation_id,
          error: archiveError.message || "Failed to archive message",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      processed: 1,
      msg_id: msgId,
      automation_id: payload?.automation_id,
    });
  } catch (error: any) {
    console.error("[consume-queue] Unexpected error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

