import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const dynamic = "force-dynamic";


const CRON_SECRET = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export async function POST(req: Request) {
  try {
    if (CRON_SECRET) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const {
      audioUrl,
      subtitles,
      generatedImages,
      audioDuration,
      scheduledTime,
      platforms,
      userId,
      metadata
    } = await req.json();

    console.log("audioUrl", audioUrl);
    console.log("subtitles", subtitles);
    console.log("generatedImages", generatedImages);
    console.log("audioDuration", audioDuration);

    if (!audioUrl || !generatedImages || generatedImages.length === 0) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const response = await fetch(
      "http://167.235.140.200:3000/process-images",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioUrl,
          subtitles,
          generatedImages,
          audioDuration
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Fly worker failed: ${text}`);
    }

    const data = await response.json();

    // Handle social media posting if video was generated successfully
    if (data.url && scheduledTime && platforms && platforms.length > 0 && userId) {
      try {
        await handleSocialMediaPosting(userId, data.url, scheduledTime, platforms, metadata);
      } catch (error) {
        console.error('Error in social media posting flow:', error);
        // Don't fail the whole request if posting setup fails
      }
    }

    return NextResponse.json({
      url: data.url
    });

  } catch (err) {
    console.error("Vercel API error:", err);
    return NextResponse.json(
      { error: err || "Video generation failed" },
      { status: 500 }
    );
  }
}

async function handleSocialMediaPosting(
  userId: string,
  videoUrl: string,
  scheduledTime: string,
  platforms: string[],
  metadata?: { title: string; description: string; hashtags: string[] }
) {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get user's connected platforms
  const { data: connections } = await supabaseAdmin
    .from('social_media_connections')
    .select('platform')
    .eq('user_uid', userId);

  const connectedPlatforms = connections?.map(c => c.platform) || [];
  const platformsToPost = platforms.filter(p => connectedPlatforms.includes(p));

  if (platformsToPost.length === 0) {
    console.warn('No connected platforms to post to');
    return;
  }

  // Build platforms object
  const platformsObj = {
    youtube: platformsToPost.includes('youtube'),
    tiktok: platformsToPost.includes('tiktok'),
    instagram: platformsToPost.includes('instagram'),
  };
  const hasTikTokOrInstagram = platformsObj.tiktok || platformsObj.instagram;

  // Insert into scheduled_posts
  const { data: scheduledPost, error: dbError } = await supabaseAdmin
    .from('scheduled_posts')
    .insert({
      user_uid: userId,
      video_url: videoUrl,
      scheduled_time: scheduledTime,
      platforms: platformsObj,
      status: 'pending',
      title: metadata?.title || null,
      description: metadata?.description || null,
      hashtags: metadata?.hashtags || null,
    })
    .select()
    .single();

  if (dbError) {
    console.error('Error saving to scheduled_posts:', dbError);
    throw dbError;
  }

  console.log(`✅ Saved scheduled post: ${scheduledPost.id}`);

  // Post to YouTube immediately with publishAt
  if (platformsObj.youtube) {
    try {
      await postToYouTube(userId, videoUrl, scheduledTime, scheduledPost.id, hasTikTokOrInstagram);
    } catch (error) {
      console.error('Error posting to YouTube:', error);
      // Continue even if YouTube fails
    }
  }

  // Add TikTok/Instagram to posting queue
  if (platformsObj.tiktok || platformsObj.instagram) {
    const queueMessage = {
      scheduled_post_id: scheduledPost.id,
      user_uid: userId,
      video_url: videoUrl,
      scheduled_time: scheduledTime,
      platforms: {
        tiktok: platformsObj.tiktok,
        instagram: platformsObj.instagram,
      },
    };

    const { error: queueError } = await supabaseAdmin.rpc('pgmq_send_posting', {
      queue_name: 'posting_queue',
      message: queueMessage,
    });

    if (queueError) {
      console.error('Error adding to posting queue:', queueError);
    } else {
      console.log(`✅ Added to posting queue: ${scheduledPost.id}`);
    }
  }
}

async function postToYouTube(
  userId: string,
  videoUrl: string,
  scheduledTime: string,
  scheduledPostId: string,
  hasTikTokOrInstagram: boolean
) {
  // Call internal API route to handle YouTube posting
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const url = new URL('/api/post-to-youtube', baseUrl);
  if (VERCEL_BYPASS_SECRET) {
    url.searchParams.set("x-vercel-set-bypass-cookie", "true");
    url.searchParams.set("x-vercel-protection-bypass", VERCEL_BYPASS_SECRET);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (VERCEL_BYPASS_SECRET) {
    headers['x-vercel-protection-bypass'] = VERCEL_BYPASS_SECRET;
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      userId,
      videoUrl,
      scheduledTime,
      scheduledPostId,
      hasTikTokOrInstagram,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`YouTube posting failed: ${error}`);
  }

  const result = await response.json();
  console.log(`✅ YouTube scheduled: ${result.videoId}`);
}