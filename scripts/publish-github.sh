#!/bin/bash
set -e

echo "📦 Publishing to GitHub Packages..."

# Backup original package.json
cp package.json package.json.backup

# Use GitHub-specific package.json
cp .github-package.json package.json

# Publish to GitHub Packages
npm publish

# Restore original package.json
mv package.json.backup package.json

echo "✅ Published to GitHub Packages successfully!"