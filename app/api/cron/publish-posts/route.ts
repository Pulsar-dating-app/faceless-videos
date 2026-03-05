import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
          tiktok: null as any,
          instagram: null as any,
        };

        if (payload.platforms.tiktok) {
          console.log(`[publish-posts] Posting to TikTok for ${msgId}`);
          try {
            postResults.tiktok = await postToTikTok(
              payload.user_uid,
              payload.video_url,
              supabaseAdmin
            );
            console.log(`[publish-posts] ✅ TikTok post successful`);
          } catch (error: any) {
            console.error('[publish-posts] TikTok post failed:', error);
            postResults.tiktok = { error: error.message };
          }
        }

        if (payload.platforms.instagram) {
          console.log(`[publish-posts] Posting to Instagram for ${msgId}`);
          try {
            postResults.instagram = await postToInstagram(
              payload.user_uid,
              payload.video_url,
              supabaseAdmin
            );
            console.log(`[publish-posts] ✅ Instagram post successful`);
          } catch (error: any) {
            console.error('[publish-posts] Instagram post failed:', error);
            postResults.instagram = { error: error.message };
          }
        }

        // Check if all posts succeeded
        const tiktokSuccess = !payload.platforms.tiktok || !postResults.tiktok?.error;
        const instagramSuccess = !payload.platforms.instagram || !postResults.instagram?.error;
        const allSuccess = tiktokSuccess && instagramSuccess;

        if (allSuccess) {
          console.log(`[publish-posts] All platforms successful for ${msgId}`);
          
          // Update scheduled_posts with success
          await supabaseAdmin
            .from('scheduled_posts')
            .update({
              status: 'published',
              tiktok_publish_id: postResults.tiktok?.publishId || null,
              tiktok_posted_at: postResults.tiktok ? new Date().toISOString() : null,
              instagram_media_id: postResults.instagram?.mediaId || null,
              instagram_posted_at: postResults.instagram ? new Date().toISOString() : null,
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
          
          // Increment retry count
          await supabaseAdmin
            .from('scheduled_posts')
            .update({
              status: 'pending',
              retry_count: scheduledPost.retry_count + 1,
              last_error: JSON.stringify({
                tiktok: postResults.tiktok?.error || null,
                instagram: postResults.instagram?.error || null,
              }),
            })
            .eq('id', payload.scheduled_post_id);

          // Message will be visible again after visibility timeout
          errors.push({
            msgId,
            scheduledPostId: payload.scheduled_post_id,
            error: 'Partial failure, will retry',
          });
        }

      } catch (error: any) {
        console.error(`[publish-posts] Error processing post ${msgId}:`, error);

        // Increment retry count
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
              last_error: error.message,
            })
            .eq('id', payload.scheduled_post_id);
        } else {
          await supabaseAdmin
            .from('scheduled_posts')
            .update({
              status: 'failed',
              last_error: error.message,
            })
            .eq('id', payload.scheduled_post_id);

          await supabaseAdmin.rpc('pgmq_archive_posting', {
            queue_name: 'posting_queue',
            msg_id: msgId,
          });
        }

        errors.push({ msgId, error: error.message });
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

  } catch (error: any) {
    console.error('[publish-posts] Unexpected error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function postToTikTok(userId: string, videoUrl: string, supabase: any) {
  // Get TikTok connection
  const { data: connection } = await supabase
    .from('social_media_connections')
    .select('*')
    .eq('user_uid', userId)
    .eq('platform', 'tiktok')
    .single();

  if (!connection) {
    throw new Error('TikTok not connected');
  }

  // Download video
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.statusText}`);
  }

  const videoBlob = await videoResponse.blob();
  const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());

  console.log(`[TikTok] Downloaded video: ${videoBuffer.length} bytes`);

  // TikTok API: Initialize upload
  // For unaudited apps, use inbox endpoint and SELF_ONLY privacy
  const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: 'Auto-generated video',
        privacy_level: 'SELF_ONLY', // Required for unaudited apps
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoBuffer.length,
        chunk_size: videoBuffer.length,
        total_chunk_count: 1,
      },
    }),
  });

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw new Error(`TikTok init failed: ${errorText}`);
  }

  const initData = await initResponse.json();
  
  if (!initData.data || !initData.data.upload_url) {
    throw new Error('TikTok init response missing upload_url');
  }

  const uploadUrl = initData.data.upload_url;
  const publishId = initData.data.publish_id;

  console.log(`[TikTok] Upload initialized: ${publishId}`);

  // Upload video
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': videoBuffer.length.toString(),
    },
    body: videoBuffer,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`TikTok upload failed: ${errorText}`);
  }

  console.log(`[TikTok] Upload successful: ${publishId}`);

  return { publishId, success: true };
}

async function postToInstagram(userId: string, videoUrl: string, supabase: any) {
  // Get Instagram connection
  const { data: connection } = await supabase
    .from('social_media_connections')
    .select('*')
    .eq('user_uid', userId)
    .eq('platform', 'instagram')
    .single();

  if (!connection) {
    throw new Error('Instagram not connected');
  }

  const accountId = connection.metadata?.instagram_user_id || connection.account_id;

  if (!accountId) {
    throw new Error('Instagram account ID not found');
  }

  console.log(`[Instagram] Creating media container for account: ${accountId}`);

  // Instagram requires publicly accessible URL
  // Create media container
  const containerResponse = await fetch(
    `https://graph.instagram.com/v21.0/${accountId}/media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_url: videoUrl,
        media_type: 'REELS',
        caption: 'Auto-generated video',
        access_token: connection.access_token,
      }),
    }
  );

  if (!containerResponse.ok) {
    const errorText = await containerResponse.text();
    throw new Error(`Instagram container failed: ${errorText}`);
  }

  const containerData = await containerResponse.json();
  const containerId = containerData.id;

  console.log(`[Instagram] Media container created: ${containerId}`);

  // Wait for Instagram to process the video by checking status
  let statusCheckAttempts = 0;
  const maxStatusChecks = 30; // Max 5 minutes (30 * 10s)
  let isReady = false;

  while (statusCheckAttempts < maxStatusChecks && !isReady) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds between checks
    
    const statusResponse = await fetch(
      `https://graph.instagram.com/v21.0/${containerId}?fields=status_code&access_token=${connection.access_token}`,
      { method: 'GET' }
    );

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log(`[Instagram] Container status: ${statusData.status_code}`);
      
      if (statusData.status_code === 'FINISHED') {
        isReady = true;
      } else if (statusData.status_code === 'ERROR') {
        throw new Error('Instagram video processing failed');
      }
      // PUBLISHED, IN_PROGRESS, EXPIRED - keep waiting
    }
    
    statusCheckAttempts++;
  }

  if (!isReady) {
    throw new Error('Instagram video processing timeout - container not ready after 5 minutes');
  }

  console.log(`[Instagram] Container ready, publishing...`);

  // Publish media
  const publishResponse = await fetch(
    `https://graph.instagram.com/v21.0/${accountId}/media_publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: connection.access_token,
      }),
    }
  );

  if (!publishResponse.ok) {
    const errorText = await publishResponse.text();
    throw new Error(`Instagram publish failed: ${errorText}`);
  }

  const publishData = await publishResponse.json();

  console.log(`[Instagram] Published: ${publishData.id}`);

  return { mediaId: publishData.id, success: true };
}
