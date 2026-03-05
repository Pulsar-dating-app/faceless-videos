import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      const cronSecret = request.nextUrl.searchParams.get('secret');

      if (authHeader !== `Bearer ${CRON_SECRET}` && cronSecret !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('[queue-scheduler] Starting cronjob...');

    // Get posts that are pending and scheduled within 30 minutes (past or future)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { data: posts, error: fetchError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'pending')
      .gte('scheduled_time', thirtyMinutesAgo)
      .lte('scheduled_time', thirtyMinutesFromNow);

    if (fetchError) {
      console.error('[queue-scheduler] Error fetching posts:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      console.log('[queue-scheduler] No pending posts to schedule');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending posts to schedule',
      });
    }

    console.log(`[queue-scheduler] Found ${posts.length} pending posts`);

    const results = [];
    const errors = [];

    for (const post of posts) {
      try {
        const platforms = post.platforms as { youtube?: boolean; tiktok?: boolean; instagram?: boolean };

        // Skip if no platforms enabled
        if (!platforms.tiktok && !platforms.instagram) {
          console.log(`[queue-scheduler] Post ${post.id} has no TikTok/Instagram platforms, skipping queue`);
          continue;
        }

        // Check if message already exists in queue for this post
        const { data: existingMessages } = await supabaseAdmin.rpc('pgmq_read_posting', {
          queue_name: 'posting_queue',
          visibility_timeout: 1, // Just peek, don't lock
          qty: 100, // Check up to 100 messages
        });

        // Check if this post is already in queue
        const alreadyQueued = existingMessages?.some(
          (msg: any) => msg.message?.scheduled_post_id === post.id
        );

        if (alreadyQueued) {
          console.log(`[queue-scheduler] Post ${post.id} already in queue, skipping`);
          continue;
        }

        // Build queue message
        const queueMessage = {
          scheduled_post_id: post.id,
          user_uid: post.user_uid,
          video_url: post.video_url,
          scheduled_time: post.scheduled_time,
          platforms: {
            tiktok: platforms.tiktok || false,
            instagram: platforms.instagram || false,
          },
        };

        // Add to posting queue
        const { error: queueError } = await supabaseAdmin.rpc('pgmq_send_posting', {
          queue_name: 'posting_queue',
          message: queueMessage,
        });

        if (queueError) {
          console.error(`[queue-scheduler] Error adding post ${post.id} to queue:`, queueError);
          errors.push({ postId: post.id, error: queueError.message });
          continue;
        }

        console.log(`[queue-scheduler] ✅ Added post ${post.id} to queue`);
        results.push({ postId: post.id, success: true });

      } catch (error: any) {
        console.error(`[queue-scheduler] Error processing post ${post.id}:`, error);
        errors.push({ postId: post.id, error: error.message });
      }
    }

    console.log(`[queue-scheduler] Completed: ${results.length} added, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      total: posts.length,
      results,
      errors,
    });

  } catch (error: any) {
    console.error('[queue-scheduler] Unexpected error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
