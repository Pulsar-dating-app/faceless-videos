import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { publishId, userId } = await request.json();

    if (!publishId || !userId) {
      return NextResponse.json(
        { error: 'publishId and userId are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: connection, error: connError } = await supabaseAdmin
      .from('social_media_connections')
      .select('access_token')
      .eq('user_uid', userId)
      .eq('platform', 'tiktok')
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'TikTok connection not found' },
        { status: 404 }
      );
    }

    const statusResponse = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: publishId }),
      }
    );

    const statusData = await statusResponse.json();

    return NextResponse.json(statusData, { status: statusResponse.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[tiktok-post-status] Error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
