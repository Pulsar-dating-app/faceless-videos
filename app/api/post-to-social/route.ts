import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, videoUrl, accessToken, refreshToken, title, description, hashtags } = body;

    if (!platform || !videoUrl || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Call Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/post-to-social`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        platform,
        videoUrl,
        accessToken,
        refreshToken,
        title: title || 'Amazing Viral Video',
        description: description || '',
        hashtags: hashtags || ['#viral', '#fyp'],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to post to social media');
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in post-to-social API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post to social media' },
      { status: 500 }
    );
  }
}
