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

  // Handle user cancellation
  if (error) {
    const dashboardUrl = `${APP_URL}/dashboard?error=${error}`;
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code || !state) {
    const dashboardUrl = `${APP_URL}/dashboard?error=missing_params`;
    return NextResponse.redirect(dashboardUrl);
  }

  // Get code_verifier from cookie
  const code_verifier = request.cookies.get('tiktok_code_verifier')?.value;

  if (!code_verifier) {
    const dashboardUrl = `${APP_URL}/dashboard?error=missing_verifier`;
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Call the Supabase Edge Function
    const { data, error: functionError } = await supabase.functions.invoke('tiktok-auth', {
      body: { 
        action: 'callback', 
        code, 
        state, 
        code_verifier 
      },
    });

    if (functionError || !data?.success) {
      console.error('❌ TikTok callback error:', functionError);
      const dashboardUrl = `${APP_URL}/dashboard?error=oauth_failed`;
      const response = NextResponse.redirect(dashboardUrl);
      response.cookies.delete('tiktok_code_verifier');
      return response;
    }

    console.log('✅ TikTok connection successful!');

    // Redirect to dashboard with success
    const tiktokDataEncoded = Buffer.from(JSON.stringify(data.data)).toString('base64');
    const dashboardUrl = `${APP_URL}/dashboard?connected=tiktok&section=social-media&tiktok_data=${tiktokDataEncoded}`;
    
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

