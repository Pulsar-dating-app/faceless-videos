import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { postToTikTok, postToInstagram, postToYouTube } from '@/lib/social-posting';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { scheduledPostId, userId } = await request.json();

    if (!scheduledPostId || !userId) {
      return NextResponse.json(
        { error: 'scheduledPostId and userId are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch scheduled post and verify ownership
    const { data: scheduledPost, error: postError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('id', scheduledPostId)
      .eq('user_uid', userId)
      .single();

    if (postError || !scheduledPost) {
      return NextResponse.json(
        { error: 'Scheduled post not found or access denied' },
        { status: 404 }
      );
    }

    if (scheduledPost.status === 'published') {
      return NextResponse.json(
        { error: 'This post has already been published' },
        { status: 409 }
      );
    }

    if (scheduledPost.status === 'processing') {
      return NextResponse.json(
        { error: 'This post is already being processed' },
        { status: 409 }
      );
    }

    console.log(`[publish-post-now] Publishing post ${scheduledPostId} for user ${userId}`);

    // Mark as processing
    await supabaseAdmin
      .from('scheduled_posts')
      .update({ status: 'processing' })
      .eq('id', scheduledPostId);

    const platforms = scheduledPost.platforms as {
      tiktok?: boolean;
      instagram?: boolean;
      youtube?: boolean;
    };

    const postResults = {
      tiktok: null as { publishId: string; success: true } | { error: string } | null,
      instagram: null as { mediaId: string; success: true } | { error: string } | null,
      youtube: null as { videoId: string; url: string; success: true } | { error: string } | null,
    };

    if (platforms?.tiktok) {
      console.log(`[publish-post-now] Posting to TikTok`);
      try {
        postResults.tiktok = await postToTikTok(
          userId,
          scheduledPost.video_url,
          supabaseAdmin,
          scheduledPost
        );
        console.log(`[publish-post-now] ✅ TikTok successful`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[publish-post-now] TikTok failed:', err);
        postResults.tiktok = { error: msg };
      }
    }

    if (platforms?.instagram) {
      console.log(`[publish-post-now] Posting to Instagram`);
      try {
        postResults.instagram = await postToInstagram(
          userId,
          scheduledPost.video_url,
          supabaseAdmin,
          scheduledPost
        );
        console.log(`[publish-post-now] ✅ Instagram successful`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[publish-post-now] Instagram failed:', err);
        postResults.instagram = { error: msg };
      }
    }

    if (platforms?.youtube) {
      console.log(`[publish-post-now] Posting to YouTube`);
      try {
        // No scheduledTime → upload as public immediately
        postResults.youtube = await postToYouTube(
          userId,
          scheduledPost.video_url,
          supabaseAdmin,
          scheduledPost
        );
        console.log(`[publish-post-now] ✅ YouTube successful`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[publish-post-now] YouTube failed:', err);
        postResults.youtube = { error: msg };
      }
    }

    const tiktokSuccess = !platforms?.tiktok || !('error' in (postResults.tiktok ?? {}));
    const instagramSuccess = !platforms?.instagram || !('error' in (postResults.instagram ?? {}));
    const youtubeSuccess = !platforms?.youtube || !('error' in (postResults.youtube ?? {}));
    const allSuccess = tiktokSuccess && instagramSuccess && youtubeSuccess;

    if (allSuccess) {
      const tiktokOk = postResults.tiktok && 'publishId' in postResults.tiktok ? postResults.tiktok : null;
      const instagramOk = postResults.instagram && 'mediaId' in postResults.instagram ? postResults.instagram : null;
      const youtubeOk = postResults.youtube && 'videoId' in postResults.youtube ? postResults.youtube : null;

      await supabaseAdmin
        .from('scheduled_posts')
        .update({
          status: 'published',
          tiktok_publish_id: tiktokOk?.publishId || null,
          tiktok_posted_at: tiktokOk ? new Date().toISOString() : null,
          instagram_media_id: instagramOk?.mediaId || null,
          instagram_posted_at: instagramOk ? new Date().toISOString() : null,
          youtube_video_id: youtubeOk?.videoId || null,
          youtube_posted_at: youtubeOk ? new Date().toISOString() : null,
        })
        .eq('id', scheduledPostId);

      console.log(`[publish-post-now] ✅ Post ${scheduledPostId} published successfully`);
      return NextResponse.json({ success: true, results: postResults });
    } else {
      const tiktokErr = postResults.tiktok && 'error' in postResults.tiktok ? postResults.tiktok.error : null;
      const instagramErr = postResults.instagram && 'error' in postResults.instagram ? postResults.instagram.error : null;
      const youtubeErr = postResults.youtube && 'error' in postResults.youtube ? postResults.youtube.error : null;
      const errorDetails = { tiktok: tiktokErr, instagram: instagramErr, youtube: youtubeErr };

      await supabaseAdmin
        .from('scheduled_posts')
        .update({
          status: 'failed',
          last_error: JSON.stringify(errorDetails),
        })
        .eq('id', scheduledPostId);

      console.error(`[publish-post-now] ❌ Post ${scheduledPostId} failed:`, errorDetails);
      return NextResponse.json(
        { error: 'One or more platforms failed', details: errorDetails },
        { status: 500 }
      );
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[publish-post-now] Unexpected error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
