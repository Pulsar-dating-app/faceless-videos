import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { platform, videoUrl, accessToken, refreshToken, title, description, hashtags } = await req.json();

    if (!platform || !videoUrl || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download video from URL
    console.log('Downloading video from:', videoUrl);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    const videoBuffer = await videoBlob.arrayBuffer();
    console.log(`Video downloaded: ${videoBuffer.byteLength} bytes`);

    let result;

    switch (platform) {
      case 'youtube':
        result = await postToYouTube(videoBuffer, accessToken, refreshToken, title, description, hashtags);
        break;
      case 'tiktok':
        result = await postToTikTok(videoBuffer, accessToken, title, description, hashtags);
        break;
      case 'instagram':
        result = await postToInstagram(videoBuffer, accessToken, title, description, hashtags);
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Unsupported platform' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error posting to social media:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to post to social media', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function postToYouTube(
  videoBuffer: ArrayBuffer,
  accessToken: string,
  refreshToken: string | undefined,
  title: string,
  description: string,
  hashtags: string[]
) {
  console.log('Posting to YouTube...');
  
  const YOUTUBE_CLIENT_ID = Deno.env.get('YOUTUBE_CLIENT_ID') || '';
  const YOUTUBE_CLIENT_SECRET = Deno.env.get('YOUTUBE_CLIENT_SECRET') || '';
  
  // Refresh token if needed
  let currentAccessToken = accessToken;
  if (refreshToken) {
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: YOUTUBE_CLIENT_ID,
          client_secret: YOUTUBE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        currentAccessToken = tokenData.access_token;
        console.log('✅ YouTube token refreshed');
      }
    } catch (e) {
      console.warn('Could not refresh token, using existing:', e);
    }
  }

  const videoMetadata = {
    snippet: {
      title: title || 'Viral Video',
      description: `${description || ''}\n\n${hashtags.join(' ')}`.trim(),
      categoryId: '22', // People & Blogs
      tags: hashtags.map(tag => tag.replace('#', '')),
    },
    status: {
      privacyStatus: 'public', // or 'private', 'unlisted'
      selfDeclaredMadeForKids: false,
    },
  };

  // Create multipart upload
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadataPart = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(videoMetadata);

  const videoPart = delimiter +
    'Content-Type: video/mp4\r\n\r\n';

  const metadata = new TextEncoder().encode(metadataPart + videoPart);
  const ending = new TextEncoder().encode(closeDelim);

  // Combine all parts
  const combinedLength = metadata.byteLength + videoBuffer.byteLength + ending.byteLength;
  const combined = new Uint8Array(combinedLength);
  combined.set(new Uint8Array(metadata), 0);
  combined.set(new Uint8Array(videoBuffer), metadata.byteLength);
  combined.set(new Uint8Array(ending), metadata.byteLength + videoBuffer.byteLength);

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentAccessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': combined.byteLength.toString(),
      },
      body: combined,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('YouTube upload error:', errorText);
    throw new Error(`YouTube upload failed: ${errorText}`);
  }

  const uploadData = await uploadResponse.json();
  console.log('✅ Posted to YouTube:', uploadData.id);
  
  return {
    platform: 'youtube',
    videoId: uploadData.id,
    url: `https://www.youtube.com/watch?v=${uploadData.id}`,
  };
}

async function postToTikTok(
  videoBuffer: ArrayBuffer,
  accessToken: string,
  title: string,
  description: string,
  hashtags: string[]
) {
  console.log('Posting to TikTok...');
  
  const caption = `${title || ''}\n${description || ''}\n\n${hashtags.join(' ')}`.trim();

  // Step 1: Initialize upload
  const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: title || 'Viral Video',
        privacy_level: 'SELF_ONLY', // Options: PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, SELF_ONLY
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoBuffer.byteLength,
        chunk_size: videoBuffer.byteLength,
        total_chunk_count: 1,
      },
    }),
  });

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    console.error('TikTok init error:', errorText);
    throw new Error(`TikTok init failed: ${errorText}`);
  }

  const initData = await initResponse.json();
  const { publish_id, upload_url } = initData.data;

  // Step 2: Upload video
  const uploadResponse = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': videoBuffer.byteLength.toString(),
    },
    body: videoBuffer,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('TikTok upload error:', errorText);
    throw new Error(`TikTok upload failed: ${errorText}`);
  }

  // Step 3: Check status (optional, the video is being processed)
  console.log('✅ Posted to TikTok:', publish_id);
  
  return {
    platform: 'tiktok',
    publishId: publish_id,
    status: 'processing',
  };
}

async function postToInstagram(
  videoBuffer: ArrayBuffer,
  accessToken: string,
  title: string,
  description: string,
  hashtags: string[]
) {
  console.log('Posting to Instagram...');
  
  const caption = `${title || ''}\n${description || ''}\n\n${hashtags.join(' ')}`.trim();

  // Instagram requires the video to be publicly accessible
  // We need to upload to a temporary location first
  // For now, we'll use a simple approach with container creation

  // Get Instagram Business Account ID
  const meResponse = await fetch(
    `https://graph.instagram.com/me?fields=id&access_token=${accessToken}`
  );

  if (!meResponse.ok) {
    throw new Error('Failed to get Instagram user info');
  }

  const meData = await meResponse.json();
  const igUserId = meData.id;

  // Note: Instagram requires the video URL to be publicly accessible
  // This is a limitation - we need to host the video temporarily
  throw new Error('Instagram posting requires publicly accessible video URL. Please download and post manually for now.');

  // TODO: Implement video hosting and container creation
  // const containerResponse = await fetch(
  //   `https://graph.instagram.com/${igUserId}/media`,
  //   {
  //     method: 'POST',
  //     body: new URLSearchParams({
  //       media_type: 'REELS',
  //       video_url: publicVideoUrl,
  //       caption: caption,
  //       access_token: accessToken,
  //     }),
  //   }
  // );
}
