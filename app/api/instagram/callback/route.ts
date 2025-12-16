import { NextRequest, NextResponse } from 'next/server';

const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID || '';
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET || '';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const REDIRECT_URI = `${APP_URL}/api/instagram/callback`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason');
  const errorDescription = searchParams.get('error_description');

  // Handle user cancellation or errors
  if (error || errorReason) {
    console.error('Instagram Business Auth Error:', error, errorReason, errorDescription);
    const dashboardUrl = `${APP_URL}/dashboard?error=${error || 'access_denied'}`;
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code || !state) {
    const dashboardUrl = `${APP_URL}/dashboard?error=missing_params`;
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    if (!INSTAGRAM_CLIENT_ID || !INSTAGRAM_CLIENT_SECRET) {
      throw new Error('INSTAGRAM_CLIENT_ID or INSTAGRAM_CLIENT_SECRET not configured');
    }

    // Step 1: Exchange code for a short-lived Instagram User access token
    // POST https://api.instagram.com/oauth/access_token
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
      throw new Error('Failed to exchange code for access token');
    }

    const tokenData = await tokenResponse.json();
    
    // The response format is: { "data": [{ "access_token": "...", "user_id": "...", "permissions": "..." }] }
    const tokenInfo = Array.isArray(tokenData.data) ? tokenData.data[0] : tokenData;
    const shortLivedToken = tokenInfo.access_token as string | undefined;
    const instagramUserId = tokenInfo.user_id as string | undefined;
    const permissions = tokenInfo.permissions as string | undefined;

    if (!shortLivedToken || !instagramUserId) {
      throw new Error('No access token or user ID received from Instagram');
    }

    // Step 2: Exchange short-lived token for long-lived token (valid for 60 days)
    // GET https://graph.instagram.com/access_token
    const longLivedTokenUrl = new URL('https://graph.instagram.com/access_token');
    longLivedTokenUrl.searchParams.append('grant_type', 'ig_exchange_token');
    longLivedTokenUrl.searchParams.append('client_secret', INSTAGRAM_CLIENT_SECRET);
    longLivedTokenUrl.searchParams.append('access_token', shortLivedToken);

    const longLivedTokenResponse = await fetch(longLivedTokenUrl.toString(), {
      method: 'GET',
    });

    if (!longLivedTokenResponse.ok) {
      const errorText = await longLivedTokenResponse.text();
      console.error('Instagram Long-lived Token Exchange Error:', errorText);
      // If long-lived token exchange fails, we can still use the short-lived token
      console.warn('⚠️ Falling back to short-lived token');
    }

    const longLivedTokenData = await longLivedTokenResponse.ok
      ? await longLivedTokenResponse.json()
      : null;
    const accessToken = longLivedTokenData?.access_token || shortLivedToken;
    const expiresIn = longLivedTokenData?.expires_in || 3600; // Default to 1 hour if short-lived

    // Step 3: Get Instagram Business account details using /me endpoint
    // GET https://graph.instagram.com/me?fields=user_id,username,name,profile_picture_url
    // According to: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started
    const userInfoUrl = new URL('https://graph.instagram.com/me');
    userInfoUrl.searchParams.append('fields', 'user_id,username,name,profile_picture_url');
    userInfoUrl.searchParams.append('access_token', accessToken);

    console.log('🔍 Fetching user info from /me endpoint...');
    const userInfoResponse = await fetch(userInfoUrl.toString(), { method: 'GET' });

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.text();
      console.error('❌ Error fetching Instagram Business account:', errorData);
      console.error('Request URL:', userInfoUrl.toString().replace(accessToken, '***'));
      throw new Error('Failed to fetch Instagram Business account info');
    }

    const userInfoData = await userInfoResponse.json();
    console.log('📦 User info response:', JSON.stringify(userInfoData, null, 2));

    // Response format: { "data": [{ "user_id": "<IG_ID>", "username": "<IG_USERNAME>" }] }
    const userInfo = Array.isArray(userInfoData.data) ? userInfoData.data[0] : userInfoData;

    if (!userInfo || !userInfo.username) {
      console.error('❌ Invalid user info response:', userInfoData);
      throw new Error('Invalid user info received from Instagram');
    }

    console.log('✅ Instagram Business connection successful!');
    console.log('👤 Username:', userInfo.username);
    console.log('🆔 User ID:', userInfo.user_id || userInfo.id);
    console.log('📝 Name:', userInfo.name || 'N/A');
    console.log('🔑 Permissions:', permissions);

    // Prepare data to send back to the dashboard (and store in localStorage there)
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

    const instagramDataEncoded = Buffer.from(JSON.stringify(connectionData)).toString('base64');

    const dashboardUrl = `${APP_URL}/dashboard?connected=instagram&section=social-media&instagram_data=${encodeURIComponent(
      instagramDataEncoded,
    )}`;

    return NextResponse.redirect(dashboardUrl);
  } catch (err) {
    console.error('Instagram Business OAuth error:', err);
    const dashboardUrl = `${APP_URL}/dashboard?error=oauth_failed`;
    return NextResponse.redirect(dashboardUrl);
  }
}

