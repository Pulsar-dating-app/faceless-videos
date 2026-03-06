import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { userId, videoUrl, scheduledTime, scheduledPostId, hasTikTokOrInstagram = false } = await request.json();

    if (!userId || !videoUrl || !scheduledTime || !scheduledPostId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch scheduled post to get metadata
    const { data: scheduledPost } = await supabaseAdmin
      .from('scheduled_posts')
      .select('title, description, hashtags')
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

    // Check if token needs refresh
    if (connection.expires_at) {
      const expiresAt = new Date(connection.expires_at);
      const now = new Date();
      
      // Refresh if token expires in less than 5 minutes
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        console.log('Token expiring soon, refreshing...');
        accessToken = await refreshYouTubeToken(connection.refresh_token, userId, supabaseAdmin);
      }
    }

    console.log(`Downloading video from: ${videoUrl}`);

    // Download video
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());

    console.log(`Video downloaded: ${videoBuffer.length} bytes`);

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

    console.log(`Uploading to YouTube with publishAt: ${metadata.status.publishAt}`);

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
        body: multipartBody,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('YouTube upload error:', errorText);

      // Try token refresh if 401
      if (uploadResponse.status === 401 && connection.refresh_token) {
        console.log('Token invalid, refreshing and retrying...');
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
            body: multipartBody,
          }
        );

        if (!retryResponse.ok) {
          throw new Error(`YouTube upload failed after retry: ${await retryResponse.text()}`);
        }

        const retryData = await retryResponse.json();
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

    console.log(`✅ YouTube upload successful: ${uploadData.id}`);

    // Update scheduled_posts (only set status to published when YouTube is the only platform)
    await updateScheduledPost(supabaseAdmin, scheduledPostId, uploadData.id, hasTikTokOrInstagram);

    return NextResponse.json({
      success: true,
      videoId: uploadData.id,
      url: `https://www.youtube.com/watch?v=${uploadData.id}`,
    });

  } catch (error: any) {
    console.error('Error posting to YouTube:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to post to YouTube' },
      { status: 500 }
    );
  }
}

async function refreshYouTubeToken(
  refreshToken: string,
  userId: string,
  supabase: any
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

  console.log('✅ YouTube token refreshed');

  return newAccessToken;
}

async function updateScheduledPost(
  supabase: any,
  scheduledPostId: string,
  videoId: string,
  hasTikTokOrInstagram: boolean
) {
  const update: Record<string, unknown> = {
    youtube_video_id: videoId,
    youtube_posted_at: new Date().toISOString(),
  };
  // Only set status to published when YouTube is the only platform; otherwise publish-posts will set it
  if (!hasTikTokOrInstagram) {
    update.status = 'published';
  }
  await supabase
    .from('scheduled_posts')
    .update(update)
    .eq('id', scheduledPostId);
}
