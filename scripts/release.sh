#!/bin/bash

# Release script for taglib-wasm
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh 2.2.5

set -e

# Check if version is provided
if [ -z "$1" ]; then
  echo "Error: Version number required"
  echo "Usage: $0 <version>"
  echo "Example: $0 2.2.5"
  exit 1
fi

VERSION=$1
TAG="v$VERSION"

echo "🚀 Preparing release $TAG"

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: Must be on main branch to release (currently on $CURRENT_BRANCH)"
  exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: Uncommitted changes detected. Please commit or stash them first."
  exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Update version in package.json and deno.json
echo "📝 Updating version to $VERSION..."
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" deno.json
rm package.json.bak deno.json.bak

# Run tests
echo "🧪 Running tests..."
deno task test || (echo "❌ Tests failed!" && exit 1)

# Commit version bump
echo "💾 Committing version bump..."
git add package.json deno.json
git commit -m "chore: bump version to $VERSION"

# Create and push tag
echo "🏷️  Creating tag $TAG..."
git tag -a $TAG -m "Release $TAG"

# Push changes and tag
echo "📤 Pushing to GitHub..."
git push origin main
git push origin $TAG

# Create GitHub release
echo "🎉 Creating GitHub release..."
if command -v gh &> /dev/null; then
  gh release create $TAG \
    --title "Release $TAG" \
    --notes "## What's Changed

- Version bump to $VERSION

**Full Changelog**: https://github.com/CharlesWiltgen/taglib-wasm/compare/v$PREV_VERSION...$TAG" \
    --latest
  
  echo "✅ Release $TAG created successfully!"
  echo "🚀 GitHub Actions will now automatically publish to:"
  echo "   - NPM (taglib-wasm)"
  echo "   - JSR (@charleswiltgen/taglib-wasm)"
  echo "   - GitHub Packages (@charleswiltgen/taglib-wasm)"
  echo ""
  echo "📊 Monitor progress at: https://github.com/CharlesWiltgen/taglib-wasm/actions"
else
  echo "⚠️  GitHub CLI (gh) not found. Please install it or create the release manually at:"
  echo "   https://github.com/CharlesWiltgen/taglib-wasm/releases/new?tag=$TAG"
fi