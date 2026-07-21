import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { checkTikTokStatus, checkInstagramContainerStatus } from '@/lib/social-status';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

// scheduled_posts has no retry_count/max_retries columns — each platform tracks its own
// attempts independently via tiktok_retry_count / instagram_retry_count.
const MAX_RETRIES = 3;

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

type PlatformResult = { terminal: boolean; success: boolean };
type SupabaseAdmin = SupabaseClient;

interface ScheduledPostRow {
  id: string;
  hashtags?: string[] | null;
  description?: string | null;
  title?: string | null;
  tiktok_status?: string | null;
  tiktok_retry_count?: number | null;
  tiktok_publish_id?: string | null;
  tiktok_posted_at?: string | null;
  instagram_status?: string | null;
  instagram_retry_count?: number | null;
  instagram_container_id?: string | null;
  instagram_media_id?: string | null;
  instagram_posted_at?: string | null;
  [key: string]: unknown;
}

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      const cronSecret = request.nextUrl.searchParams.get('secret');

      if (authHeader !== `Bearer ${CRON_SECRET}` && cronSecret !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('[publish-posts] Starting cronjob...');

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

        const { data: scheduledPost, error: postError } = await supabaseAdmin
          .from('scheduled_posts')
          .select('*')
          .eq('id', payload.scheduled_post_id)
          .single();

        if (postError || !scheduledPost) {
          throw new Error('Scheduled post not found');
        }

        const tiktokResult: PlatformResult = payload.platforms.tiktok
          ? await processTikTokPlatform(supabaseAdmin, scheduledPost, payload)
          : { terminal: true, success: true };

        const instagramResult: PlatformResult = payload.platforms.instagram
          ? await processInstagramPlatform(supabaseAdmin, scheduledPost, payload)
          : { terminal: true, success: true };

        const bothTerminal = tiktokResult.terminal && instagramResult.terminal;
        const bothSuccess = tiktokResult.success && instagramResult.success;

        if (bothTerminal) {
          const overallStatus = bothSuccess
            ? 'published'
            : (!tiktokResult.success && !instagramResult.success)
              ? 'failed'
              : 'partial';

          await supabaseAdmin
            .from('scheduled_posts')
            .update({ status: overallStatus })
            .eq('id', payload.scheduled_post_id);

          await supabaseAdmin.rpc('pgmq_archive_posting', {
            queue_name: 'posting_queue',
            msg_id: msgId,
          });

          if (bothSuccess) {
            console.log(`[publish-posts] All platforms successful for ${msgId}`);
            results.push({ msgId, scheduledPostId: payload.scheduled_post_id, success: true });
          } else {
            console.log(`[publish-posts] Terminal state (partial/failed) for ${msgId}`);
            errors.push({
              msgId,
              scheduledPostId: payload.scheduled_post_id,
              error: `tiktok=${tiktokResult.success ? 'ok' : 'failed'}, instagram=${instagramResult.success ? 'ok' : 'failed'}`,
            });
          }
        } else {
          console.log(`[publish-posts] Still processing ${msgId}, will recheck next run`);
          await supabaseAdmin
            .from('scheduled_posts')
            .update({ status: 'processing' })
            .eq('id', payload.scheduled_post_id);

          // Message stays in the queue and reappears after the visibility timeout.
          errors.push({ msgId, scheduledPostId: payload.scheduled_post_id, error: 'Still processing, will retry' });
        }

      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[publish-posts] Error processing post ${msgId}:`, error);
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

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[publish-posts] Unexpected error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function recordTikTokFailure(
  supabase: SupabaseAdmin,
  postId: string,
  currentRetryCount: number,
  message: string
): Promise<PlatformResult> {
  const newRetryCount = currentRetryCount + 1;
  const nowFailed = newRetryCount >= MAX_RETRIES;
  await supabase
    .from('scheduled_posts')
    .update({
      tiktok_retry_count: newRetryCount,
      tiktok_last_error: message,
      tiktok_status: nowFailed ? 'failed' : 'pending',
    })
    .eq('id', postId);
  return { terminal: nowFailed, success: false };
}

async function processTikTokPlatform(
  supabase: SupabaseAdmin,
  scheduledPost: ScheduledPostRow,
  payload: PostingQueueMessage
): Promise<PlatformResult> {
  if (scheduledPost.tiktok_status === 'published') {
    return { terminal: true, success: true };
  }
  if (scheduledPost.tiktok_status === 'failed') {
    return { terminal: true, success: false };
  }

  const retryCount = scheduledPost.tiktok_retry_count || 0;
  if (retryCount >= MAX_RETRIES) {
    await supabase
      .from('scheduled_posts')
      .update({ tiktok_status: 'failed', tiktok_last_error: 'Max retries exceeded' })
      .eq('id', scheduledPost.id);
    return { terminal: true, success: false };
  }

  // Already attempted before — ask TikTok what actually happened instead of trusting local state.
  if (scheduledPost.tiktok_publish_id) {
    const { data: connection } = await supabase
      .from('social_media_connections')
      .select('access_token')
      .eq('user_uid', payload.user_uid)
      .eq('platform', 'tiktok')
      .single();

    if (!connection) {
      return recordTikTokFailure(supabase, scheduledPost.id, retryCount, 'TikTok not connected');
    }

    try {
      const { status, failReason } = await checkTikTokStatus(scheduledPost.tiktok_publish_id, connection.access_token);

      if (status === 'PUBLISH_COMPLETE' || status === 'SEND_TO_USER_INBOX') {
        await supabase
          .from('scheduled_posts')
          .update({
            tiktok_status: 'published',
            tiktok_posted_at: scheduledPost.tiktok_posted_at || new Date().toISOString(),
          })
          .eq('id', scheduledPost.id);
        return { terminal: true, success: true };
      }

      if (status === 'FAILED') {
        await supabase.from('scheduled_posts').update({ tiktok_publish_id: null }).eq('id', scheduledPost.id);
        return recordTikTokFailure(supabase, scheduledPost.id, retryCount, failReason || 'TikTok publish failed');
      }

      // PROCESSING_UPLOAD / PROCESSING_DOWNLOAD — still in flight, recheck next run
      await supabase.from('scheduled_posts').update({ tiktok_status: 'processing' }).eq('id', scheduledPost.id);
      return { terminal: false, success: false };
    } catch (error) {
      console.error('[publish-posts] TikTok status check failed:', error);
      return { terminal: false, success: false };
    }
  }

  // Never attempted — post fresh
  try {
    const { publishId, uploadUrl, videoBuffer } = await initTikTokUpload(
      payload.user_uid,
      payload.video_url,
      supabase,
      scheduledPost
    );

    // Save the id before transferring content — closes the "posted but not recorded" window.
    await supabase
      .from('scheduled_posts')
      .update({ tiktok_publish_id: publishId, tiktok_status: 'processing' })
      .eq('id', scheduledPost.id);

    await uploadTikTokVideo(uploadUrl, videoBuffer);

    await supabase
      .from('scheduled_posts')
      .update({ tiktok_status: 'published', tiktok_posted_at: new Date().toISOString() })
      .eq('id', scheduledPost.id);

    console.log(`[publish-posts] ✅ TikTok post successful for ${scheduledPost.id}`);
    return { terminal: true, success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[publish-posts] TikTok post failed:', error);
    return recordTikTokFailure(supabase, scheduledPost.id, retryCount, msg);
  }
}

async function recordInstagramFailure(
  supabase: SupabaseAdmin,
  postId: string,
  currentRetryCount: number,
  message: string
): Promise<PlatformResult> {
  const newRetryCount = currentRetryCount + 1;
  const nowFailed = newRetryCount >= MAX_RETRIES;
  await supabase
    .from('scheduled_posts')
    .update({
      instagram_retry_count: newRetryCount,
      instagram_last_error: message,
      instagram_status: nowFailed ? 'failed' : 'pending',
    })
    .eq('id', postId);
  return { terminal: nowFailed, success: false };
}

async function processInstagramPlatform(
  supabase: SupabaseAdmin,
  scheduledPost: ScheduledPostRow,
  payload: PostingQueueMessage
): Promise<PlatformResult> {
  if (scheduledPost.instagram_status === 'published') {
    return { terminal: true, success: true };
  }
  if (scheduledPost.instagram_status === 'failed') {
    return { terminal: true, success: false };
  }

  const retryCount = scheduledPost.instagram_retry_count || 0;
  if (retryCount >= MAX_RETRIES) {
    await supabase
      .from('scheduled_posts')
      .update({ instagram_status: 'failed', instagram_last_error: 'Max retries exceeded' })
      .eq('id', scheduledPost.id);
    return { terminal: true, success: false };
  }

  try {
    if (scheduledPost.instagram_container_id) {
      const { data: connection } = await supabase
        .from('social_media_connections')
        .select('*')
        .eq('user_uid', payload.user_uid)
        .eq('platform', 'instagram')
        .single();

      if (!connection) {
        throw new Error('Instagram not connected');
      }

      const accountId = connection.metadata?.instagram_user_id || connection.account_id;
      const statusCode = await checkInstagramContainerStatus(scheduledPost.instagram_container_id, connection.access_token);

      if (statusCode === 'PUBLISHED') {
        await supabase
          .from('scheduled_posts')
          .update({
            instagram_status: 'published',
            instagram_posted_at: scheduledPost.instagram_posted_at || new Date().toISOString(),
          })
          .eq('id', scheduledPost.id);
        return { terminal: true, success: true };
      }

      if (statusCode === 'FINISHED') {
        const { mediaId } = await publishInstagramContainer(accountId, scheduledPost.instagram_container_id, connection.access_token);
        await supabase
          .from('scheduled_posts')
          .update({
            instagram_status: 'published',
            instagram_media_id: mediaId,
            instagram_posted_at: new Date().toISOString(),
          })
          .eq('id', scheduledPost.id);
        return { terminal: true, success: true };
      }

      if (statusCode === 'IN_PROGRESS') {
        await supabase.from('scheduled_posts').update({ instagram_status: 'processing' }).eq('id', scheduledPost.id);
        return { terminal: false, success: false };
      }

      // EXPIRED or ERROR — the container is unusable, clear it and try again from scratch
      await supabase.from('scheduled_posts').update({ instagram_container_id: null }).eq('id', scheduledPost.id);
      throw new Error(`Instagram container ${statusCode}`);
    }

    // Never attempted — create a fresh container
    const { containerId, accountId, accessToken } = await createInstagramContainer(
      payload.user_uid,
      payload.video_url,
      supabase,
      scheduledPost
    );

    // Save the container id before waiting/publishing — closes the "posted but not recorded" window.
    await supabase
      .from('scheduled_posts')
      .update({ instagram_container_id: containerId, instagram_status: 'processing' })
      .eq('id', scheduledPost.id);

    await waitForInstagramContainer(containerId, accessToken);
    const { mediaId } = await publishInstagramContainer(accountId, containerId, accessToken);

    await supabase
      .from('scheduled_posts')
      .update({
        instagram_status: 'published',
        instagram_media_id: mediaId,
        instagram_posted_at: new Date().toISOString(),
      })
      .eq('id', scheduledPost.id);

    console.log(`[publish-posts] ✅ Instagram post successful for ${scheduledPost.id}`);
    return { terminal: true, success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[publish-posts] Instagram post failed:', error);
    return recordInstagramFailure(supabase, scheduledPost.id, retryCount, msg);
  }
}

async function initTikTokUpload(userId: string, videoUrl: string, supabase: SupabaseAdmin, scheduledPost: ScheduledPostRow) {
  const { data: connection } = await supabase
    .from('social_media_connections')
    .select('*')
    .eq('user_uid', userId)
    .eq('platform', 'tiktok')
    .single();

  if (!connection) {
    throw new Error('TikTok not connected');
  }

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.statusText}`);
  }

  const videoBlob = await videoResponse.blob();
  const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());

  console.log(`[TikTok] Downloaded video: ${videoBuffer.length} bytes`);

  const hashtagString = scheduledPost?.hashtags?.map((tag: string) => `#${tag}`).join(' ') || '';
  const fullDescription = scheduledPost?.description
    ? `${scheduledPost.description} ${hashtagString}`
    : hashtagString;

  // For unaudited apps, use inbox endpoint and SELF_ONLY privacy
  const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: fullDescription || scheduledPost?.title || 'Auto-generated video',
        privacy_level: 'PUBLIC_TO_EVERYONE',
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

  console.log(`[TikTok] Upload initialized: ${initData.data.publish_id}`);

  return { publishId: initData.data.publish_id as string, uploadUrl: initData.data.upload_url as string, videoBuffer };
}

async function uploadTikTokVideo(uploadUrl: string, videoBuffer: Buffer) {
  const totalBytes = videoBuffer.length;
  const contentRange = `bytes 0-${totalBytes - 1}/${totalBytes}`;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': totalBytes.toString(),
      'Content-Range': contentRange,
    },
    body: videoBuffer as unknown as BodyInit,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    const statusInfo = `${uploadResponse.status} ${uploadResponse.statusText}`;
    const message = errorText?.trim() || statusInfo;
    throw new Error(`TikTok upload failed: ${message}`);
  }

  console.log('[TikTok] Upload successful');
}

async function createInstagramContainer(userId: string, videoUrl: string, supabase: SupabaseAdmin, scheduledPost: ScheduledPostRow) {
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

  const hashtagString = scheduledPost?.hashtags?.map((tag: string) => `#${tag}`).join(' ') || '';
  const caption = scheduledPost?.description
    ? `${scheduledPost.description}\n\n${hashtagString}`
    : hashtagString;

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
        caption: caption || 'Auto-generated video',
        access_token: connection.access_token,
      }),
    }
  );

  if (!containerResponse.ok) {
    const errorText = await containerResponse.text();
    throw new Error(`Instagram container failed: ${errorText}`);
  }

  const containerData = await containerResponse.json();

  console.log(`[Instagram] Media container created: ${containerData.id}`);

  return { containerId: containerData.id as string, accountId: accountId as string, accessToken: connection.access_token as string };
}

async function waitForInstagramContainer(containerId: string, accessToken: string) {
  let statusCheckAttempts = 0;
  const maxStatusChecks = 30; // Max 5 minutes (30 * 10s)

  while (statusCheckAttempts < maxStatusChecks) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds between checks

    const statusResponse = await fetch(
      `https://graph.instagram.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`,
      { method: 'GET' }
    );

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log(`[Instagram] Container status: ${statusData.status_code}`);

      if (statusData.status_code === 'FINISHED') {
        return;
      } else if (statusData.status_code === 'ERROR') {
        throw new Error('Instagram video processing failed');
      }
      // PUBLISHED, IN_PROGRESS, EXPIRED - keep waiting
    }

    statusCheckAttempts++;
  }

  throw new Error('Instagram video processing timeout - container not ready after 5 minutes');
}

async function publishInstagramContainer(accountId: string, containerId: string, accessToken: string) {
  console.log(`[Instagram] Publishing container ${containerId}...`);

  const publishResponse = await fetch(
    `https://graph.instagram.com/v21.0/${accountId}/media_publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }
  );

  if (!publishResponse.ok) {
    const errorText = await publishResponse.text();
    throw new Error(`Instagram publish failed: ${errorText}`);
  }

  const publishData = await publishResponse.json();

  console.log(`[Instagram] Published: ${publishData.id}`);

  return { mediaId: publishData.id as string };
}
