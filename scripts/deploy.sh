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
    echo "📦 Building locally..."
    npx eas-cli build --platform ios --profile production --local --non-interactive
    
    echo ""
    echo "📤 Submitting to TestFlight..."
    # Find the most recent .ipa file
    IPA_FILE=$(ls -t *.ipa 2>/dev/null | head -1)
    
    if [[ -n "$IPA_FILE" ]]; then
        npx eas-cli submit --platform ios --path "$IPA_FILE" --non-interactive
    else
        echo "❌ No .ipa file found. Build may have failed."
        exit 1
    fi
fi

echo ""
echo "✅ Build submitted! Check your TestFlight app for the new build."
