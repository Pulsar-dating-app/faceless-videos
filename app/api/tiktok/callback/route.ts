import { NextRequest, NextResponse } from 'next/server';

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bifacial-daniele-westerly.ngrok-free.dev';
const REDIRECT_URI = `${APP_URL}/api/tiktok/callback`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle user cancellation
  if (error) {
    const dashboardUrl = `${APP_URL}/dashboard?error=${error}`;
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code || !state) {
    const dashboardUrl = `${APP_URL}/dashboard?error=missing_params`;
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

    // Verificar se temos access_token
    if (!tokenData.access_token) {
      console.error('❌ PROBLEMA: TikTok não retornou access_token!');
      throw new Error('No access token received');
    }

    // ✅ SUCESSO! Usar os dados que já temos do token
    // Em Sandbox, não podemos buscar mais informações, então usamos o que veio no token
    console.log('✅ Conexão TikTok bem-sucedida!');

    // Criar dados do usuário com o que temos disponível
    const userData = {
      username: `tiktok_${tokenData.open_id.substring(1, 9)}`, // Username simplificado
      display_name: 'TikTok User',
      avatar_url: null, // Não disponível em Sandbox
      open_id: tokenData.open_id,
      access_token: tokenData.access_token,
      connected_at: new Date().toISOString(),
    };

    // Redirect back to dashboard with success
    const tiktokDataEncoded = Buffer.from(JSON.stringify(userData)).toString('base64');
    const dashboardUrl = `${APP_URL}/dashboard?connected=tiktok&section=social-media&tiktok_data=${tiktokDataEncoded}`;
    
    const response = NextResponse.redirect(dashboardUrl);
    
    // Limpar o cookie do code_verifier
    response.cookies.delete('tiktok_code_verifier');
    
    return response;

  } catch (error) {
    console.error('TikTok OAuth error:', error);
    const dashboardUrl = `${APP_URL}/dashboard?error=oauth_failed`;
    
    const response = NextResponse.redirect(dashboardUrl);
    
    // Limpar o cookie do code_verifier mesmo em caso de erro
    response.cookies.delete('tiktok_code_verifier');
    
    return response;
  }
}

