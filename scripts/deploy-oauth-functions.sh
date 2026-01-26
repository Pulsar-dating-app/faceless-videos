#!/bin/bash

# Bash script to deploy OAuth Edge Functions to Supabase
# Usage: ./scripts/deploy-oauth-functions.sh

echo "🚀 OAuth Edge Functions Deployment Script"
echo "=========================================="
echo ""

# Check if Supabase CLI is installed
echo "✓ Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI is not installed"
    echo "Install it with: npm install -g supabase"
    exit 1
fi
SUPABASE_VERSION=$(supabase --version)
echo "✓ Supabase CLI installed: $SUPABASE_VERSION"
echo ""

# Check if project is linked
echo "✓ Checking project link..."
if ! supabase status &> /dev/null; then
    echo "⚠️  Project not linked"
    echo "Run: supabase link --project-ref YOUR_PROJECT_REF"
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✓ Project is linked"
fi
echo ""

# Ask user to confirm secrets are set
echo "⚠️  IMPORTANT: Ensure you have set all required secrets"
echo ""
echo "Required secrets:"
echo "  - TIKTOK_CLIENT_KEY"
echo "  - TIKTOK_CLIENT_SECRET"
echo "  - YOUTUBE_CLIENT_ID"
echo "  - YOUTUBE_CLIENT_SECRET"
echo "  - INSTAGRAM_CLIENT_ID"
echo "  - INSTAGRAM_CLIENT_SECRET"
echo "  - APP_URL"
echo ""
echo "Set secrets with: supabase secrets set SECRET_NAME=value"
echo ""

read -p "Have you set all the required secrets? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted. Please set secrets first."
    exit 1
fi
echo ""

# Deploy functions
echo "📦 Deploying Edge Functions..."
echo ""

# Deploy TikTok Auth
echo "→ Deploying tiktok-auth..."
if ! supabase functions deploy tiktok-auth; then
    echo "❌ Failed to deploy tiktok-auth"
    exit 1
fi
echo "✓ tiktok-auth deployed successfully"
echo ""

# Deploy YouTube Auth
echo "→ Deploying youtube-auth..."
if ! supabase functions deploy youtube-auth; then
    echo "❌ Failed to deploy youtube-auth"
    exit 1
fi
echo "✓ youtube-auth deployed successfully"
echo ""

# Deploy Instagram Auth
echo "→ Deploying instagram-auth..."
if ! supabase functions deploy instagram-auth; then
    echo "❌ Failed to deploy instagram-auth"
    exit 1
fi
echo "✓ instagram-auth deployed successfully"
echo ""

# Deploy Post to Social
echo "→ Deploying post-to-social..."
if ! supabase functions deploy post-to-social; then
    echo "❌ Failed to deploy post-to-social"
    exit 1
fi
echo "✓ post-to-social deployed successfully"
echo ""

# List deployed functions
echo "📋 Deployed functions:"
supabase functions list
echo ""

# Success message
echo "✅ All OAuth Edge Functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Update OAuth callback URLs in your provider settings"
echo "2. Test the OAuth flow in your application"
echo "3. Monitor logs with: supabase functions logs <function-name> --tail"
echo ""
echo "🔒 Your OAuth credentials are now secure in Supabase!"
