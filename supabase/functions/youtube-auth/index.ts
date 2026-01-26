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
    const { action, userId, code, state } = await req.json();

    const YOUTUBE_CLIENT_ID = Deno.env.get('YOUTUBE_CLIENT_ID') || '';
    const YOUTUBE_CLIENT_SECRET = Deno.env.get('YOUTUBE_CLIENT_SECRET') || '';
    const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:3000';
    const REDIRECT_URI = `${APP_URL}/api/youtube/callback`;

    // YouTube OAuth scopes
    const SCOPES = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ');

    // Action: Generate auth URL
    if (action === 'auth') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!YOUTUBE_CLIENT_ID || YOUTUBE_CLIENT_ID.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'YouTube Client ID not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate state for CSRF protection
      const state = `${userId}:${generateRandomString(10)}`;

      // Build YouTube OAuth URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.append('client_id', YOUTUBE_CLIENT_ID.trim());
      authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', SCOPES);
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Handle callback and exchange code for token
    if (action === 'callback') {
      if (!code || !state) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
        return new Response(
          JSON.stringify({ error: 'YouTube credentials not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Exchange code for access token
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
        return new Response(
          JSON.stringify({ error: 'Failed to exchange code for access token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in;

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'No access token received from YouTube' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user profile information
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
        return new Response(
          JSON.stringify({ error: 'Failed to fetch YouTube channel info' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const channelData = await channelResponse.json();
      
      if (!channelData.items || channelData.items.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No YouTube channel found for this account' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const channel = channelData.items[0];
      const snippet = channel.snippet;

      // Prepare connection data
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

      return new Response(
        JSON.stringify({ success: true, data: connectionData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Disconnect
    if (action === 'disconnect') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('YouTube disconnected for user:', userId);
      
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  
  return result;
}
