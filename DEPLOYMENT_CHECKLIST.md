# Deployment Checklist for Video Generation Fix

Follow this checklist to deploy the video generation fix to production.

## Pre-Deployment Steps

### 1. Supabase Storage Setup
- [ ] Log in to Supabase Dashboard (https://app.supabase.com)
- [ ] Navigate to Storage section
- [ ] Create new bucket named `videos`
- [ ] Enable **Public bucket** option
- [ ] Set file size limit (recommended: 100MB+)
- [ ] Verify bucket policies are set correctly:
  - [ ] Public SELECT (read) access
  - [ ] Authenticated INSERT (upload) access
  - [ ] Authenticated DELETE access

### 2. Environment Variables Verification
- [ ] Verify `NEXT_PUBLIC_SUPABASE_URL` is set in Vercel
- [ ] Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set in Vercel
- [ ] Check that these match your Supabase project credentials

## Deployment Steps

### 3. Deploy Code Changes
```bash
# Commit changes
git add .
git commit -m "Fix video generation for production using Supabase Storage"
git push origin main
```

- [ ] Push code to repository
- [ ] Wait for Vercel to automatically deploy
- [ ] Check deployment logs for any errors

## Post-Deployment Testing

### 4. Test Video Generation
- [ ] Go to your production website
- [ ] Log in to your account
- [ ] Start a new video generation
- [ ] Fill in the form and submit
- [ ] Wait for video to generate (check browser console for any errors)
- [ ] Verify video plays correctly
- [ ] Check Supabase Storage → videos bucket to confirm upload

### 5. Verify Supabase Storage
- [ ] Go to Supabase Dashboard → Storage → videos
- [ ] Look for `generated-videos/` folder
- [ ] Confirm video file is present
- [ ] Copy public URL and test in browser

### 6. Test Both API Routes
- [ ] Test `/api/merge` (background video with audio)
- [ ] Test `/api/merge-ai-video` (AI-generated images video)
- [ ] Verify both work correctly in production

## Troubleshooting

If video generation fails:

1. **Check Vercel Logs**
   - Go to Vercel Dashboard → Your Project → Deployments → Latest → Functions
   - Look for errors in the function logs
   - Common issues: Missing env vars, bucket not found, policy errors

2. **Check Supabase Storage Logs**
   - Go to Supabase Dashboard → Logs → Storage
   - Look for failed upload attempts
   - Check error messages for policy violations

3. **Test Locally First**
   - Run `npm run dev` locally
   - Generate a video locally to ensure code works
   - If local works but production fails, it's likely a configuration issue

4. **Verify Bucket Policies**
   - Go to Storage → Policies
   - Ensure `videos` bucket has correct policies
   - Try creating policies manually using SQL if needed (see SUPABASE_STORAGE_SETUP.md)

5. **Check Environment Variables**
   - Vercel Dashboard → Settings → Environment Variables
   - Ensure all Supabase variables are set
   - Redeploy after adding/updating variables

## Rollback Plan

If issues occur and you need to rollback:

```bash
# Revert the changes
git revert HEAD
git push origin main
```

Note: This will bring back the original code that works locally but fails in production. You'll need to debug and redeploy.

## Success Criteria

✅ Video generation completes without errors
✅ Video file appears in Supabase Storage
✅ Video URL is accessible and video plays
✅ No ENOENT errors in logs
✅ Both merge endpoints work correctly

## Support

If you encounter issues not covered here:
- Check `SUPABASE_STORAGE_SETUP.md` for detailed storage setup
- Check `VIDEO_GENERATION_FIX.md` for technical details
- Review Supabase Storage documentation: https://supabase.com/docs/guides/storage
- Review Vercel filesystem documentation: https://vercel.com/docs/concepts/limits/overview#filesystem
