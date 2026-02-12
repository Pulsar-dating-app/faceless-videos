# FFmpeg Processing Issues in Production

## Current Issue
The video generation process gets stuck after "Subtitles saved" and never completes in Vercel production environment.

## Root Causes

### 1. Subtitle Filter Hanging (Most Likely)
The FFmpeg `subtitles` filter requires **fontconfig** and system fonts, which are often not available or misconfigured in serverless environments like Vercel.

**Symptoms:**
- Process hangs after "Subtitles saved."
- No progress updates from FFmpeg
- Eventually times out

**Solution Implemented:**
- Skip subtitle burn-in in production (`isProduction` check)
- Only use subtitle filter in local development
- Subtitles can be added client-side or using alternative methods

### 2. Function Timeout
Vercel has strict timeout limits:
- **Hobby plan**: 10 seconds
- **Pro plan**: 60 seconds (with `maxDuration` config)

**Solution Implemented:**
- Added `export const maxDuration = 60` to route
- Added internal 50-second timeout to FFmpeg processing
- Optimized FFmpeg with `-preset veryfast`

### 3. Memory/CPU Limits
Video processing is CPU-intensive and may exceed serverless limits.

**Solution Implemented:**
- Use `-preset veryfast` for faster encoding
- Add `-movflags +faststart` for streaming optimization
- Process in `/tmp` which has more space

## Current Configuration

### Merge Route (`/app/api/merge/route.ts`)
```typescript
// Route configuration
export const maxDuration = 60; // Requires Vercel Pro plan
export const dynamic = 'force-dynamic';

// FFmpeg settings
-preset veryfast  // Fast encoding for serverless
-crf 23          // Good quality/size balance
-movflags +faststart // Optimize for streaming

// Subtitle handling
if (srtPath && !isProduction) {
  // Only burn subtitles in development
  // In production: skip due to fontconfig issues
}
```

## Testing Steps

### 1. Test Without Subtitles First
Try generating a video without subtitles to isolate the issue:
- Remove subtitle text from the form
- Generate video
- Check if it completes successfully

### 2. Check Vercel Logs
```bash
# View real-time logs
vercel logs --follow

# Or in Vercel Dashboard:
# Project → Deployments → Latest → Functions → /api/merge
```

Look for:
- FFmpeg command being executed
- Progress updates ("Processing: X% done")
- Any error messages
- Where it gets stuck

### 3. Check Function Duration
In Vercel Dashboard → Functions, verify:
- Current timeout limit (10s hobby, 60s pro)
- Actual execution time before timeout
- Memory usage

### 4. Test Locally in Production Mode
```bash
# Set production flag
$env:VERCEL="1"  # PowerShell
# or
export VERCEL=1  # Bash

npm run dev
# Generate video and check behavior
```

## Alternative Solutions

### Option 1: Use Supabase Edge Functions for Video Processing
Move FFmpeg processing to Supabase Edge Functions which have different limits:
- 150-second timeout
- Better for CPU-intensive tasks
- Can use custom FFmpeg builds

### Option 2: Use a Dedicated Video Processing Service
- AWS Lambda with increased timeout (15 min)
- AWS MediaConvert
- Cloudinary video transformations
- Mux video API

### Option 3: Client-Side Subtitle Rendering
Instead of burning subtitles:
1. Return video without burned subtitles
2. Return subtitle data separately
3. Use HTML5 `<video>` with `<track>` for subtitle display
4. Or use video.js / plyr.js with subtitle support

```html
<video controls>
  <source src="video.mp4" type="video/mp4">
  <track kind="subtitles" src="subtitles.vtt" srclang="en" label="English">
</video>
```

### Option 4: Pre-process Videos
- Generate videos in a background job (queue system)
- Use a worker service (Bull, BullMQ)
- Process asynchronously and notify user when ready

## Debugging Checklist

- [ ] Check Vercel plan (Hobby vs Pro) for timeout limits
- [ ] Verify FFmpeg is executing (check logs for "FFmpeg command:")
- [ ] Test without subtitles
- [ ] Check if progress events are firing
- [ ] Verify `/tmp` directory is writable
- [ ] Check memory usage in Vercel dashboard
- [ ] Test with shorter audio/video files
- [ ] Verify ffmpeg-static is included in deployment

## Immediate Next Steps

1. **Deploy current changes** with subtitle skipping in production
2. **Test video generation** without burned subtitles
3. **Verify in logs** that FFmpeg completes successfully
4. **Decide on subtitle strategy**:
   - Client-side rendering (recommended)
   - Move to different processing platform
   - Use pre-generated subtitle tracks

## Configuration Files Updated

- `/app/api/merge/route.ts` - Main video merge endpoint
- `/app/api/merge-ai-video/route.ts` - AI video generation endpoint

Both now include:
- Production environment detection
- Subtitle skipping in production
- Timeout handling
- Better progress logging
- Optimized FFmpeg settings

## Expected Behavior After Fix

### Development (Local):
1. Audio + video downloaded
2. Subtitles burned into video ✅
3. Saved to `public/temp/`
4. Local URL returned

### Production (Vercel):
1. Audio + video downloaded to `/tmp`
2. Subtitles **skipped** (fontconfig issue)
3. Video processed and uploaded to Supabase Storage
4. Public CDN URL returned
5. Temp files cleaned up

**Note:** Users will need to add subtitles client-side in production, or we need to implement one of the alternative solutions above.
