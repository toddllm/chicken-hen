#!/bin/bash

# Script to update version number for cache busting

VERSION=${1:-$(date +%s)}
echo "🔄 Updating version to: $VERSION"

# Update index.html with new version
sed -i '' "s/game\.js?v=[0-9\.]\+/game.js?v=$VERSION/g" ./client/index.html

echo "✅ Version updated in index.html"
echo "📝 Don't forget to redeploy after updating the version!"