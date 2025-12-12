import { NextRequest, NextResponse } from 'next/server';

const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID || '';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const REDIRECT_URI = `${APP_URL}/api/instagram/callback`;

// Instagram OAuth scopes
const SCOPES = ['user_profile', 'user_media'].join(',');

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  if (!INSTAGRAM_CLIENT_ID || INSTAGRAM_CLIENT_ID.trim() === '') {
    console.error('❌ INSTAGRAM_CLIENT_ID não está configurado!');
    return NextResponse.json({ 
      error: 'Instagram Client ID not configured',
      hint: 'Adicione INSTAGRAM_CLIENT_ID ao arquivo .env.local e reinicie o servidor'
    }, { status: 500 });
  }

  // Gerar state para CSRF protection
  const state = `${userId}:${Math.random().toString(36).substring(7)}`;

  // Construir URL de autorização do Instagram
  const authUrl = new URL('https://api.instagram.com/oauth/authorize');
  authUrl.searchParams.append('client_id', INSTAGRAM_CLIENT_ID.trim());
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('scope', SCOPES);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('state', state);

  console.log('✅ Instagram OAuth URL gerada:', authUrl.toString());
  console.log('ℹ️ Auth Params:', {
    client_id: INSTAGRAM_CLIENT_ID.trim(),
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: 'code',
    state: state
  });

  return NextResponse.redirect(authUrl.toString());
}

