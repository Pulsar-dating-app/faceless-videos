import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || '';
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || '';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const REDIRECT_URI = `${APP_URL}/api/youtube/callback`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle user cancellation or errors
  if (error) {
    console.error('YouTube Auth Error:', error);
    const dashboardUrl = `${APP_URL}/dashboard?error=${error}`;
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code || !state) {
    const dashboardUrl = `${APP_URL}/dashboard?error=missing_params`;
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
      throw new Error('YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET not configured');
    }

    // Step 1: Exchange code for access token
    // https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        client_id: YOUTUBE_CLIENT_ID,
        client_secret: YOUTUBE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('YouTube Token Exchange Error:', errorText);
      throw new Error('Failed to exchange code for access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token as string | undefined;
    const refreshToken = tokenData.refresh_token as string | undefined;
    const expiresIn = tokenData.expires_in as number | undefined;

    if (!accessToken) {
      throw new Error('No access token received from YouTube');
    }

    // Step 2: Get user profile information
    // https://developers.google.com/youtube/v3/docs/channels/list
    const channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();
      console.error('YouTube Channel Info Error:', errorText);
      throw new Error('Failed to fetch YouTube channel info');
    }

    const channelData = await channelResponse.json();
    
    if (!channelData.items || channelData.items.length === 0) {
      throw new Error('No YouTube channel found for this account');
    }

    const channel = channelData.items[0];
    const snippet = channel.snippet;

    console.log('✅ YouTube connection successful!');
    console.log('📺 Channel:', snippet.title);
    console.log('🆔 Channel ID:', channel.id);

    // Prepare data to send back to the dashboard
    const connectionData = {
      channel_id: channel.id,
      channel_title: snippet.title,
      description: snippet.description,
      thumbnail_url: snippet.thumbnails?.default?.url || snippet.thumbnails?.medium?.url || null,
      access_token: accessToken,
      refresh_token: refreshToken || '',
      expires_in: expiresIn || 3600,
      connected_at: new Date().toISOString(),
    };

    const youtubeDataEncoded = Buffer.from(JSON.stringify(connectionData)).toString('base64');

    const dashboardUrl = `${APP_URL}/dashboard?connected=youtube&section=social-media&youtube_data=${encodeURIComponent(
      youtubeDataEncoded,
    )}`;

    return NextResponse.redirect(dashboardUrl);
  } catch (err) {
    console.error('YouTube OAuth error:', err);
    const dashboardUrl = `${APP_URL}/dashboard?error=oauth_failed`;
    return NextResponse.redirect(dashboardUrl);
  }
}
