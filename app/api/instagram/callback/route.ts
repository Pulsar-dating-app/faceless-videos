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
    console.error('Instagram Auth Error:', error, errorReason, errorDescription);
    const dashboardUrl = `${APP_URL}/dashboard?error=${error || 'access_denied'}`;
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code || !state) {
    const dashboardUrl = `${APP_URL}/dashboard?error=missing_params`;
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    // 1. Exchange code for short-lived access token
    const tokenFormData = new FormData();
    tokenFormData.append('client_id', INSTAGRAM_CLIENT_ID);
    tokenFormData.append('client_secret', INSTAGRAM_CLIENT_SECRET);
    tokenFormData.append('grant_type', 'authorization_code');
    tokenFormData.append('redirect_uri', REDIRECT_URI);
    tokenFormData.append('code', code);

    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: tokenFormData,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Instagram Token Exchange Error:', errorText);
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const userId = tokenData.user_id; // Instagram returns user_id in the token response too usually

    if (!accessToken) {
      throw new Error('No access token received from Instagram');
    }

    // 2. Get User Info (Username)
    // The token response usually contains user_id. We can query the graph API for username.
    // Fields: id,username
    const userResponse = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`);
    
    if (!userResponse.ok) {
       const errorText = await userResponse.text();
       console.error('Instagram User Info Error:', errorText);
       throw new Error('Failed to fetch user info');
    }

    const userData = await userResponse.json();

    console.log('✅ Conexão Instagram bem-sucedida!');

    // Prepare data to send back
    const connectionData = {
      username: userData.username,
      display_name: userData.username, // Instagram Basic Display doesn't explicitly give display name separately often
      instagram_user_id: userData.id,
      access_token: accessToken,
      connected_at: new Date().toISOString(),
    };

    // Redirect back to dashboard with success
    const instagramDataEncoded = Buffer.from(JSON.stringify(connectionData)).toString('base64');
    const dashboardUrl = `${APP_URL}/dashboard?connected=instagram&section=social-media&instagram_data=${instagramDataEncoded}`;
    
    return NextResponse.redirect(dashboardUrl);

  } catch (error) {
    console.error('Instagram OAuth error:', error);
    const dashboardUrl = `${APP_URL}/dashboard?error=oauth_failed`;
    return NextResponse.redirect(dashboardUrl);
  }
}

