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
    const { data, error } = await supabase.functions.invoke('instagram-auth', {
      body: { action: 'auth', userId },
    });

    if (error) {
      console.error('❌ Instagram auth error:', error);
      return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
    }

    if (!data?.authUrl) {
      return NextResponse.json({ error: 'Invalid response from auth service' }, { status: 500 });
    }

    console.log('✅ Instagram OAuth URL generated');

    return NextResponse.redirect(data.authUrl);
  } catch (error) {
    console.error('❌ Error calling Instagram auth function:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

