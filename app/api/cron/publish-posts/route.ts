import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { postToTikTok, postToInstagram } from '@/lib/social-posting';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

interface PostingQueueMessage {
  scheduled_post_id: string;
  user_uid: string;
  video_url: string;
  scheduled_time: string;
  platforms: {
    tiktok: boolean;
    instagram: boolean;
  };
}

export const maxDuration = 300;

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

    console.log('[publish-posts] Starting cronjob...');

    // Read messages from posting queue
    const { data: messages, error: readError } = await supabaseAdmin.rpc('pgmq_read_posting', {
      queue_name: 'posting_queue',
      visibility_timeout: 1200, // 20 min visibility timeout
      qty: 10, // Process up to 10 posts per run
    });

    if (readError) {
      console.error('[publish-posts] Error reading posting queue:', readError);
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      console.log('[publish-posts] No posts to publish');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No posts to publish',
      });
    }

    console.log(`[publish-posts] Found ${messages.length} messages in queue`);

    const results = [];
    const errors = [];

    for (const job of messages) {
      const msgId = job.msg_id;
      const payload = job.message as PostingQueueMessage;

      try {
        console.log(`[publish-posts] Processing message ${msgId}`);

        // Get scheduled post from database
        const { data: scheduledPost, error: postError } = await supabaseAdmin
          .from('scheduled_posts')
          .select('*')
          .eq('id', payload.scheduled_post_id)
          .single();

        if (postError || !scheduledPost) {
          throw new Error('Scheduled post not found');
        }

        // Skip already-published posts (e.g. user clicked "Publish Now" before cron ran)
        if (scheduledPost.status === 'published') {
          console.log(`[publish-posts] Post ${payload.scheduled_post_id} already published, archiving message`);
          await supabaseAdmin.rpc('pgmq_archive_posting', {
            queue_name: 'posting_queue',
            msg_id: msgId,
          });
          continue;
        }

        // Check retry count
        if (scheduledPost.retry_count >= scheduledPost.max_retries) {
          console.log(`[publish-posts] Max retries exceeded for ${msgId}`);
          
          await supabaseAdmin
            .from('scheduled_posts')
            .update({ status: 'failed', last_error: 'Max retries exceeded' })
            .eq('id', payload.scheduled_post_id);

          await supabaseAdmin.rpc('pgmq_archive_posting', {
            queue_name: 'posting_queue',
            msg_id: msgId,
          });

          errors.push({ msgId, error: 'Max retries exceeded' });
          continue;
        }

        // Update status to processing
        await supabaseAdmin
          .from('scheduled_posts')
          .update({ status: 'processing' })
          .eq('id', payload.scheduled_post_id);

        // Post to platforms
        const postResults = {
          tiktok: null as { publishId: string; success: true } | { error: string } | null,
          instagram: null as { mediaId: string; success: true } | { error: string } | null,
        };

        if (payload.platforms.tiktok) {
          console.log(`[publish-posts] Posting to TikTok for ${msgId}`);
          try {
            postResults.tiktok = await postToTikTok(
              payload.user_uid,
              payload.video_url,
              supabaseAdmin,
              scheduledPost
            );
            console.log(`[publish-posts] ✅ TikTok post successful`);
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('[publish-posts] TikTok post failed:', error);
            postResults.tiktok = { error: msg };
          }
        }

        if (payload.platforms.instagram) {
          console.log(`[publish-posts] Posting to Instagram for ${msgId}`);
          try {
            postResults.instagram = await postToInstagram(
              payload.user_uid,
              payload.video_url,
              supabaseAdmin,
              scheduledPost
            );
            console.log(`[publish-posts] ✅ Instagram post successful`);
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('[publish-posts] Instagram post failed:', error);
            postResults.instagram = { error: msg };
          }
        }

        // Check if all posts succeeded
        const tiktokSuccess = !payload.platforms.tiktok || !('error' in (postResults.tiktok ?? {}));
        const instagramSuccess = !payload.platforms.instagram || !('error' in (postResults.instagram ?? {}));
        const allSuccess = tiktokSuccess && instagramSuccess;

        if (allSuccess) {
          console.log(`[publish-posts] All platforms successful for ${msgId}`);
          
          const tiktokOk = postResults.tiktok && 'publishId' in postResults.tiktok ? postResults.tiktok : null;
          const instagramOk = postResults.instagram && 'mediaId' in postResults.instagram ? postResults.instagram : null;

          await supabaseAdmin
            .from('scheduled_posts')
            .update({
              status: 'published',
              tiktok_publish_id: tiktokOk?.publishId || null,
              tiktok_posted_at: tiktokOk ? new Date().toISOString() : null,
              instagram_media_id: instagramOk?.mediaId || null,
              instagram_posted_at: instagramOk ? new Date().toISOString() : null,
            })
            .eq('id', payload.scheduled_post_id);

          // Archive the message
          await supabaseAdmin.rpc('pgmq_archive_posting', {
            queue_name: 'posting_queue',
            msg_id: msgId,
          });

          results.push({ msgId, scheduledPostId: payload.scheduled_post_id, success: true });
        } else {
          console.log(`[publish-posts] Partial failure for ${msgId}, will retry`);
          
          const tiktokErr = postResults.tiktok && 'error' in postResults.tiktok ? postResults.tiktok.error : null;
          const instagramErr = postResults.instagram && 'error' in postResults.instagram ? postResults.instagram.error : null;

          await supabaseAdmin
            .from('scheduled_posts')
            .update({
              status: 'pending',
              retry_count: scheduledPost.retry_count + 1,
              last_error: JSON.stringify({ tiktok: tiktokErr, instagram: instagramErr }),
            })
            .eq('id', payload.scheduled_post_id);

          errors.push({
            msgId,
            scheduledPostId: payload.scheduled_post_id,
            error: 'Partial failure, will retry',
          });
        }

      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[publish-posts] Error processing post ${msgId}:`, error);

        const { data: scheduledPost } = await supabaseAdmin
          .from('scheduled_posts')
          .select('retry_count, max_retries')
          .eq('id', payload.scheduled_post_id)
          .single();

        if (scheduledPost && scheduledPost.retry_count < scheduledPost.max_retries) {
          await supabaseAdmin
            .from('scheduled_posts')
            .update({
              status: 'pending',
              retry_count: scheduledPost.retry_count + 1,
              last_error: msg,
            })
            .eq('id', payload.scheduled_post_id);
        } else {
          await supabaseAdmin
            .from('scheduled_posts')
            .update({
              status: 'failed',
              last_error: msg,
            })
            .eq('id', payload.scheduled_post_id);

          await supabaseAdmin.rpc('pgmq_archive_posting', {
            queue_name: 'posting_queue',
            msg_id: msgId,
          });
        }

        errors.push({ msgId, error: msg });
      }
    }

    console.log(`[publish-posts] Completed: ${results.length} success, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      total: messages.length,
      results,
      errors,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[publish-posts] Unexpected error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
