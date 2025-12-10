import { NextRequest, NextResponse } from 'next/server';

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/tiktok/callback`
  : 'http://localhost:3000/api/tiktok/callback';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle user cancellation
  if (error) {
    const dashboardUrl = new URL('/dashboard', request.url);
    dashboardUrl.searchParams.set('error', error);
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code || !state) {
    const dashboardUrl = new URL('/dashboard', request.url);
    dashboardUrl.searchParams.set('error', 'missing_params');
    return NextResponse.redirect(dashboardUrl);
  }

  // Extract user ID from state
  const userId = state.split(':')[0];

  // Recuperar code_verifier do cookie
  const code_verifier = request.cookies.get('tiktok_code_verifier')?.value;

  if (!code_verifier) {
    const dashboardUrl = new URL('/dashboard', request.url);
    dashboardUrl.searchParams.set('error', 'missing_verifier');
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    // Exchange code for access token (com PKCE)
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
        code_verifier: code_verifier, // PKCE verifier
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange error:', errorText);
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token recebido com sucesso');
    console.log('Access token exists:', !!tokenData.access_token);

    // Get user info from TikTok
    console.log('Buscando informações do usuário...');
    const userInfoResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    console.log('User info response status:', userInfoResponse.status);
    
    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error('User info error:', errorText);
      throw new Error('Failed to fetch user info');
    }

    const userInfo = await userInfoResponse.json();

    // Log das informações do usuário (apenas para debug)
    console.log('✅ Conexão TikTok bem-sucedida!');
    console.log('Username:', userInfo.data.user.username || userInfo.data.user.display_name);
    console.log('Display Name:', userInfo.data.user.display_name);
    console.log('Open ID:', userInfo.data.user.open_id);

    // Encode user info to pass in URL (will be saved to localStorage in frontend)
    const userData = {
      username: userInfo.data.user.username || userInfo.data.user.display_name,
      display_name: userInfo.data.user.display_name,
      avatar_url: userInfo.data.user.avatar_url,
      open_id: userInfo.data.user.open_id,
    };

    // Redirect back to dashboard with success
    const dashboardUrl = new URL('/dashboard', request.url);
    dashboardUrl.searchParams.set('connected', 'tiktok');
    dashboardUrl.searchParams.set('section', 'social-media');
    dashboardUrl.searchParams.set('tiktok_data', Buffer.from(JSON.stringify(userData)).toString('base64'));
    
    const response = NextResponse.redirect(dashboardUrl);
    
    // Limpar o cookie do code_verifier
    response.cookies.delete('tiktok_code_verifier');
    
    return response;

  } catch (error) {
    console.error('TikTok OAuth error:', error);
    const dashboardUrl = new URL('/dashboard', request.url);
    dashboardUrl.searchParams.set('error', 'oauth_failed');
    
    const response = NextResponse.redirect(dashboardUrl);
    
    // Limpar o cookie do code_verifier mesmo em caso de erro
    response.cookies.delete('tiktok_code_verifier');
    
    return response;
  }
}

