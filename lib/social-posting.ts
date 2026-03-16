import { SupabaseClient } from '@supabase/supabase-js';

interface ScheduledPost {
  title?: string | null;
  description?: string | null;
  hashtags?: string[] | null;
  [key: string]: unknown;
}

interface TikTokResult {
  publishId: string;
  success: true;
}

interface InstagramResult {
  mediaId: string;
  success: true;
}

interface YouTubeResult {
  videoId: string;
  url: string;
  success: true;
}

export async function postToTikTok(
  userId: string,
  videoUrl: string,
  supabase: SupabaseClient,
  scheduledPost: ScheduledPost
): Promise<TikTokResult> {
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

  const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: fullDescription || scheduledPost?.title || 'Auto-generated video',
        privacy_level: 'SELF_ONLY',
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

  const totalBytes = videoBuffer.length;
  const contentRange = `bytes 0-${totalBytes - 1}/${totalBytes}`;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': totalBytes.toString(),
      'Content-Range': contentRange,
    },
    body: videoBuffer,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    const statusInfo = `${uploadResponse.status} ${uploadResponse.statusText}`;
    const message = errorText?.trim() || statusInfo;
    throw new Error(`TikTok upload failed: ${message}`);
  }

  console.log(`[TikTok] Upload successful: ${publishId}`);

  return { publishId, success: true };
}

export async function postToInstagram(
  userId: string,
  videoUrl: string,
  supabase: SupabaseClient,
  scheduledPost: ScheduledPost
): Promise<InstagramResult> {
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
      headers: { 'Content-Type': 'application/json' },
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
  const containerId = containerData.id;

  console.log(`[Instagram] Media container created: ${containerId}`);

  let statusCheckAttempts = 0;
  const maxStatusChecks = 30;
  let isReady = false;

  while (statusCheckAttempts < maxStatusChecks && !isReady) {
    await new Promise(resolve => setTimeout(resolve, 10000));

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
    }

    statusCheckAttempts++;
  }

  if (!isReady) {
    throw new Error('Instagram video processing timeout - container not ready after 5 minutes');
  }

  console.log(`[Instagram] Container ready, publishing...`);

  const publishResponse = await fetch(
    `https://graph.instagram.com/v21.0/${accountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

// Publishes immediately as public when scheduledTime is omitted (Publish Now).
// Pass a future ISO string for scheduledTime to schedule as private with publishAt.
export async function postToYouTube(
  userId: string,
  videoUrl: string,
  supabase: SupabaseClient,
  scheduledPost: ScheduledPost,
  scheduledTime?: string
): Promise<YouTubeResult> {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

  const { data: connection, error: connectionError } = await supabase
    .from('social_media_connections')
    .select('*')
    .eq('user_uid', userId)
    .eq('platform', 'youtube')
    .single();

  if (connectionError || !connection) {
    throw new Error('YouTube not connected');
  }

  let accessToken: string = connection.access_token;

  // Refresh token if expiring within 5 minutes
  if (connection.expires_at) {
    const expiresAt = new Date(connection.expires_at);
    if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      console.log('[YouTube] Token expiring soon, refreshing...');
      accessToken = await refreshYouTubeToken(
        connection.refresh_token,
        userId,
        supabase,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET
      );
    }
  }

  console.log(`[YouTube] Downloading video from: ${videoUrl}`);

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.statusText}`);
  }

  const videoBlob = await videoResponse.blob();
  const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());

  console.log(`[YouTube] Video downloaded: ${videoBuffer.length} bytes`);

  const hashtagString = scheduledPost?.hashtags?.map((tag: string) => `#${tag}`).join(' ') || '';
  const fullDescription = scheduledPost?.description
    ? `${scheduledPost.description}\n\n${hashtagString}`
    : `Automatically generated video\n\n${hashtagString}`;

  // Publish immediately as public when no scheduledTime is given (Publish Now).
  // When scheduledTime is provided, schedule as private with publishAt.
  const videoStatus = scheduledTime
    ? { privacyStatus: 'private', publishAt: new Date(scheduledTime).toISOString(), selfDeclaredMadeForKids: false }
    : { privacyStatus: 'public', selfDeclaredMadeForKids: false };

  const metadata = {
    snippet: {
      title: scheduledPost?.title || `Auto Video - ${new Date().toISOString().split('T')[0]}`,
      description: fullDescription,
      categoryId: '22',
      tags: (scheduledPost?.hashtags as string[]) || ['auto', 'generated'],
    },
    status: videoStatus,
  };

  console.log(`[YouTube] Uploading (${scheduledTime ? `scheduled: ${metadata.status.publishAt}` : 'immediate'})`);

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

  const uploadUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status';

  let uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': multipartBody.length.toString(),
    },
    body: multipartBody,
  });

  // Retry once with a fresh token on 401
  if (uploadResponse.status === 401 && connection.refresh_token) {
    console.log('[YouTube] Token invalid, refreshing and retrying...');
    accessToken = await refreshYouTubeToken(
      connection.refresh_token,
      userId,
      supabase,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    );
    uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': multipartBody.length.toString(),
      },
      body: multipartBody,
    });
  }

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`YouTube upload failed: ${errorText}`);
  }

  const uploadData = await uploadResponse.json();
  const videoId: string = uploadData.id;

  console.log(`[YouTube] ✅ Upload successful: ${videoId}`);

  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}`, success: true };
}

async function refreshYouTubeToken(
  refreshToken: string,
  userId: string,
  supabase: SupabaseClient,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh YouTube token');
  }

  const tokenData = await tokenResponse.json();
  const newAccessToken: string = tokenData.access_token;
  const expiresIn: number = tokenData.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await supabase
    .from('social_media_connections')
    .update({ access_token: newAccessToken, expires_at: expiresAt })
    .eq('user_uid', userId)
    .eq('platform', 'youtube');

  console.log('[YouTube] ✅ Token refreshed');

  return newAccessToken;
}
