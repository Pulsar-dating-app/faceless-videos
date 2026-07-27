import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { checkYouTubeVideoStatus } from '@/lib/social-status';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let scheduledPostIdForErrorHandling: string | undefined;

  try {
    const { userId, videoUrl, scheduledTime, scheduledPostId, hasTikTokOrInstagram = false } = await request.json();
    scheduledPostIdForErrorHandling = scheduledPostId;

    if (!userId || !videoUrl || !scheduledTime || !scheduledPostId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[post-to-youtube] Processing post ${scheduledPostId} for user ${userId}`, JSON.stringify({ hasTikTokOrInstagram }));

    // Fetch scheduled post to get metadata
    const { data: scheduledPost } = await supabaseAdmin
      .from('scheduled_posts')
      .select('title, description, hashtags, youtube_video_id')
      .eq('id', scheduledPostId)
      .single();

    // Get YouTube connection
    const { data: connection, error: connectionError } = await supabaseAdmin
      .from('social_media_connections')
      .select('*')
      .eq('user_uid', userId)
      .eq('platform', 'youtube')
      .single();

    if (connectionError || !connection) {
      throw new Error('YouTube not connected');
    }

    let accessToken = connection.access_token;

    // Idempotency: if this post already has a YouTube video, ask YouTube whether it's real
    // before uploading again — a saved id alone isn't proof the row's own update ever landed.
    if (scheduledPost?.youtube_video_id) {
      console.log(`[post-to-youtube] Post ${scheduledPostId} has youtube_video_id=${scheduledPost.youtube_video_id}, verifying real status with YouTube before deciding`);
      try {
        const uploadStatus = await checkYouTubeVideoStatus(scheduledPost.youtube_video_id, accessToken);
        console.log(`[post-to-youtube] Status check for ${scheduledPostId} (video_id=${scheduledPost.youtube_video_id}): ${uploadStatus}`);

        if (uploadStatus === 'uploaded' || uploadStatus === 'processed') {
          console.log(`[post-to-youtube] Confirmed already published for ${scheduledPostId} — skipping upload (idempotency guard)`);
          return NextResponse.json({
            success: true,
            videoId: scheduledPost.youtube_video_id,
            url: `https://www.youtube.com/watch?v=${scheduledPost.youtube_video_id}`,
          });
        }

        console.log(`[post-to-youtube] Previous video not valid (status=${uploadStatus}) for ${scheduledPostId}, proceeding with fresh upload`);
      } catch (error) {
        console.error(`[post-to-youtube] Status check failed for ${scheduledPostId}, proceeding with re-upload:`, error);
      }
    } else {
      console.log(`[post-to-youtube] No previous attempt for ${scheduledPostId}, uploading fresh`);
    }

    // Check if token needs refresh
    if (connection.expires_at) {
      const expiresAt = new Date(connection.expires_at);
      const now = new Date();

      // Refresh if token expires in less than 5 minutes
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        console.log(`[post-to-youtube] Token expiring soon for user ${userId}, refreshing...`);
        accessToken = await refreshYouTubeToken(connection.refresh_token, userId, supabaseAdmin);
      }
    }

    console.log(`[post-to-youtube] Downloading video for ${scheduledPostId} from: ${videoUrl}`);

    // Download video
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());

    console.log(`[post-to-youtube] Video downloaded for ${scheduledPostId}: ${videoBuffer.length} bytes`);

    // Prepare metadata with hashtags in description
    const hashtagString = scheduledPost?.hashtags?.map((tag: string) => `#${tag}`).join(' ') || '';
    const fullDescription = scheduledPost?.description 
      ? `${scheduledPost.description}\n\n${hashtagString}`
      : `Automatically generated video\n\n${hashtagString}`;

    // Prepare metadata for YouTube
    const metadata = {
      snippet: {
        title: scheduledPost?.title || `Auto Video - ${new Date().toISOString().split('T')[0]}`,
        description: fullDescription,
        categoryId: '22', // People & Blogs
        tags: scheduledPost?.hashtags || ['auto', 'generated'],
      },
      status: {
        privacyStatus: 'private', // Required for scheduling
        publishAt: new Date(scheduledTime).toISOString(),
        selfDeclaredMadeForKids: false,
      },
    };

    console.log(`[post-to-youtube] Uploading ${scheduledPostId} to YouTube with publishAt: ${metadata.status.publishAt}`);

    // Upload to YouTube with multipart upload
    const boundary = '===============7330845974216740156==';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody = Buffer.concat([
      Buffer.from(delimiter),
      Buffer.from('Content-Type: application/json; charset=UTF-8\r\n\r\n'),
      Buffer.from(JSON.stringify(metadata)),
      Buffer.from(delimiter),
      Buffer.from('Content-Type: video/mp4\r\n\r\n'),
      videoBuffer,
      Buffer.from(closeDelimiter),
    ]);

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': multipartBody.length.toString(),
        },
        body: multipartBody as unknown as BodyInit,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(`[post-to-youtube] Upload error for ${scheduledPostId}:`, errorText);

      // Try token refresh if 401
      if (uploadResponse.status === 401 && connection.refresh_token) {
        console.log(`[post-to-youtube] Token invalid for ${scheduledPostId}, refreshing and retrying...`);
        const newToken = await refreshYouTubeToken(connection.refresh_token, userId, supabaseAdmin);

        // Retry with new token
        const retryResponse = await fetch(
          'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
              'Content-Length': multipartBody.length.toString(),
            },
            body: multipartBody as unknown as BodyInit,
          }
        );

        if (!retryResponse.ok) {
          throw new Error(`YouTube upload failed after retry: ${await retryResponse.text()}`);
        }

        const retryData = await retryResponse.json();
        console.log(`[post-to-youtube] ✅ Upload successful after token refresh for ${scheduledPostId} (video_id=${retryData.id})`);
        await updateScheduledPost(supabaseAdmin, scheduledPostId, retryData.id, hasTikTokOrInstagram);

        return NextResponse.json({
          success: true,
          videoId: retryData.id,
          url: `https://www.youtube.com/watch?v=${retryData.id}`,
        });
      }

      throw new Error(`YouTube upload failed: ${errorText}`);
    }

    const uploadData = await uploadResponse.json();

    console.log(`[post-to-youtube] ✅ Upload successful for ${scheduledPostId} (video_id=${uploadData.id})`);

    // Update scheduled_posts (only set status to published when YouTube is the only platform)
    await updateScheduledPost(supabaseAdmin, scheduledPostId, uploadData.id, hasTikTokOrInstagram);

    return NextResponse.json({
      success: true,
      videoId: uploadData.id,
      url: `https://www.youtube.com/watch?v=${uploadData.id}`,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[post-to-youtube] Post failed${scheduledPostIdForErrorHandling ? ` for ${scheduledPostIdForErrorHandling}` : ''}:`, error);

    if (scheduledPostIdForErrorHandling) {
      try {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabaseAdmin
          .from('scheduled_posts')
          .update({ youtube_status: 'failed', youtube_last_error: msg })
          .eq('id', scheduledPostIdForErrorHandling);
      } catch (updateError) {
        console.error('Error recording YouTube failure:', updateError);
      }
    }

    return NextResponse.json(
      { error: msg || 'Failed to post to YouTube' },
      { status: 500 }
    );
  }
}

async function refreshYouTubeToken(
  refreshToken: string,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh YouTube token');
  }

  const tokenData = await tokenResponse.json();
  const newAccessToken = tokenData.access_token;
  const expiresIn = tokenData.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Update token in database
  await supabase
    .from('social_media_connections')
    .update({
      access_token: newAccessToken,
      expires_at: expiresAt,
    })
    .eq('user_uid', userId)
    .eq('platform', 'youtube');

  console.log(`[post-to-youtube] ✅ Token refreshed for user ${userId}`);

  return newAccessToken;
}

async function updateScheduledPost(
  supabase: SupabaseClient,
  scheduledPostId: string,
  videoId: string,
  hasTikTokOrInstagram: boolean
) {
  const update: Record<string, unknown> = {
    youtube_video_id: videoId,
    youtube_posted_at: new Date().toISOString(),
    youtube_status: 'published',
  };
  // Only set the overall status when YouTube is the only platform; otherwise publish-posts owns it
  if (!hasTikTokOrInstagram) {
    update.status = 'published';
  }
  console.log(`[post-to-youtube] Recording success for ${scheduledPostId}: youtube_video_id=${videoId}`, JSON.stringify(update));
  await supabase
    .from('scheduled_posts')
    .update(update)
    .eq('id', scheduledPostId);
}
