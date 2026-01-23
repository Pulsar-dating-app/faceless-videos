# PowerShell script to deploy OAuth Edge Functions to Supabase
# Usage: .\scripts\deploy-oauth-functions.ps1

Write-Host "🚀 OAuth Edge Functions Deployment Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
Write-Host "✓ Checking Supabase CLI..." -ForegroundColor Yellow
$supabaseVersion = supabase --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Supabase CLI is not installed" -ForegroundColor Red
    Write-Host "Install it with: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Supabase CLI installed: $supabaseVersion" -ForegroundColor Green
Write-Host ""

# Check if project is linked
Write-Host "✓ Checking project link..." -ForegroundColor Yellow
$linkCheck = supabase status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Project not linked" -ForegroundColor Yellow
    Write-Host "Run: supabase link --project-ref YOUR_PROJECT_REF" -ForegroundColor Cyan
    $continue = Read-Host "Do you want to continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
} else {
    Write-Host "✓ Project is linked" -ForegroundColor Green
}
Write-Host ""

# Ask user to confirm secrets are set
Write-Host "⚠️  IMPORTANT: Ensure you have set all required secrets" -ForegroundColor Yellow
Write-Host ""
Write-Host "Required secrets:" -ForegroundColor Cyan
Write-Host "  - TIKTOK_CLIENT_KEY" -ForegroundColor White
Write-Host "  - TIKTOK_CLIENT_SECRET" -ForegroundColor White
Write-Host "  - YOUTUBE_CLIENT_ID" -ForegroundColor White
Write-Host "  - YOUTUBE_CLIENT_SECRET" -ForegroundColor White
Write-Host "  - INSTAGRAM_CLIENT_ID" -ForegroundColor White
Write-Host "  - INSTAGRAM_CLIENT_SECRET" -ForegroundColor White
Write-Host "  - APP_URL" -ForegroundColor White
Write-Host ""
Write-Host "Set secrets with: supabase secrets set SECRET_NAME=value" -ForegroundColor Cyan
Write-Host ""

$secretsConfirm = Read-Host "Have you set all the required secrets? (y/n)"
if ($secretsConfirm -ne "y") {
    Write-Host "❌ Aborted. Please set secrets first." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Deploy functions
Write-Host "📦 Deploying Edge Functions..." -ForegroundColor Cyan
Write-Host ""

# Deploy TikTok Auth
Write-Host "→ Deploying tiktok-auth..." -ForegroundColor Yellow
supabase functions deploy tiktok-auth
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy tiktok-auth" -ForegroundColor Red
    exit 1
}
Write-Host "✓ tiktok-auth deployed successfully" -ForegroundColor Green
Write-Host ""

# Deploy YouTube Auth
Write-Host "→ Deploying youtube-auth..." -ForegroundColor Yellow
supabase functions deploy youtube-auth
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy youtube-auth" -ForegroundColor Red
    exit 1
}
Write-Host "✓ youtube-auth deployed successfully" -ForegroundColor Green
Write-Host ""

# Deploy Instagram Auth
Write-Host "→ Deploying instagram-auth..." -ForegroundColor Yellow
supabase functions deploy instagram-auth
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy instagram-auth" -ForegroundColor Red
    exit 1
}
Write-Host "✓ instagram-auth deployed successfully" -ForegroundColor Green
Write-Host ""

# List deployed functions
Write-Host "📋 Deployed functions:" -ForegroundColor Cyan
supabase functions list
Write-Host ""

# Success message
Write-Host "✅ All OAuth Edge Functions deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Update OAuth callback URLs in your provider settings" -ForegroundColor White
Write-Host "2. Test the OAuth flow in your application" -ForegroundColor White
Write-Host "3. Monitor logs with: supabase functions logs <function-name> --tail" -ForegroundColor White
Write-Host ""
Write-Host "🔒 Your OAuth credentials are now secure in Supabase!" -ForegroundColor Green
