# Post to Social Media Edge Function

This Supabase Edge Function handles posting videos to social media platforms (TikTok, YouTube, Instagram).

## Features

- ✅ **TikTok**: Direct upload to TikTok via TikTok API v2
- ✅ **YouTube**: Upload as YouTube Shorts/regular video via YouTube Data API v3
- ⚠️ **Instagram**: Requires publicly accessible video URL (limitation)
- 🔐 **Secure**: Uses OAuth tokens stored securely

## Deployment

Deploy this function to Supabase:

```bash
supabase functions deploy post-to-social
```

## Required Environment Variables

The function uses the same OAuth credentials as the auth functions:

- `YOUTUBE_CLIENT_ID` - YouTube OAuth Client ID
- `YOUTUBE_CLIENT_SECRET` - YouTube OAuth Client Secret
- `TIKTOK_CLIENT_KEY` - TikTok Client Key (not needed for posting, but good to have)
- `TIKTOK_CLIENT_SECRET` - TikTok Client Secret (not needed for posting, but good to have)

These should already be set if you've deployed the OAuth functions.

## Usage

The function is called via the Next.js API route `/api/post-to-social`:

```typescript
const response = await fetch('/api/post-to-social', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    platform: 'youtube', // 'youtube', 'tiktok', or 'instagram'
    videoUrl: 'https://your-domain.com/video.mp4',
    accessToken: 'user_access_token',
    refreshToken: 'user_refresh_token', // Optional, for YouTube
    title: 'Amazing Video',
    description: 'Check out this video!',
    hashtags: ['#viral', '#fyp', '#trending'],
  }),
});
```

## Platform-Specific Notes

### YouTube
- Uploads videos as public by default
- Supports title, description, hashtags, and tags
- Uses multipart upload
- Automatically refreshes token if refresh_token is provided
- Returns video URL: `https://www.youtube.com/watch?v={videoId}`

### TikTok
- Uses TikTok API v2 (post/publish/video)
- Video privacy set to `SELF_ONLY` by default (change in code if needed)
- Supports title and video upload
- Returns publish ID and processing status

### Instagram
- Currently requires publicly accessible video URL
- Instagram Graph API limitation: videos must be hosted publicly
- Manual posting recommended until we implement video hosting

## Error Handling

The function returns appropriate error messages:
- `400`: Missing required parameters
- `500`: Upload failed, token refresh failed, or API errors

## Testing

Test locally:

```bash
# Start Supabase locally
supabase start

# Deploy function
supabase functions deploy post-to-social

# Test with curl
curl -X POST http://localhost:54321/functions/v1/post-to-social \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "youtube",
    "videoUrl": "https://example.com/video.mp4",
    "accessToken": "ya29.xxx",
    "refreshToken": "1//xxx",
    "title": "Test Video",
    "hashtags": ["#test"]
  }'
```

## Logs

View function logs:

```bash
supabase functions logs post-to-social --tail
```
