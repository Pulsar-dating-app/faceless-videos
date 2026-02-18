import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
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
          { error: "Unauthorized. Provide CRON_SECRET via ?secret=YOUR_SECRET or Authorization: Bearer YOUR_SECRET header" },
          { status: 401 }
        );
      }
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500 }
      );
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Call the schedule-videos edge function
    const { data, error } = await supabase.functions.invoke("schedule-videos", {
      body: {},
    });

    if (error) {
      console.error("Error calling schedule-videos:", error);
      return NextResponse.json(
        { error: error.message || "Failed to schedule videos" },
        { status: 500 }
      );
    }

    if (data?.error) {
      console.error("Error from schedule-videos:", data.error);
      return NextResponse.json(
        { error: data.error },
        { status: 500 }
      );
    }

    console.log(`✅ [CRON] Scheduled ${data?.queued || 0} videos`);

    return NextResponse.json({
      success: true,
      queued: data?.queued || 0,
      total: data?.total || 0,
      errors: data?.errors || [],
    });

  } catch (error: any) {
    console.error("Error in cron schedule-videos:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
