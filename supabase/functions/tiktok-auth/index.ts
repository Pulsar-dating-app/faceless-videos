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
    const { action, userId, code, state, code_verifier } = await req.json();

    const TIKTOK_CLIENT_KEY = Deno.env.get('TIKTOK_CLIENT_KEY') || '';
    const TIKTOK_CLIENT_SECRET = Deno.env.get('TIKTOK_CLIENT_SECRET') || '';
    const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:3000';
    const REDIRECT_URI = `${APP_URL}/api/tiktok/callback`;

    // Action: Generate auth URL
    if (action === 'auth') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!TIKTOK_CLIENT_KEY || TIKTOK_CLIENT_KEY.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'TikTok Client Key not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate PKCE
      const code_verifier = generateRandomString(64);
      const code_challenge = await generateCodeChallenge(code_verifier);

      // Generate state for CSRF protection
      const state = `${userId}:${generateRandomString(10)}`;

      // Build TikTok OAuth URL
      const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
      authUrl.searchParams.append('client_key', TIKTOK_CLIENT_KEY.trim());
      authUrl.searchParams.append('scope', 'user.info.basic');
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('code_challenge', code_challenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');

      return new Response(
        JSON.stringify({ 
          authUrl: authUrl.toString(), 
          code_verifier 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Handle callback and exchange code for token
    if (action === 'callback') {
      if (!code || !state || !code_verifier) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Exchange code for access token
      const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_key: TIKTOK_CLIENT_KEY,
          client_secret: TIKTOK_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
          code_verifier: code_verifier,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to exchange code for token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenResponse.json();

      if (!tokenData.access_token) {
        return new Response(
          JSON.stringify({ error: 'No access token received' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create user data
      const userData = {
        username: `tiktok_${tokenData.open_id.substring(1, 9)}`,
        display_name: 'TikTok User',
        avatar_url: null,
        open_id: tokenData.open_id,
        access_token: tokenData.access_token,
        connected_at: new Date().toISOString(),
      };

      return new Response(
        JSON.stringify({ success: true, data: userData }),
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

      console.log('TikTok disconnected for user:', userId);
      
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

// Helper functions
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  
  return result;
}

async function generateCodeChallenge(code_verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code_verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to base64url
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
