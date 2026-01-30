import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle user cancellation or errors
  if (error) {
    console.error('YouTube Auth Error:', error);
    const dashboardUrl = `${APP_URL}/dashboard?error=${error}`;
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code || !state) {
    const dashboardUrl = `${APP_URL}/dashboard?error=missing_params`;
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Call the Supabase Edge Function
    const { data, error: functionError } = await supabase.functions.invoke('youtube-auth', {
      body: { 
        action: 'callback', 
        code, 
        state 
      },
    });

    if (functionError || !data?.success) {
      console.error('❌ YouTube callback error:', functionError);
      const dashboardUrl = `${APP_URL}/dashboard?error=oauth_failed`;
      return NextResponse.redirect(dashboardUrl);
    }

    console.log('✅ YouTube connection successful!');

    // Redirect to dashboard with success
    const youtubeDataEncoded = Buffer.from(JSON.stringify(data.data)).toString('base64');
    const dashboardUrl = `${APP_URL}/dashboard?connected=youtube&section=social-media&youtube_data=${encodeURIComponent(
      youtubeDataEncoded,
    )}`;

    return NextResponse.redirect(dashboardUrl);
  } catch (err) {
    console.error('YouTube OAuth error:', err);
    const dashboardUrl = `${APP_URL}/dashboard?error=oauth_failed`;
    return NextResponse.redirect(dashboardUrl);
  }
}
