#!/bin/bash
# Bump version number in index.html for all assets to bust browser cache
# Usage: ./scripts/bump-version.sh

# Get current version
CURRENT=$(grep -o 'v=[0-9.]*' index.html | head -1 | cut -d= -f2)
echo "Current version: $CURRENT"

# Use timestamp as new version (YYYYMMDD.HHMM)
NEW_VERSION=$(date +"%Y%m%d.%H%M")

echo "New version: $NEW_VERSION"

# Replace all version parameters in index.html
sed -i '' "s/v=[0-9.]*/v=$NEW_VERSION/g" index.html

echo "✅ Updated all script and style tags to v=$NEW_VERSION"
echo ""
echo "Now commit and push:"
echo "  git add index.html && git commit -m 'Bump cache version to $NEW_VERSION' && git push"
