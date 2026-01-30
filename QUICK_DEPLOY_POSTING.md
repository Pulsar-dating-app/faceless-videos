# Quick Deploy: Social Media Posting Feature

Follow these steps to deploy the social media posting feature:

## Prerequisites

✅ OAuth functions already deployed (tiktok-auth, youtube-auth, instagram-auth)
✅ Social media connections working
✅ Video generation working

## Step 1: Deploy Edge Function

```bash
# Option A: Use the deployment script (deploys all functions)
.\scripts\deploy-oauth-functions.ps1  # Windows
./scripts/deploy-oauth-functions.sh   # Mac/Linux

# Option B: Deploy only the posting function
supabase functions deploy post-to-social
```

## Step 2: Verify Deployment

```bash
# Check function is deployed
supabase functions list

# Should show:
# - tiktok-auth
# - youtube-auth
# - instagram-auth
# - post-to-social ✨ (new)
```

## Step 3: Test in Your App

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Go to dashboard and generate a video

3. After video is ready, you should see:
   - **"Post to Social Media"** button (blue)

4. Click the button to open the post panel

5. Fill in:
   - Title: "My Amazing Video"
   - Description (optional): "Check this out!"
   - Hashtags: "#viral #fyp #trending"

6. Click on a connected platform (TikTok or YouTube)

7. Wait for success message!

## Step 4: Production Deployment

When deploying to production (Vercel/Netlify/etc):

1. **Ensure environment variables are set**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

2. **Deploy your Next.js app**:
   ```bash
   # If using Vercel
   vercel --prod
   
   # Or commit and push (auto-deploy)
   git add .
   git commit -m "Add social media posting feature"
   git push
   ```

3. **Verify edge function is accessible**:
   - Edge functions are automatically available at:
   - `https://your-project.supabase.co/functions/v1/post-to-social`

## Troubleshooting

### "Function not found" error
```bash
# Redeploy the function
supabase functions deploy post-to-social
```

### "Access token invalid" error
- Reconnect your social media account
- Go to Dashboard → Social Media → Disconnect & Reconnect

### "Failed to download video" error
- Check that your video URL is publicly accessible
- For local testing, use ngrok or similar to expose localhost

### Edge function logs
```bash
# View real-time logs
supabase functions logs post-to-social --tail

# View recent logs
supabase functions logs post-to-social
```

## What's New

### Frontend Changes
- ✨ New "Post to Social Media" button on video result screen
- 📝 Post customization panel (title, description, hashtags)
- 🎨 Platform selection buttons with connection status
- ⏳ Loading states during posting

### Backend Changes
- 🔧 New edge function: `post-to-social`
- 🛣️ New API route: `/api/post-to-social`
- 📹 YouTube upload support
- 📱 TikTok upload support
- 📷 Instagram placeholder (coming soon)

## Platform Status

| Platform | Status | Notes |
|----------|--------|-------|
| YouTube | ✅ Working | Full support with token refresh |
| TikTok | ✅ Working | Posts to "Self Only" by default |
| Instagram | ⚠️ Limited | Requires public video URL (limitation) |
| Facebook | 🔜 Coming Soon | Not yet implemented |

## Next Steps

1. Test posting to each connected platform
2. Monitor edge function logs for errors
3. Adjust privacy settings if needed (see `SOCIAL_MEDIA_POSTING.md`)
4. Share feedback with your team!

## Need Help?

- 📖 Full documentation: `SOCIAL_MEDIA_POSTING.md`
- 🔐 OAuth setup: `OAUTH_DEPLOYMENT.md`
- 🐛 Check logs: `supabase functions logs post-to-social --tail`

---

**You're ready to post!** 🎉
