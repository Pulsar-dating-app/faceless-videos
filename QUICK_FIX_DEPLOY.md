# Quick Fix Deployment Guide

## What Changed

### The Problem
Video generation was hanging in Vercel production after downloading the background video and saving subtitles. The FFmpeg process would never complete.

### The Solution
1. **Subtitle rendering disabled in production** - The FFmpeg `subtitles` filter requires fontconfig which isn't available in Vercel's serverless environment
2. **Added timeout protection** - 50-second timeout to prevent infinite hanging
3. **Optimized encoding** - Using `-preset veryfast` for faster processing
4. **Better logging** - More detailed console output to diagnose issues

## Deploy Now

```bash
git add .
git commit -m "Fix FFmpeg hanging in production - disable subtitle burn-in"
git push
```

## What to Expect

### ✅ What Will Work
- Video generation completes successfully
- Audio and video are merged
- Video uploads to Supabase Storage
- You get a working video URL

### ⚠️ What Won't Work (Temporarily)
- **Subtitles will NOT be burned into the video in production**
- Subtitles work fine in local development
- In production, subtitles are skipped to prevent hanging

## Testing

1. **Deploy the changes** (command above)
2. **Wait for Vercel deployment** to complete
3. **Generate a video** on your production site
4. **Check Vercel logs** for these messages:
   ```
   Running in production mode
   Downloading background video from: ...
   Background video downloaded.
   Subtitles saved.
   Skipping subtitle burn-in in production
   Starting FFmpeg processing...
   FFmpeg command: ...
   Processing: X% done
   FFmpeg processing completed successfully
   Uploading video to Supabase Storage...
   Video uploaded successfully
   ```

5. **Verify the video plays** (it should work, but without subtitles)

## If It Still Hangs

Check these in Vercel logs:
1. Does it reach "Starting FFmpeg processing..."?
2. Do you see "FFmpeg command: ..." with the actual command?
3. Do you see any progress updates? ("Processing: X% done")
4. What's the last message before it times out?

### Common Issues

**If it stops at "Background video downloaded":**
- Issue with saving subtitles file
- Check `/tmp` write permissions
- Look for file system errors

**If it stops at "Starting FFmpeg processing":**
- FFmpeg binary not found or not executable
- Check that `ffmpeg-static` is installed
- Verify `serverExternalPackages` in next.config.ts

**If it shows "FFmpeg command" but no progress:**
- FFmpeg is stuck on encoding
- Possible issues with input files
- Try with a shorter video/audio

**If it times out after 10 seconds:**
- You're on Vercel Hobby plan (10s limit)
- Upgrade to Pro plan for 60s limit
- Or move processing to a different service

## Subtitle Solutions

Since subtitles don't work in production, here are alternatives:

### Option 1: Client-Side Subtitles (Recommended)
Add subtitles using HTML5 video track:

```typescript
// In your frontend component
<video controls>
  <source src={videoUrl} type="video/mp4" />
  <track 
    kind="subtitles" 
    src={subtitleUrl} // VTT format
    srcLang="en" 
    label="English"
    default 
  />
</video>
```

You'll need to:
1. Convert SRT to VTT format (simple conversion)
2. Store VTT file in Supabase Storage
3. Add `<track>` element to video player

### Option 2: Use a Video Player Library
Use video.js or plyr.js which have built-in subtitle support:

```typescript
import Plyr from 'plyr';

new Plyr('#player', {
  captions: { active: true, language: 'en' }
});
```

### Option 3: Move to Background Processing
- Generate videos asynchronously
- Use a job queue (Bull/BullMQ)
- Process on a dedicated server with proper FFmpeg setup
- Notify user when video is ready

### Option 4: Use Supabase Edge Functions
Move video processing to Supabase Edge Functions:
- 150-second timeout (vs 10-60s on Vercel)
- Can install custom FFmpeg with fontconfig
- Better suited for heavy processing

## Vercel Plan Requirements

| Plan | Timeout | Video Length | Recommendation |
|------|---------|--------------|----------------|
| Hobby | 10s | < 30s audio | Not sufficient for most videos |
| Pro | 60s | < 2min audio | Should work for most cases |
| Enterprise | Custom | Any length | Best option |

**Current config:** `maxDuration = 60` (requires Pro plan)

## Next Steps After Testing

1. **If video generation works without subtitles:**
   - Implement client-side subtitle rendering
   - Update UI to show that subtitles are displayed (not burned in)
   - Consider this a permanent solution

2. **If video generation still fails:**
   - Collect Vercel logs and share for further debugging
   - Consider moving to Supabase Edge Functions
   - Or use a dedicated video processing service

3. **For production-ready app:**
   - Implement proper error handling in frontend
   - Show processing progress to users
   - Add retry logic for failed generations
   - Consider async/background processing for longer videos

## Files Modified

- ✅ `/app/api/merge/route.ts`
- ✅ `/app/api/merge-ai-video/route.ts`
- ✅ Documentation files created

All changes are backward compatible with local development.
