import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || '';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const REDIRECT_URI = `${APP_URL}/api/youtube/callback`;

// YouTube OAuth scopes for uploading videos
// https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  if (!YOUTUBE_CLIENT_ID || YOUTUBE_CLIENT_ID.trim() === '') {
    console.error('❌ YOUTUBE_CLIENT_ID não está configurado!');
    return NextResponse.json(
      {
        error: 'YouTube Client ID not configured',
        hint: 'Adicione YOUTUBE_CLIENT_ID ao arquivo .env.local e reinicie o servidor',
      },
      { status: 500 },
    );
  }

  // State for CSRF protection and to tie the callback back to the user
  const state = `${userId}:${Math.random().toString(36).substring(7)}`;

  // Build YouTube OAuth URL
  // https://developers.google.com/identity/protocols/oauth2/web-server#creatingclient
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.append('client_id', YOUTUBE_CLIENT_ID.trim());
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', SCOPES);
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('access_type', 'offline'); // Get refresh token
  authUrl.searchParams.append('prompt', 'consent'); // Force consent to get refresh token

  console.log('✅ YouTube OAuth URL generated:', authUrl.toString());
  console.log('ℹ️ Auth Params:', {
    client_id: YOUTUBE_CLIENT_ID.trim(),
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: 'code',
    state,
  });

  return NextResponse.redirect(authUrl.toString());
}
