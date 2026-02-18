import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    if (CRON_SECRET) {
      const authHeader = request.headers.get("authorization");
      const cronSecret = request.nextUrl.searchParams.get("secret");
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.functions.invoke("reset-generations", { body: {} });

    if (error) {
      console.error("Error calling reset-generations:", error);
      return NextResponse.json(
        { error: error.message || "Failed to reset generations" },
        { status: 500 }
      );
    }

    if (data?.error) {
      console.error("Error from reset-generations:", data.error);
      return NextResponse.json(
        { error: data.error },
        { status: 500 }
      );
    }

    console.log(`✅ [CRON] Reset generations completed, count: ${data?.resetCount ?? 0}`);

    return NextResponse.json({
      success: true,
      resetCount: data?.resetCount ?? 0,
    });
  } catch (error: any) {
    console.error("Error in cron reset-generations:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
