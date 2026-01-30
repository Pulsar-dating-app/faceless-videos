# 🚀 OAuth Edge Functions - Deployment Checklist

Use this checklist to ensure a smooth deployment of your secure OAuth implementation.

## Pre-Deployment

- [ ] Have Supabase account and project created
- [ ] Have OAuth credentials ready:
  - [ ] TikTok Client Key & Secret
  - [ ] YouTube Client ID & Secret
  - [ ] Instagram Client ID & Secret
- [ ] Know your production domain URL
- [ ] Have access to OAuth provider settings (TikTok, YouTube, Instagram dashboards)

## Installation

- [ ] Install Supabase CLI: `npm install -g supabase`
- [ ] Verify installation: `supabase --version`

## Configuration

- [ ] Login to Supabase: `supabase login`
- [ ] Link project: `supabase link --project-ref YOUR_PROJECT_REF`
- [ ] Verify link: `supabase status`

## Set Secrets

- [ ] Set TikTok secrets:
  ```bash
  supabase secrets set TIKTOK_CLIENT_KEY=...
  supabase secrets set TIKTOK_CLIENT_SECRET=...
  ```
- [ ] Set YouTube secrets:
  ```bash
  supabase secrets set YOUTUBE_CLIENT_ID=...
  supabase secrets set YOUTUBE_CLIENT_SECRET=...
  ```
- [ ] Set Instagram secrets:
  ```bash
  supabase secrets set INSTAGRAM_CLIENT_ID=...
  supabase secrets set INSTAGRAM_CLIENT_SECRET=...
  ```
- [ ] Set App URL:
  ```bash
  supabase secrets set APP_URL=https://your-domain.com
  ```
- [ ] Verify all secrets: `supabase secrets list`

## Deploy Edge Functions

- [ ] Deploy functions:
  ```bash
  # Option 1: Use script (recommended)
  .\scripts\deploy-oauth-functions.ps1  # Windows
  ./scripts/deploy-oauth-functions.sh   # Mac/Linux
  
  # Option 2: Manual deploy
  supabase functions deploy
  ```
- [ ] Verify deployment: `supabase functions list`
- [ ] Check for errors in logs:
  ```bash
  supabase functions logs tiktok-auth
  supabase functions logs youtube-auth
  supabase functions logs instagram-auth
  ```

## Update Environment Variables

- [ ] Clean up `.env` file - remove OAuth secrets
- [ ] Keep only these in `.env`:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```
- [ ] Update production environment variables (Vercel/Netlify/etc.):
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `NEXT_PUBLIC_APP_URL` (production domain)

## Update OAuth Provider Settings

### TikTok Developer Portal
- [ ] Login to TikTok Developer Portal
- [ ] Go to your app → OAuth Settings
- [ ] Update Redirect URI: `https://your-domain.com/api/tiktok/callback`
- [ ] For local dev: `http://localhost:3000/api/tiktok/callback`
- [ ] Save changes

### YouTube (Google Cloud Console)
- [ ] Login to Google Cloud Console
- [ ] Navigate to APIs & Services → Credentials
- [ ] Select your OAuth 2.0 Client ID
- [ ] Update Authorized redirect URIs: `https://your-domain.com/api/youtube/callback`
- [ ] For local dev: `http://localhost:3000/api/youtube/callback`
- [ ] Save changes

### Instagram (Meta for Developers)
- [ ] Login to Meta for Developers
- [ ] Go to your app → Instagram Basic Display
- [ ] Update Valid OAuth Redirect URIs: `https://your-domain.com/api/instagram/callback`
- [ ] For local dev: `http://localhost:3000/api/instagram/callback`
- [ ] Save changes

## Deploy Application

- [ ] Build Next.js app: `npm run build`
- [ ] Test build locally: `npm start`
- [ ] Deploy to hosting platform (Vercel/Netlify/etc.)
- [ ] Verify deployment successful
- [ ] Check application logs for errors

## Testing

### Local Testing (Development)
- [ ] Start dev server: `npm run dev`
- [ ] Navigate to dashboard
- [ ] Test TikTok connection:
  - [ ] Click "Connect TikTok"
  - [ ] Authorize on TikTok
  - [ ] Verify redirect back to dashboard
  - [ ] Check connection shows as connected
- [ ] Test YouTube connection:
  - [ ] Click "Connect YouTube"
  - [ ] Authorize on Google
  - [ ] Verify redirect back to dashboard
  - [ ] Check channel info displays correctly
- [ ] Test Instagram connection:
  - [ ] Click "Connect Instagram"
  - [ ] Authorize on Instagram
  - [ ] Verify redirect back to dashboard
  - [ ] Check profile displays correctly

### Production Testing
- [ ] Test TikTok OAuth flow on production URL
- [ ] Test YouTube OAuth flow on production URL
- [ ] Test Instagram OAuth flow on production URL
- [ ] Test disconnect functionality for each platform
- [ ] Verify no console errors
- [ ] Check Supabase function logs for issues

## Monitoring

- [ ] Set up monitoring for Edge Functions:
  ```bash
  supabase functions logs tiktok-auth --tail
  ```
- [ ] Check for errors in production
- [ ] Monitor usage and performance
- [ ] Set up alerts (optional)

## Post-Deployment

- [ ] Document any custom configurations
- [ ] Remove old OAuth credentials from any insecure locations
- [ ] Update team documentation
- [ ] Train team on new secret management process

## Verification

- [ ] ✅ All Edge Functions deployed successfully
- [ ] ✅ All secrets set and verified
- [ ] ✅ OAuth callbacks updated in provider settings
- [ ] ✅ Application deployed to production
- [ ] ✅ All three OAuth flows tested and working
- [ ] ✅ No credentials in `.env` or git repository
- [ ] ✅ Team informed of changes

## Rollback Plan (If Needed)

If something goes wrong:

1. **Check Logs First**:
   ```bash
   supabase functions logs tiktok-auth --tail
   supabase functions logs youtube-auth --tail
   supabase functions logs instagram-auth --tail
   ```

2. **Verify Secrets**:
   ```bash
   supabase secrets list
   ```

3. **Check OAuth Provider Settings**:
   - Verify callback URLs are correct
   - Ensure client IDs match

4. **Common Issues**:
   - Wrong APP_URL secret → Update: `supabase secrets set APP_URL=...`
   - CORS errors → Check APP_URL matches your domain
   - Token exchange errors → Verify client secrets are correct

## Success Criteria

✅ All OAuth flows working in production  
✅ No secrets in codebase or environment variables  
✅ Clean logs with no errors  
✅ Users can connect and disconnect platforms seamlessly  
✅ Team understands new architecture  

---

## Quick Reference

**View logs**: `supabase functions logs <name> --tail`  
**Update secret**: `supabase secrets set NAME=value`  
**Redeploy function**: `supabase functions deploy <name>`  
**List functions**: `supabase functions list`  
**List secrets**: `supabase secrets list`  

---

**Need help?** See `OAUTH_DEPLOYMENT.md` for detailed troubleshooting.

**Status**: □ Not Started | ▢ In Progress | ✅ Complete
