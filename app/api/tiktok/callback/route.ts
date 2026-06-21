import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  console.log('[tiktok-callback] received. code:', !!code, '| state:', !!state, '| error:', error);

  // Handle user cancellation
  if (error) {
    console.log('[tiktok-callback] TikTok returned error:', error);
    const dashboardUrl = `${APP_URL}/dashboard?error=${error}`;
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code || !state) {
    console.error('[tiktok-callback] Missing code or state');
    const dashboardUrl = `${APP_URL}/dashboard?error=missing_params`;
    return NextResponse.redirect(dashboardUrl);
  }

  // Get code_verifier from cookie
  const code_verifier = request.cookies.get('tiktok_code_verifier')?.value;
  console.log('[tiktok-callback] code_verifier from cookie:', !!code_verifier);
  console.log('[tiktok-callback] all cookies:', request.cookies.getAll().map(c => c.name));

  if (!code_verifier) {
    console.error('[tiktok-callback] Missing code_verifier cookie');
    const dashboardUrl = `${APP_URL}/dashboard?error=missing_verifier`;
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    console.log('[tiktok-callback] calling edge function tiktok-auth...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Call the Supabase Edge Function to save connection to database
    const { data, error: functionError } = await supabase.functions.invoke('tiktok-auth', {
      body: {
        action: 'callback',
        code,
        state,
        code_verifier
      },
    });

    console.log('[tiktok-callback] edge function response. data:', JSON.stringify(data), '| error:', functionError);

    if (functionError || !data?.success) {
      console.error('❌ TikTok callback error:', functionError, '| data:', JSON.stringify(data));
      const errorCode = data?.code || 'oauth_failed';
      console.error('[tiktok-callback] redirecting with errorCode:', errorCode);
      const dashboardUrl = `${APP_URL}/dashboard?error=${errorCode}`;
      const response = NextResponse.redirect(dashboardUrl);
      response.cookies.delete('tiktok_code_verifier');
      return response;
    }

    console.log('✅ TikTok connection successful and saved to database!');

    // Redirect to dashboard with success (no data in URL, will be fetched from DB)
    const dashboardUrl = `${APP_URL}/dashboard?connected=tiktok&section=social-media`;
    
    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.delete('tiktok_code_verifier');
    
    return response;

  } catch (error) {
    console.error('TikTok OAuth error:', error);
    const dashboardUrl = `${APP_URL}/dashboard?error=oauth_failed`;
    
    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.delete('tiktok_code_verifier');
    
    return response;
  }
}

