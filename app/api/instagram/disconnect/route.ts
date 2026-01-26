import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('instagram-auth', {
      body: { action: 'disconnect', userId },
    });

    if (error) {
      console.error('❌ Instagram disconnect error:', error);
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    console.log('✅ Instagram disconnected for user:', userId);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

