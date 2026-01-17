#!/bin/bash

# LifeDB Deploy Script
# Usage: ./scripts/deploy.sh [--local]

set -e

cd "$(dirname "$0")/.."

echo "🚀 LifeDB Deploy to TestFlight"
echo "================================"

# Check for --local flag
if [[ "$1" == "--local" ]]; then
    echo "📦 Building locally and submitting to TestFlight..."
    npx eas-cli build --platform ios --profile production --local --auto-submit --non-interactive
else
    echo "☁️  Building on EAS servers and submitting to TestFlight..."
    npx eas-cli build --platform ios --profile production --auto-submit --non-interactive
fi

echo ""
echo "✅ Build submitted! Check your TestFlight app for the new build."
