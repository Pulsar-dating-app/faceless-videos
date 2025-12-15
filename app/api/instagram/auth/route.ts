import { NextRequest, NextResponse } from 'next/server';

const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID || '';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const REDIRECT_URI = `${APP_URL}/api/instagram/callback/`;

// Instagram Business / Publishing scopes (Graph API)
// These allow reading a business account and publishing content.
// Example: instagram_business_basic, instagram_business_content_publish
const SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
].join(',');

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  if (!INSTAGRAM_CLIENT_ID || INSTAGRAM_CLIENT_ID.trim() === '') {
    console.error('❌ INSTAGRAM_CLIENT_ID não está configurado!');
    return NextResponse.json(
      {
        error: 'Instagram Client ID not configured',
        hint: 'Adicione INSTAGRAM_CLIENT_ID ao arquivo .env.local e reinicie o servidor',
      },
      { status: 500 },
    );
  }

  // State for CSRF protection and to tie the callback back to the user
  const state = `${userId}:${Math.random().toString(36).substring(7)}`;

  // Build Instagram OAuth URL for Business / Graph API
  // Using the same pattern as facelessreels:
  // https://www.instagram.com/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&scope=instagram_business_basic,instagram_business_content_publish&state=...
  const authUrl = new URL('https://www.instagram.com/oauth/authorize');
  authUrl.searchParams.append('client_id', INSTAGRAM_CLIENT_ID.trim());
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', SCOPES);
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('prompt', 'consent');

  console.log('✅ Instagram Business OAuth URL generated:', authUrl.toString());
  console.log('ℹ️ Auth Params:', {
    client_id: INSTAGRAM_CLIENT_ID.trim(),
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: 'code',
    state,
  });

  return NextResponse.redirect(authUrl.toString());
}

