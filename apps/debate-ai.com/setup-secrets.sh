#!/bin/bash
# Setup Cloudflare Workers secrets for debate-ai
# Run this after creating your environment variables

echo "Setting up Cloudflare Workers secrets..."
echo ""
echo "You'll need to provide values for the following secrets:"
echo "  - BETTER_AUTH_SECRET (generate with: openssl rand -base64 32)"
echo "  - GOOGLE_CLIENT_ID (from Google Cloud Console)"
echo "  - GOOGLE_CLIENT_SECRET (from Google Cloud Console)"
echo "  - AUTH_DISCORD_ID (optional - from Discord Developer Portal)"
echo "  - AUTH_DISCORD_SECRET (optional)"
echo "  - AUTH_LINKEDIN_ID (optional - from LinkedIn Developers)"
echo "  - AUTH_LINKEDIN_SECRET (optional)"
echo "  - RESEND_API_KEY (optional - from resend.com for email)"
echo "  - NEXT_PUBLIC_BASE_URL (your production URL, e.g., https://debate-ai.com)"
echo ""
echo "To set a secret, run:"
echo "  npx wrangler secret put SECRET_NAME"
echo ""
echo "Example:"
echo "  npx wrangler secret put BETTER_AUTH_SECRET"
echo ""
