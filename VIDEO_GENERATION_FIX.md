# Video Generation Fix for Production Deployment

## Problem
When deployed to Vercel, the video generation API routes were failing with:
```
Error: ENOENT: no such file or directory, mkdir '/var/task/public/temp'
```

This occurred because Vercel's serverless functions run in a read-only filesystem environment (except for `/tmp`), making it impossible to create directories in `public/temp`.

## Solution
Implemented a dual-mode approach that:
1. **Development**: Uses `public/temp/` directory (works locally)
2. **Production**: Uses `/tmp/` for processing and Supabase Storage for serving videos

## Changes Made

### 1. Updated `/app/api/merge/route.ts`
- Added Supabase client import
- Detects production environment using `process.env.VERCEL === "1"`
- Uses `/tmp/{tempId}/` directory in production instead of `public/temp/`
- Uploads final video to Supabase Storage bucket `videos`
- Returns public URL from Supabase instead of local path
- Cleans up all temporary files after upload

### 2. Updated `/app/api/merge-ai-video/route.ts`
- Same changes as above
- Handles multiple image files in `/tmp` directory
- Uploads final AI-generated video to Supabase Storage
- Proper cleanup of all temp directories and files

### 3. Created Documentation
- `SUPABASE_STORAGE_SETUP.md`: Complete guide for setting up Supabase Storage

## Setup Required

### For Supabase Storage:
1. Create a public bucket named `videos` in Supabase Dashboard
2. Enable public read access
3. Configure policies for upload/delete
4. Ensure environment variables are set in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

See `SUPABASE_STORAGE_SETUP.md` for detailed instructions.

## How It Works

### Production Flow:
1. Request received at API route
2. Temporary files created in `/tmp/{uuid}/`
3. Video processing (FFmpeg) runs in `/tmp`
4. Final video uploaded to Supabase Storage `videos/generated-videos/{uuid}.mp4`
5. Public URL returned: `https://{project}.supabase.co/storage/v1/object/public/videos/generated-videos/{uuid}.mp4`
6. All temporary files and directories cleaned up

### Development Flow:
1. Request received at API route
2. Files created in `public/temp/`
3. Video processing runs locally
4. Local URL returned: `/temp/{uuid}.mp4`
5. Intermediate files cleaned up (output video kept)

## Benefits
- ✅ Works in serverless environments (Vercel, AWS Lambda, etc.)
- ✅ Videos served via CDN (faster, more reliable)
- ✅ No filesystem size limitations
- ✅ Persistent storage (videos don't disappear between deployments)
- ✅ Easy cleanup management via Supabase
- ✅ Backward compatible with local development

## Testing
1. Deploy to Vercel
2. Generate a video through the UI
3. Verify video uploads to Supabase Storage
4. Check that video URL works and video plays correctly

## Maintenance
Consider implementing automatic cleanup of old videos:
- Add a cron job or Edge Function to delete videos older than X days
- Or keep videos permanently if needed for user galleries
