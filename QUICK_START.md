# Quick Start: OAuth Edge Functions

## 🚀 Quick Deployment (5 minutes)

### 1. Install Supabase CLI
```bash
npm install -g supabase
```

### 2. Login and Link Project
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Set Secrets
```bash
# TikTok
supabase secrets set TIKTOK_CLIENT_KEY=your-key
supabase secrets set TIKTOK_CLIENT_SECRET=your-secret

# YouTube
supabase secrets set YOUTUBE_CLIENT_ID=your-id
supabase secrets set YOUTUBE_CLIENT_SECRET=your-secret

# Instagram
supabase secrets set INSTAGRAM_CLIENT_ID=your-id
supabase secrets set INSTAGRAM_CLIENT_SECRET=your-secret

# App URL
supabase secrets set APP_URL=https://your-domain.com
```

### 4. Deploy Functions
```bash
# Windows PowerShell
.\scripts\deploy-oauth-functions.ps1

# Mac/Linux
chmod +x scripts/deploy-oauth-functions.sh
./scripts/deploy-oauth-functions.sh

# Or manually
supabase functions deploy
```

### 5. Update Your .env
Remove OAuth secrets from `.env`, keep only:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. Restart Your App
```bash
npm run dev
```

## ✅ Done!

Your OAuth credentials are now secure in Supabase Edge Functions!

## 📝 What Changed?

### Before (Insecure)
```
.env file → Contains secrets → Risk of exposure
```

### After (Secure)
```
Supabase Edge Functions → Contains secrets → Encrypted & isolated
Next.js API Routes → Proxy only → No secrets exposed
```

## 🔍 Verify It Works

1. Go to your dashboard
2. Try connecting TikTok, YouTube, or Instagram
3. Should work exactly the same as before, but more secure!

## 📚 Need More Help?

See the full guide: [OAUTH_DEPLOYMENT.md](./OAUTH_DEPLOYMENT.md)

## 🐛 Troubleshooting

**Problem**: Functions not working?

**Solution**: Check logs
```bash
supabase functions logs tiktok-auth --tail
supabase functions logs youtube-auth --tail
supabase functions logs instagram-auth --tail
```

**Problem**: Secrets not found?

**Solution**: Verify secrets
```bash
supabase secrets list
```

**Problem**: CORS errors?

**Solution**: Check your `APP_URL` secret matches your domain
```bash
supabase secrets set APP_URL=https://your-actual-domain.com
```
