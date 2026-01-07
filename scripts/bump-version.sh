#!/bin/bash
# Bump version number in index.html script tags to bust browser cache
# Usage: ./scripts/bump-version.sh

# Get current version
CURRENT=$(grep -o 'v=[0-9.]*' index.html | head -1 | cut -d= -f2)
echo "Current version: $CURRENT"

# Calculate new version (increment last digit)
MAJOR=$(echo $CURRENT | cut -d. -f1)
MINOR=$(echo $CURRENT | cut -d. -f2)
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="$MAJOR.$NEW_MINOR"

echo "New version: $NEW_VERSION"

# Replace in index.html
sed -i '' "s/v=[0-9.]*/v=$NEW_VERSION/g" index.html

echo "Updated all script tags to v=$NEW_VERSION"
echo ""
echo "Now commit and push:"
echo "  git add index.html && git commit -m 'Bump cache version to $NEW_VERSION' && git push"
