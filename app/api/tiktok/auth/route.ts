import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('tiktok-auth', {
      body: { action: 'auth', userId },
    });

    if (error) {
      console.error('❌ TikTok auth error:', error);
      return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
    }

    if (!data?.authUrl || !data?.code_verifier) {
      return NextResponse.json({ error: 'Invalid response from auth service' }, { status: 500 });
    }

    console.log('✅ TikTok OAuth URL generated');

    // Redirect to TikTok OAuth and store code_verifier in cookie
    const response = NextResponse.redirect(data.authUrl);
    
    response.cookies.set('tiktok_code_verifier', data.code_verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600, // 10 minutes
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('❌ Error calling TikTok auth function:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

