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
  const errorReason = searchParams.get('error_reason');

  // Handle user cancellation or errors
  if (error || errorReason) {
    console.error('Instagram Auth Error:', error, errorReason);
    const dashboardUrl = `${APP_URL}/dashboard?error=${error || 'access_denied'}`;
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code || !state) {
    const dashboardUrl = `${APP_URL}/dashboard?error=missing_params`;
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Call the Supabase Edge Function to save connection to database
    const { data, error: functionError } = await supabase.functions.invoke('instagram-auth', {
      body: { 
        action: 'callback', 
        code, 
        state 
      },
    });

    if (functionError || !data?.success) {
      console.error('❌ Instagram callback error:', functionError);
      const dashboardUrl = `${APP_URL}/dashboard?error=oauth_failed`;
      return NextResponse.redirect(dashboardUrl);
    }

    console.log('✅ Instagram connection successful and saved to database!');

    // Redirect to dashboard with success (no data in URL, will be fetched from DB)
    const dashboardUrl = `${APP_URL}/dashboard?connected=instagram&section=social-media`;

    return NextResponse.redirect(dashboardUrl);
  } catch (err) {
    console.error('Instagram OAuth error:', err);
    const dashboardUrl = `${APP_URL}/dashboard?error=oauth_failed`;
    return NextResponse.redirect(dashboardUrl);
  }
}

