# Supabase Storage Setup for Video Generation

This guide explains how to set up Supabase Storage to handle generated videos in production.

## Why Supabase Storage?

When deployed to Vercel, the application runs in a serverless environment with a read-only filesystem (except for `/tmp`). The `/tmp` directory is:
- Limited in size (512MB)
- Cleared between function invocations
- Not suitable for serving public content

To solve this, we use Supabase Storage to:
1. Store generated videos permanently
2. Serve them via CDN with public URLs
3. Handle automatic cleanup if needed

## Setup Instructions

### 1. Create a Storage Bucket

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **New bucket**
5. Configure the bucket:
   - **Name**: `videos`
   - **Public bucket**: ✅ **Check this box** (videos need to be publicly accessible)
   - **File size limit**: Set according to your needs (e.g., 100MB for short videos)
   - **Allowed MIME types**: `video/mp4` (optional, for security)
6. Click **Create bucket**

### 2. Verify Bucket Policies

After creating the bucket, ensure it has the correct policies:

1. Go to **Storage** → **Policies** (in the Storage section)
2. For the `videos` bucket, you should see:
   - **SELECT (read)**: Public access enabled (for serving videos)
   - **INSERT (upload)**: Enabled for authenticated users or service role
   - **DELETE**: Enabled for authenticated users or service role (for cleanup)

If policies don't exist, create them:

#### Read Policy (Public)
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'videos' );
```

#### Upload Policy (Authenticated)
```sql
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'videos' );
```

#### Delete Policy (Authenticated)
```sql
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'videos' );
```

### 3. Test the Setup

You can test the storage bucket by:

1. Going to **Storage** → **videos** bucket
2. Manually uploading a test video file
3. Copying the public URL
4. Opening it in a browser to verify access

### 4. Deploy Changes

After setting up the storage bucket:

1. Commit your code changes:
   ```bash
   git add .
   git commit -m "Add Supabase Storage for video uploads in production"
   git push
   ```

2. Vercel will automatically redeploy

3. Test video generation in production

## How It Works

### Development Mode
- Videos are saved to `public/temp/` directory
- Served directly by Next.js
- No Supabase Storage needed

### Production Mode (Vercel)
- Videos are processed in `/tmp/` directory
- Uploaded to Supabase Storage `videos` bucket
- Public URL is returned to the client
- Temporary files are cleaned up

### Code Implementation

Both `/app/api/merge/route.ts` and `/app/api/merge-ai-video/route.ts` now:

1. Detect environment using `process.env.VERCEL === "1"`
2. Use appropriate temp directory (`/tmp` or `public/temp`)
3. Upload to Supabase Storage in production
4. Return public URL from storage or local path

## Storage Management

### Automatic Cleanup

You can set up automatic cleanup using Supabase Edge Functions or cron jobs:

```sql
-- Delete videos older than 7 days
DELETE FROM storage.objects
WHERE bucket_id = 'videos'
  AND created_at < NOW() - INTERVAL '7 days';
```

### Manual Cleanup

1. Go to **Storage** → **videos** bucket
2. Select files to delete
3. Click **Delete**

## Troubleshooting

### "Failed to upload video: new row violates row-level security policy"
- Check that your bucket policies are correctly set up
- Ensure `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set in environment variables
- Verify the bucket is public or has appropriate policies

### "Bucket not found"
- Ensure the bucket name is exactly `videos`
- Check that the bucket was created successfully in your Supabase project

### Videos not loading
- Verify the bucket is public
- Check that the public URL is correct
- Ensure CORS settings allow access from your domain

### Out of storage space
- Check your Supabase plan limits
- Implement automatic cleanup of old videos
- Consider compression or lower quality settings

## Environment Variables

Make sure these are set in your Vercel project:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key

These should already be set if you've deployed the OAuth functionality.

## Additional Resources

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Vercel Filesystem Limitations](https://vercel.com/docs/concepts/limits/overview#filesystem)
- [Next.js API Routes in Production](https://nextjs.org/docs/api-routes/introduction)
