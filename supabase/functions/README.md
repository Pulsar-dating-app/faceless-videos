# Supabase Edge Functions

This directory contains Supabase Edge Functions for the faceless-videos project.

## OAuth Functions

### Security Architecture

All OAuth credentials are stored securely in Supabase Secrets, never in your codebase or environment variables. This provides:

- ✅ Complete isolation from frontend code
- ✅ No risk of credential exposure in git
- ✅ Centralized secret management
- ✅ Easy credential rotation

### Available Functions

#### `tiktok-auth`
Handles TikTok OAuth flow with PKCE (Proof Key for Code Exchange).

**Actions**:
- `auth` - Generate TikTok OAuth URL with PKCE challenge
- `callback` - Exchange authorization code for access token
- `disconnect` - Disconnect TikTok account

**Required Secrets**:
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `APP_URL`

#### `youtube-auth`
Handles YouTube OAuth flow with offline access for refresh tokens.

**Actions**:
- `auth` - Generate YouTube OAuth URL
- `callback` - Exchange code for access token and fetch channel info
- `disconnect` - Disconnect YouTube account

**Required Secrets**:
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `APP_URL`

#### `instagram-auth`
Handles Instagram Business OAuth flow with long-lived token exchange.

**Actions**:
- `auth` - Generate Instagram OAuth URL
- `callback` - Exchange code for token, upgrade to long-lived token, fetch user info
- `disconnect` - Disconnect Instagram account

**Required Secrets**:
- `INSTAGRAM_CLIENT_ID`
- `INSTAGRAM_CLIENT_SECRET`
- `APP_URL`

## Usage

### From Next.js API Routes

All Next.js API routes now proxy to these Edge Functions:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Call the Edge Function
const { data, error } = await supabase.functions.invoke('tiktok-auth', {
  body: { action: 'auth', userId: 'user123' },
});
```

### Function Response Format

All functions return a consistent response format:

```typescript
// Success
{
  success: true,
  data: { /* platform-specific data */ }
}

// Auth action success
{
  authUrl: "https://...",
  code_verifier: "..." // Only for TikTok (PKCE)
}

// Error
{
  error: "Error message",
  details: "Detailed error info"
}
```

## Deployment

### Quick Deploy

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy tiktok-auth
```

### Set Secrets

```bash
supabase secrets set TIKTOK_CLIENT_KEY=value
supabase secrets set TIKTOK_CLIENT_SECRET=value
# ... etc
```

### View Logs

```bash
# Tail logs
supabase functions logs tiktok-auth --tail

# View specific number of lines
supabase functions logs youtube-auth --limit 100
```

## Development

### Local Testing

1. Start Supabase locally:
   ```bash
   supabase start
   ```

2. Serve functions locally:
   ```bash
   supabase functions serve
   ```

3. Set local secrets in `.env.local`:
   ```
   TIKTOK_CLIENT_KEY=...
   TIKTOK_CLIENT_SECRET=...
   ```

### Function Structure

Each OAuth function follows this pattern:

```typescript
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    
    // Route based on action
    if (action === 'auth') { /* ... */ }
    if (action === 'callback') { /* ... */ }
    if (action === 'disconnect') { /* ... */ }
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## Other Functions

### `generate-ai-video`
Generates AI-powered videos.

### `generate-script`
Generates video scripts using AI.

### `generate-video`
Handles video generation and merging.

## Security Notes

1. **Never commit secrets** - All sensitive data is in Supabase Secrets
2. **CORS is open by default** - Restrict in production if needed
3. **Rate limiting** - Consider adding rate limiting for production
4. **Error handling** - All functions have comprehensive error handling
5. **Logging** - Use `console.log()` for debugging (visible in Supabase logs)

## Testing

Test functions using curl:

```bash
# Test auth action
curl -X POST https://your-project.supabase.co/functions/v1/tiktok-auth \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "auth", "userId": "test-user"}'
```

## Documentation

For full deployment guide, see: [OAUTH_DEPLOYMENT.md](../OAUTH_DEPLOYMENT.md)

For quick start, see: [QUICK_START.md](../QUICK_START.md)
