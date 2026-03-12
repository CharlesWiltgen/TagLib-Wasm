#!/bin/bash

# Release script for TagLib-Wasm
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

# Update version in all files
echo "📝 Updating version to $VERSION..."
deno run --allow-read --allow-write scripts/sync-version.ts set "$VERSION"

# Run tests
echo "🧪 Running tests..."
deno task test || (echo "❌ Tests failed!" && exit 1)

# Build to get fresh artifacts for staleness comparison
echo "🔨 Building..."
deno task build || (echo "❌ Build failed!" && exit 1)

# Verify WASM binaries are fresh
echo "🔍 Verifying WASM binaries..."
if ! git diff --quiet -- build/taglib-web.wasm; then
  echo "❌ build/taglib-web.wasm is stale! The build produced a different binary."
  echo "   Run: git add build/taglib-web.wasm && git commit --amend --no-edit"
  exit 1
fi
if [ ! -f build/taglib_wasi.wasm ]; then
  echo "❌ build/taglib_wasi.wasm is missing! Run: bash build/build-wasi.sh"
  exit 1
fi
if [ -f dist/wasi/taglib_wasi.wasm ] && ! cmp -s build/taglib_wasi.wasm dist/wasi/taglib_wasi.wasm; then
  echo "❌ build/taglib_wasi.wasm doesn't match dist/wasi/taglib_wasi.wasm!"
  echo "   Run: cp dist/wasi/taglib_wasi.wasm build/ && git add build/taglib_wasi.wasm"
  exit 1
fi
echo "✅ WASM binaries verified"

# Commit version bump
echo "💾 Committing version bump..."
git add package.json deno.json sonar-project.properties src/version.ts
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

**Full Changelog**: https://github.com/CharlesWiltgen/TagLib-Wasm/compare/v$PREV_VERSION...$TAG" \
    --latest
  
  echo "✅ Release $TAG created successfully!"
  echo "🚀 GitHub Actions will now automatically publish to:"
  echo "   - NPM (taglib-wasm)"
  echo "   - JSR (@charleswiltgen/taglib-wasm)"
  echo "   - GitHub Packages (@charleswiltgen/taglib-wasm)"
  echo ""
  echo "📊 Monitor progress at: https://github.com/CharlesWiltgen/TagLib-Wasm/actions"
else
  echo "⚠️  GitHub CLI (gh) not found. Please install it or create the release manually at:"
  echo "   https://github.com/CharlesWiltgen/TagLib-Wasm/releases/new?tag=$TAG"
fi