import { NextRequest, NextResponse } from 'next/server';

const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID || '';
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET || '';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const REDIRECT_URI = `${APP_URL}/api/instagram/callback/`;
const FB_API_VERSION = 'v21.0';

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

    // 1. Exchange code for a Facebook User access token (Graph API)
    // GET https://graph.facebook.com/v21.0/oauth/access_token
    const tokenUrl = new URL(`https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.append('client_id', INSTAGRAM_CLIENT_ID);
    tokenUrl.searchParams.append('client_secret', INSTAGRAM_CLIENT_SECRET);
    tokenUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    tokenUrl.searchParams.append('code', code!);

    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: 'GET',
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Facebook Token Exchange Error:', errorText);
      throw new Error('Failed to exchange code for access token');
    }

    const tokenData = await tokenResponse.json();
    const userAccessToken = tokenData.access_token as string | undefined;

    if (!userAccessToken) {
      throw new Error('No user access token received from Facebook');
    }

    // 2. Get the user's Pages and connected Instagram Business account
    // GET /me/accounts?fields=id,name,access_token,instagram_business_account
    const pagesUrl = new URL(`https://graph.facebook.com/${FB_API_VERSION}/me/accounts`);
    pagesUrl.searchParams.append('fields', 'id,name,access_token,instagram_business_account');
    pagesUrl.searchParams.append('access_token', userAccessToken);

    const pagesResponse = await fetch(pagesUrl.toString(), { method: 'GET' });

    if (!pagesResponse.ok) {
      const errorData = await pagesResponse.text();
      console.error('Error fetching Facebook Pages:', errorData);
      throw new Error('Failed to fetch Facebook Pages for user');
    }

    const pagesData = await pagesResponse.json();

    let instagramBusinessAccountId: string | null = null;
    let pageAccessToken: string | null = null;
    let pageId: string | null = null;
    let pageName: string | null = null;

    for (const page of pagesData.data || []) {
      if (page.instagram_business_account && page.instagram_business_account.id) {
        instagramBusinessAccountId = page.instagram_business_account.id;
        pageAccessToken = page.access_token;
        pageId = page.id;
        pageName = page.name;
        break;
      }
    }

    if (!instagramBusinessAccountId || !pageAccessToken) {
      console.error('No Instagram Business account connected to any Page for this user.');
      const dashboardUrl = `${APP_URL}/dashboard?error=no_instagram_account`;
      return NextResponse.redirect(dashboardUrl);
    }

    // 3. Get Instagram Business account details
    // GET /{ig-user-id}?fields=id,username,name,profile_picture_url
    const igUrl = new URL(`https://graph.facebook.com/${FB_API_VERSION}/${instagramBusinessAccountId}`);
    igUrl.searchParams.append('fields', 'id,username,name,profile_picture_url');
    igUrl.searchParams.append('access_token', pageAccessToken);

    const igResponse = await fetch(igUrl.toString(), { method: 'GET' });

    if (!igResponse.ok) {
      const errorData = await igResponse.text();
      console.error('Error fetching Instagram Business account:', errorData);
      throw new Error('Failed to fetch Instagram Business account info');
    }

    const igData = await igResponse.json();

    console.log('✅ Instagram Business connection successful:', {
      username: igData.username,
      id: igData.id,
    });

    // Prepare data to send back to the dashboard (and store in localStorage there)
    const connectionData = {
      username: igData.username || pageName,
      display_name: igData.name || igData.username || pageName,
      instagram_business_id: instagramBusinessAccountId,
      instagram_user_id: igData.id,
      profile_picture_url: igData.profile_picture_url,
      page_id: pageId,
      page_name: pageName,
      page_access_token: pageAccessToken,
      user_access_token: userAccessToken,
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

