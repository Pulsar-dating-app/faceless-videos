# Social Media Posting Feature

This feature allows users to directly post their generated videos to connected social media platforms (TikTok, YouTube, Instagram) with one click.

## Features

✅ **One-Click Posting**: Post videos directly from the dashboard after generation
✅ **Multiple Platforms**: Support for TikTok, YouTube, and Instagram (partial)
✅ **Customization**: Add title, description, and hashtags before posting
✅ **Connection Status**: Visual indicators showing which accounts are connected
✅ **Progress Tracking**: Real-time posting status with loading indicators
✅ **Secure**: Uses OAuth tokens stored in localStorage, credentials in Supabase

## How It Works

### User Flow

1. **Generate Video**: User creates a video using the video creation wizard
2. **Post Button**: After video is ready, click "Post to Social Media" button
3. **Customize Post**: Enter title, description, and hashtags
4. **Select Platform**: Click on any connected platform (TikTok, YouTube, Instagram)
5. **Auto-Post**: Video is automatically uploaded with the specified details
6. **Confirmation**: Success message with video URL (YouTube) or status (TikTok)

### Architecture

```
Dashboard (UI)
    ↓
/api/post-to-social (Next.js API Route)
    ↓
Supabase Edge Function (post-to-social)
    ↓ (downloads video from URL)
Platform APIs (TikTok, YouTube, Instagram)
    ↓
Video Posted!
```

## Platform Support

### YouTube ✅ Fully Working

- **API**: YouTube Data API v3
- **Upload Type**: Multipart upload
- **Privacy**: Public (configurable)
- **Features**:
  - Title and description
  - Hashtags and tags
  - Category (People & Blogs)
  - Token refresh support
- **Response**: Video ID and URL
- **Example**: `https://www.youtube.com/watch?v=VIDEO_ID`

### TikTok ✅ Fully Working

- **API**: TikTok API v2 (post/publish/video)
- **Upload Type**: Chunked upload
- **Privacy**: Self-only by default (change in code: `PUBLIC_TO_EVERYONE`, `MUTUAL_FOLLOW_FRIENDS`, `SELF_ONLY`)
- **Features**:
  - Title
  - Video cover timestamp
  - Duet/comment/stitch settings
- **Response**: Publish ID and processing status
- **Note**: Video takes time to process on TikTok's side

### Instagram ⚠️ Partial Support

- **API**: Instagram Graph API
- **Limitation**: Requires publicly accessible video URL
- **Status**: Currently throws error with guidance to post manually
- **Workaround Needed**: Implement temporary public video hosting
- **Future**: Will be implemented once video hosting is set up

### Facebook 🔜 Coming Soon

- Not yet implemented
- Will use Facebook Graph API
- Similar to Instagram, requires publicly accessible URL

## Setup & Deployment

### 1. Prerequisites

Ensure you have completed OAuth setup:
- TikTok OAuth configured with `user.info.basic` scope
- YouTube OAuth configured with `youtube.upload` scope
- Instagram OAuth configured with `instagram_business_content_publish` scope

See `OAUTH_DEPLOYMENT.md` for details.

### 2. Deploy Edge Function

Deploy the `post-to-social` edge function:

```bash
# Using the deployment script (recommended)
.\scripts\deploy-oauth-functions.ps1  # Windows
# or
./scripts/deploy-oauth-functions.sh  # Mac/Linux

# Or manually
supabase functions deploy post-to-social
```

### 3. Verify Deployment

Check that the function is deployed:

```bash
supabase functions list
```

You should see `post-to-social` in the list.

### 4. Test Posting

1. Connect social media accounts in the "Social Media" section
2. Generate a video
3. Click "Post to Social Media"
4. Fill in post details
5. Click on a platform button
6. Wait for confirmation

## Configuration

### Changing TikTok Privacy

Edit `supabase/functions/post-to-social/index.ts`:

```typescript
privacy_level: 'PUBLIC_TO_EVERYONE', // Options: PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, SELF_ONLY
```

### Changing YouTube Privacy

Edit `supabase/functions/post-to-social/index.ts`:

```typescript
privacyStatus: 'public', // Options: public, private, unlisted
```

### Changing YouTube Category

Edit `supabase/functions/post-to-social/index.ts`:

```typescript
categoryId: '22', // 22 = People & Blogs, see YouTube categories list
```

## UI Components

### Post Button

Main button that appears after video generation:
- Blue background with share icon
- Opens the post panel when clicked

### Post Panel

Expandable panel with:
- **Title Input**: Short title for the video
- **Description Textarea**: Optional description
- **Hashtags Input**: Space-separated hashtags (e.g., `#viral #fyp #trending`)
- **Platform Buttons**: Grid of 4 platform buttons (2x2)
  - TikTok (black)
  - YouTube (red)
  - Instagram (gradient purple/pink)
  - Facebook (blue, disabled)
- **Connection Status**: Shows "Connected" or "Not connected"
- **Loading State**: Shows "Posting..." with spinner when active

### Visual States

- **Connected & Ready**: Colored border on hover, enabled
- **Not Connected**: Gray, disabled, 50% opacity
- **Posting**: Blue text with spinner
- **Coming Soon**: Orange text (Instagram when connected but API limitation)

## Error Handling

### Common Errors

1. **"No video to post"**
   - Solution: Generate a video first

2. **"Please connect your [Platform] account first"**
   - Solution: Go to Social Media section and connect the account

3. **"Failed to download video"**
   - Solution: Check video URL is accessible

4. **YouTube: "Token expired"**
   - Solution: Function automatically refreshes token if refresh_token available

5. **TikTok: "Upload failed"**
   - Solution: Check TikTok API quotas and access token validity

6. **Instagram: "Requires publicly accessible video URL"**
   - Solution: Download video and post manually for now

## Monitoring

### Check Function Logs

```bash
# View logs in real-time
supabase functions logs post-to-social --tail

# View recent logs
supabase functions logs post-to-social
```

### Debug Information

The edge function logs:
- `Downloading video from: [URL]`
- `Video downloaded: [SIZE] bytes`
- `Posting to [Platform]...`
- `✅ Posted to [Platform]: [ID]`

## Security

- ✅ OAuth tokens stored client-side (localStorage)
- ✅ Edge function credentials stored in Supabase secrets
- ✅ CORS configured to allow requests from your domain
- ✅ Video download happens server-side
- ✅ No sensitive credentials in frontend code

## Future Improvements

### Short Term
- [ ] Implement Instagram posting with temporary video hosting
- [ ] Add Facebook posting support
- [ ] Add scheduling feature (post at specific time)
- [ ] Add draft saving

### Long Term
- [ ] Multi-platform posting (post to all at once)
- [ ] Post analytics integration
- [ ] Video optimization per platform
- [ ] Thumbnail customization
- [ ] Caption templates

## API Reference

### POST /api/post-to-social

Request body:

```typescript
{
  platform: 'youtube' | 'tiktok' | 'instagram';
  videoUrl: string; // Full URL to video
  accessToken: string; // OAuth access token
  refreshToken?: string; // Optional, for YouTube
  title?: string; // Video title
  description?: string; // Video description
  hashtags?: string[]; // Array of hashtags
}
```

Response (success):

```typescript
{
  success: true;
  platform: string;
  videoId?: string; // YouTube
  url?: string; // YouTube video URL
  publishId?: string; // TikTok
  status?: string; // TikTok processing status
}
```

Response (error):

```typescript
{
  error: string;
  details?: string;
}
```

## Testing

### Local Testing

1. Start development server:
   ```bash
   npm run dev
   ```

2. Generate a test video

3. Open browser console to see logs

4. Try posting to each platform

### Production Testing

1. Deploy to production environment

2. Ensure all edge functions are deployed

3. Test with real social media accounts

4. Monitor edge function logs for errors

## Troubleshooting

### "Function not found"
- Deploy the edge function: `supabase functions deploy post-to-social`

### "Access token invalid"
- Reconnect the social media account
- Check token expiration (Instagram tokens expire after 60 days)

### "Video too large"
- TikTok max: 4GB
- YouTube max: 256GB (or 12 hours)
- Instagram max: 100MB, 60 seconds

### "Rate limit exceeded"
- TikTok: Limited API quotas
- YouTube: 10,000 quota units per day
- Instagram: 200 API calls per hour

## Support

For issues or questions:
1. Check edge function logs
2. Verify OAuth connections
3. Test with a small video first
4. Check platform API status pages

---

**Ready to share your viral videos!** 🚀📱
