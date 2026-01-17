#!/bin/bash

# LifeDB Deploy Script
# Usage: ./scripts/deploy.sh [--cloud]

set -e

cd "$(dirname "$0")/.."

echo "🚀 LifeDB Deploy to TestFlight"
echo "================================"

# Check for --cloud flag
if [[ "$1" == "--cloud" ]]; then
    echo "☁️  Building on EAS servers and submitting to TestFlight..."
    npx eas-cli build --platform ios --profile production --auto-submit --non-interactive
else
    echo "📦 Building locally and submitting to TestFlight..."
    npx eas-cli build --platform ios --profile production --local --auto-submit --non-interactive
fi

echo ""
echo "✅ Build submitted! Check your TestFlight app for the new build."
