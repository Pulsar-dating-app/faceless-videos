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

    const INSTAGRAM_CLIENT_ID = Deno.env.get('INSTAGRAM_CLIENT_ID') || '';
    const INSTAGRAM_CLIENT_SECRET = Deno.env.get('INSTAGRAM_CLIENT_SECRET') || '';
    const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:3000';
    const REDIRECT_URI = `${APP_URL}/api/instagram/callback`;

    // Instagram Business scopes
    const SCOPES = [
      'instagram_business_basic',
      'instagram_business_content_publish',
    ].join(',');

    // Action: Generate auth URL
    if (action === 'auth') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!INSTAGRAM_CLIENT_ID || INSTAGRAM_CLIENT_ID.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'Instagram Client ID not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate state for CSRF protection
      const state = `${userId}:${generateRandomString(10)}`;

      // Build Instagram OAuth URL
      const authUrl = new URL('https://www.instagram.com/oauth/authorize');
      authUrl.searchParams.append('client_id', INSTAGRAM_CLIENT_ID.trim());
      authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', SCOPES);
      authUrl.searchParams.append('state', state);
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

      if (!INSTAGRAM_CLIENT_ID || !INSTAGRAM_CLIENT_SECRET) {
        return new Response(
          JSON.stringify({ error: 'Instagram credentials not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Exchange code for short-lived access token
      const tokenFormData = new URLSearchParams();
      tokenFormData.append('client_id', INSTAGRAM_CLIENT_ID);
      tokenFormData.append('client_secret', INSTAGRAM_CLIENT_SECRET);
      tokenFormData.append('grant_type', 'authorization_code');
      tokenFormData.append('redirect_uri', REDIRECT_URI);
      tokenFormData.append('code', code);

      const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenFormData.toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Instagram Token Exchange Error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to exchange code for access token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenResponse.json();
      const tokenInfo = Array.isArray(tokenData.data) ? tokenData.data[0] : tokenData;
      const shortLivedToken = tokenInfo.access_token;
      const instagramUserId = tokenInfo.user_id;
      const permissions = tokenInfo.permissions;

      if (!shortLivedToken || !instagramUserId) {
        return new Response(
          JSON.stringify({ error: 'No access token or user ID received from Instagram' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Exchange short-lived token for long-lived token (valid for 60 days)
      const longLivedTokenUrl = new URL('https://graph.instagram.com/access_token');
      longLivedTokenUrl.searchParams.append('grant_type', 'ig_exchange_token');
      longLivedTokenUrl.searchParams.append('client_secret', INSTAGRAM_CLIENT_SECRET);
      longLivedTokenUrl.searchParams.append('access_token', shortLivedToken);

      const longLivedTokenResponse = await fetch(longLivedTokenUrl.toString(), {
        method: 'GET',
      });

      let accessToken = shortLivedToken;
      let expiresIn = 3600;

      if (longLivedTokenResponse.ok) {
        const longLivedTokenData = await longLivedTokenResponse.json();
        accessToken = longLivedTokenData.access_token || shortLivedToken;
        expiresIn = longLivedTokenData.expires_in || 3600;
      } else {
        console.warn('⚠️ Falling back to short-lived token');
      }

      // Get Instagram Business account details
      const userInfoUrl = new URL('https://graph.instagram.com/me');
      userInfoUrl.searchParams.append('fields', 'user_id,username,name,profile_picture_url');
      userInfoUrl.searchParams.append('access_token', accessToken);

      const userInfoResponse = await fetch(userInfoUrl.toString(), { method: 'GET' });

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.error('Instagram User Info Error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch Instagram Business account info' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userInfoData = await userInfoResponse.json();
      const userInfo = Array.isArray(userInfoData.data) ? userInfoData.data[0] : userInfoData;

      if (!userInfo || !userInfo.username) {
        return new Response(
          JSON.stringify({ error: 'Invalid user info received from Instagram' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prepare connection data
      const connectionData = {
        username: userInfo.username,
        display_name: userInfo.name || userInfo.username,
        instagram_user_id: userInfo.user_id || userInfo.id,
        profile_picture_url: userInfo.profile_picture_url,
        access_token: accessToken,
        permissions: permissions || '',
        expires_in: expiresIn,
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

      console.log('Instagram disconnected for user:', userId);
      
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
