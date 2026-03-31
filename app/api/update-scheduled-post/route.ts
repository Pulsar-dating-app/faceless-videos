import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PATCH(request: NextRequest) {
  try {
    const { scheduledPostId, userId, title, description, hashtags } = await request.json();

    if (!scheduledPostId || !userId) {
      return NextResponse.json(
        { error: 'scheduledPostId and userId are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabaseAdmin
      .from('scheduled_posts')
      .update({
        title: title || null,
        description: description || null,
        hashtags: hashtags ?? null,
      })
      .eq('id', scheduledPostId)
      .eq('user_uid', userId);

    if (error) {
      console.error('[update-scheduled-post] DB error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
