# Video Cleanup Setup

This system automatically deletes old videos from Supabase Storage to manage storage costs.

## How It Works

1. **Cleanup API Route** (`/api/cleanup-videos`) - Deletes videos older than a specified number of days
2. **Vercel Cron Job** - Runs the cleanup daily at 2 AM UTC (configured in `vercel.json`)
3. **Configurable Retention** - Set how many days to keep videos via environment variable

## Setup Instructions

### 1. Environment Variables

Add these to your Vercel project settings:

```bash
# Optional: Secret token to protect the cleanup endpoint
CLEANUP_SECRET_TOKEN=your-secret-token-here

# Optional: How many days to keep videos (default: 7 days)
VIDEO_RETENTION_DAYS=7
```

**Note:** If you don't set `CLEANUP_SECRET_TOKEN`, the endpoint will still work but won't be protected. It's recommended to set it.

### 2. Vercel Cron Configuration

The cron job is already configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cleanup-videos",
      "schedule": "0 2 * * *"  // Daily at 2 AM UTC
    }
  ]
}
```

**Schedule Format:** Cron expression (minute hour day month weekday)
- `0 2 * * *` = Every day at 2:00 AM UTC
- `0 0 * * 0` = Every Sunday at midnight UTC
- `0 */6 * * *` = Every 6 hours

### 3. Manual Cleanup (Testing)

You can manually trigger cleanup by calling the API:

```bash
# Without auth token (if CLEANUP_SECRET_TOKEN is not set)
curl https://your-domain.com/api/cleanup-videos

# With auth token
curl -H "Authorization: Bearer your-secret-token-here" \
     https://your-domain.com/api/cleanup-videos
```

## Response Format

The cleanup endpoint returns:

```json
{
  "message": "Cleanup completed",
  "total": 50,
  "deleted": 12,
  "kept": 38,
  "errors": 0,
  "storageFreed": "125.50 MB",
  "retentionDays": 7
}
```

## Storage Costs

- **Supabase Free Tier:** 1GB storage, 2GB bandwidth/month
- **Typical Video Size:** 5-15MB per video
- **With 7-day retention:** ~70-200 videos can be stored before hitting free tier
- **After cleanup:** Old videos are automatically deleted, freeing up space

## Customization

### Change Retention Period

Set `VIDEO_RETENTION_DAYS` environment variable:
- `VIDEO_RETENTION_DAYS=3` - Keep videos for 3 days
- `VIDEO_RETENTION_DAYS=30` - Keep videos for 30 days
- `VIDEO_RETENTION_DAYS=0` - Delete immediately (not recommended)

### Change Cron Schedule

Edit `vercel.json` to change when cleanup runs:
- `0 0 * * *` - Daily at midnight UTC
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday

## Troubleshooting

### Cron Job Not Running

1. Check Vercel Dashboard → Settings → Cron Jobs
2. Ensure `vercel.json` is committed and deployed
3. Check Vercel logs for errors

### Videos Not Being Deleted

1. Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly
2. Verify the storage bucket name matches (`generated-videos`)
3. Check API logs for errors

### Authorization Errors

If you set `CLEANUP_SECRET_TOKEN`, make sure:
- The token matches in your environment variables
- You're passing it in the Authorization header: `Bearer your-token`
