#!/bin/bash

# Setup script to install git hooks

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔧 Setting up git hooks..."

# Get the git directory
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Set the hooks path
git config core.hooksPath .githooks

echo -e "${GREEN}✅ Git hooks installed!${NC}"
echo ""
echo "The following hooks are now active:"
echo "  • pre-commit: Checks version sync between deno.json and package.json"
echo ""
echo -e "${YELLOW}Note:${NC} You can bypass hooks with: git commit --no-verify"
echo ""
echo "To uninstall hooks, run:"
echo "  git config --unset core.hooksPath"