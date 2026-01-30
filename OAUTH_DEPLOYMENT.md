# OAuth Edge Functions Deployment Guide

This guide explains how to deploy and configure the OAuth Edge Functions for secure credential management.

## Overview

All OAuth credentials (Client IDs, Client Secrets) are now stored securely in Supabase Edge Functions instead of your Next.js application. This provides better security by:

- ✅ Keeping secrets completely isolated from frontend code
- ✅ No risk of accidentally exposing credentials in git
- ✅ Centralized secret management via Supabase Dashboard
- ✅ Easy rotation and updates without redeploying your app

## Prerequisites

1. **Supabase CLI**: Install the Supabase CLI
   ```bash
   npm install -g supabase
   ```

2. **Supabase Project**: You need an active Supabase project
   - Your project URL: `NEXT_PUBLIC_SUPABASE_URL`
   - Your anon key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **OAuth Credentials**: You need the following credentials ready:
   - TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`
   - YouTube: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
   - Instagram: `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`

## Deployment Steps

### 1. Login to Supabase

```bash
supabase login
```

### 2. Link Your Project

```bash
supabase link --project-ref tzkasbfuhnhfhyvhcjnf
```

To find your project ref:
- Go to your Supabase Dashboard
- Project Settings → General → Reference 

### 3. Set Edge Function Secrets

Set the required secrets for each OAuth provider:

```bash
# TikTok
supabase secrets set TIKTOK_CLIENT_KEY=your-tiktok-client-key
supabase secrets set TIKTOK_CLIENT_SECRET=your-tiktok-client-secret

# YouTube
supabase secrets set YOUTUBE_CLIENT_ID=your-youtube-client-id
supabase secrets set YOUTUBE_CLIENT_SECRET=your-youtube-client-secret

# Instagram
supabase secrets set INSTAGRAM_CLIENT_ID=your-instagram-client-id
supabase secrets set INSTAGRAM_CLIENT_SECRET=your-instagram-client-secret

# Application URL (important for OAuth callbacks)
supabase secrets set APP_URL=https://your-production-domain.com
```

**Note**: For local development, use `http://localhost:3000` as the `APP_URL`.

### 4. Deploy Edge Functions

Deploy all OAuth Edge Functions:

```bash
# Deploy TikTok OAuth function
supabase functions deploy tiktok-auth

# Deploy YouTube OAuth function
supabase functions deploy youtube-auth

# Deploy Instagram OAuth function
supabase functions deploy instagram-auth

# Deploy Social Media Posting function
supabase functions deploy post-to-social
```

Or deploy all at once:

```bash
supabase functions deploy
```

### 5. Verify Deployment

Check that your functions are deployed:

```bash
supabase functions list
```

You should see:
- `tiktok-auth`
- `youtube-auth`
- `instagram-auth`
- `post-to-social`

## Environment Variables

### Local Development (.env)

Keep these in your `.env` file for local development:

```env
# Supabase Configuration (public - safe to commit to git if needed)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**IMPORTANT**: You NO LONGER need OAuth credentials in your `.env` file. They're now stored securely in Supabase.

### Production (Vercel/Netlify/etc.)

Set these environment variables in your hosting platform:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

## OAuth Callback URLs

Update your OAuth provider settings with the correct callback URLs:

### TikTok
- **Redirect URI**: `https://your-domain.com/api/tiktok/callback`
- **Settings**: TikTok Developer Portal → Your App → OAuth Settings

### YouTube (Google Cloud Console)
- **Authorized redirect URIs**: `https://your-domain.com/api/youtube/callback`
- **Settings**: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs

### Instagram (Meta Developers)
- **Valid OAuth Redirect URIs**: `https://your-domain.com/api/instagram/callback`
- **Settings**: Meta for Developers → Your App → Instagram Basic Display → OAuth Redirect URIs

## Testing

### Test Locally

1. Start Supabase locally (optional):
   ```bash
   supabase start
   ```

2. Start your Next.js app:
   ```bash
   npm run dev
   ```

3. Navigate to your dashboard and try connecting each social media platform.

### Test in Production

After deploying:

1. Ensure all Edge Functions are deployed
2. Verify all secrets are set correctly
3. Test the OAuth flow for each platform
4. Check Supabase logs for any errors:
   ```bash
   supabase functions logs tiktok-auth
   supabase functions logs youtube-auth
   supabase functions logs instagram-auth
   ```

## Troubleshooting

### Error: "Failed to generate auth URL"

**Solution**: Check that your secrets are set correctly:
```bash
supabase secrets list
```

### Error: "Invalid response from auth service"

**Solution**: Verify the Edge Function is deployed and running:
```bash
supabase functions list
```

Check the function logs:
```bash
supabase functions logs <function-name> --tail
```

### OAuth Callback Errors

**Solution**: Ensure your callback URLs in the OAuth provider settings match exactly:
- For production: `https://your-domain.com/api/{platform}/callback`
- For development: `http://localhost:3000/api/{platform}/callback`

### CORS Issues

The Edge Functions are configured to accept all origins (`'*'`). If you need to restrict this:

Edit the `corsHeaders` in each function:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-domain.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

## Updating Secrets

To update a secret without redeploying:

```bash
supabase secrets set SECRET_NAME=new-value
```

Secrets are updated immediately without requiring a function redeploy.

## Security Best Practices

1. ✅ **Never commit secrets to git** - All secrets are in Supabase
2. ✅ **Rotate credentials regularly** - Update secrets via Supabase CLI
3. ✅ **Use HTTPS in production** - Required for OAuth callbacks
4. ✅ **Monitor function logs** - Check for suspicious activity
5. ✅ **Restrict CORS if needed** - Update `corsHeaders` for production

## Architecture

```
User Browser
    ↓
Next.js API Routes (/app/api/{platform}/auth)
    ↓
Supabase Edge Functions (tiktok-auth, youtube-auth, instagram-auth)
    ↓ (contains secrets)
OAuth Provider (TikTok, YouTube, Instagram)
    ↓
Callback
    ↓
Supabase Edge Function (handles token exchange)
    ↓
Next.js API Route (receives user data)
    ↓
Dashboard (stores in localStorage)
```

## Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Managing Secrets in Edge Functions](https://supabase.com/docs/guides/functions/secrets)

## Support

If you encounter issues:

1. Check Supabase function logs: `supabase functions logs <function-name> --tail`
2. Verify secrets are set: `supabase secrets list`
3. Check OAuth provider settings (callback URLs, scopes)
4. Review Next.js console for errors

---

**Remember**: Your OAuth credentials are now secure in Supabase Edge Functions and never exposed to the client or git repository! 🔒
