#!/bin/bash
set -euo pipefail

# Safe Release Script for TagLib-Wasm
# This script ensures all tests pass and versions are synchronized before creating a release
#
# Usage:
#   deno task release          # Auto-increment patch version (0.0.1)
#   deno task release 2.3.4    # Set specific version

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to check if we're on main branch
check_main_branch() {
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$current_branch" != "main" ]]; then
        print_error "Not on main branch. Current branch: $current_branch"
        print_warning "Releases should be created from the main branch."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Function to check for uncommitted changes
check_clean_working_tree() {
    if ! git diff-index --quiet HEAD --; then
        print_error "Working tree is not clean. Please commit or stash your changes."
        git status --short
        exit 1
    fi
}

# Function to check if local is up to date with remote
check_up_to_date() {
    print_step "Fetching latest changes from remote..."
    git fetch origin main

    local LOCAL=$(git rev-parse HEAD)
    local REMOTE=$(git rev-parse origin/main)

    if [[ "$LOCAL" != "$REMOTE" ]]; then
        print_error "Local branch is not up to date with origin/main"
        print_warning "Run 'git pull origin main' to update"
        exit 1
    fi
}

# Function to run comprehensive tests
run_tests() {
    print_step "Running comprehensive test suite..."

    # Run format check
    print_step "Checking code formatting..."
    if ! deno fmt --check > /dev/null 2>&1; then
        print_error "Code formatting check failed"
        print_warning "Run 'deno task fmt' to fix formatting"
        exit 1
    fi
    print_success "Code formatting check passed"

    # Run lint
    print_step "Running linter..."
    if ! deno lint > /dev/null 2>&1; then
        print_error "Linting failed"
        print_warning "Fix linting errors before releasing"
        exit 1
    fi
    print_success "Linting passed"

    # Run type check
    print_step "Running type check..."
    if ! deno check ./src ./tests > /dev/null 2>&1; then
        print_error "Type checking failed"
        exit 1
    fi
    print_success "Type checking passed"

    # Run tests
    print_step "Running test suite..."
    if ! deno task test; then
        print_error "Tests failed"
        exit 1
    fi
    print_success "All tests passed"

    # Check if build works
    print_step "Verifying build process..."
    if ! deno task build > /dev/null 2>&1; then
        print_error "Build failed"
        exit 1
    fi
    print_success "Build successful"
}

# Function to verify WASM binaries are fresh
verify_wasm_freshness() {
    print_step "Verifying WASM binaries are up to date..."

    # After build, Emscripten wasm in build/ should match what's committed
    if ! git diff --quiet -- build/taglib-web.wasm; then
        print_error "build/taglib-web.wasm is stale!"
        print_warning "The Emscripten build produced a different binary than what's committed."
        print_warning "Stage the updated file and re-run the release:"
        print_warning "  git add build/taglib-web.wasm && git commit --amend --no-edit"
        exit 1
    fi
    print_success "build/taglib-web.wasm matches fresh build"

    # Check WASI binary: compare against dist output if available
    if [ -f dist/wasi/taglib_wasi.wasm ]; then
        if ! cmp -s build/taglib_wasi.wasm dist/wasi/taglib_wasi.wasm; then
            print_error "build/taglib_wasi.wasm doesn't match dist/wasi/taglib_wasi.wasm!"
            print_warning "The WASI build output differs from the committed copy."
            print_warning "  cp dist/wasi/taglib_wasi.wasm build/ && git add build/taglib_wasi.wasm"
            exit 1
        fi
        print_success "build/taglib_wasi.wasm matches WASI build output"
    else
        # No dist to compare — verify the file exists with reasonable size
        if [ ! -f build/taglib_wasi.wasm ]; then
            print_error "build/taglib_wasi.wasm is missing!"
            print_warning "Run: bash build/build-wasi.sh"
            exit 1
        fi
        local size
        size=$(stat -f%z build/taglib_wasi.wasm 2>/dev/null || stat -c%s build/taglib_wasi.wasm)
        if [ "$size" -lt 100000 ]; then
            print_error "build/taglib_wasi.wasm is suspiciously small (${size} bytes)"
            exit 1
        fi
        print_warning "No dist/wasi/ to compare — build/taglib_wasi.wasm exists (${size} bytes)"
    fi
}

# Function to run package publishing preflight checks
run_preflight_checks() {
    print_step "Running package publishing preflight checks..."

    # JSR publish dry-run (catches module exclusion issues)
    print_step "Checking JSR publish compatibility..."
    if ! deno publish --dry-run --allow-dirty > /dev/null 2>&1; then
        print_error "JSR publish dry-run failed"
        print_warning "Run 'deno publish --dry-run' to see details"
        exit 1
    fi
    print_success "JSR publish check passed"

    # publint (verify package.json)
    print_step "Running publint..."
    if ! npx publint > /dev/null 2>&1; then
        print_error "publint failed"
        print_warning "Run 'npx publint' to see details"
        exit 1
    fi
    print_success "publint passed"

    # arethetypeswrong (verify type exports)
    print_step "Checking TypeScript type exports..."
    if ! npx @arethetypeswrong/cli --pack --profile esm-only > /dev/null 2>&1; then
        print_error "arethetypeswrong check failed"
        print_warning "Run 'npx @arethetypeswrong/cli --pack --profile esm-only' to see details"
        exit 1
    fi
    print_success "Type exports check passed"

    # NPM pack dry-run (verify package contents)
    print_step "Verifying NPM package contents..."
    local pack_output=$(npm pack --dry-run 2>&1)
    if [[ $? -ne 0 ]]; then
        print_error "NPM pack dry-run failed"
        exit 1
    fi
    # Check for essential files
    if ! echo "$pack_output" | grep -q "dist/index.js"; then
        print_error "dist/index.js missing from NPM package"
        exit 1
    fi
    if ! echo "$pack_output" | grep -q "dist/index.d.ts"; then
        print_error "dist/index.d.ts missing from NPM package"
        exit 1
    fi
    print_success "NPM package contents verified"
}

# Function to check version sync
check_version_sync() {
    print_step "Checking version synchronization..."
    
    # Get versions from both files
    local pkg_version=$(node -p "require('./package.json').version")
    local deno_version=$(node -p "JSON.parse(require('fs').readFileSync('./deno.json', 'utf8')).version")

    if [[ "$pkg_version" != "$deno_version" ]]; then
        print_error "Version mismatch detected!"
        print_warning "package.json: $pkg_version"
        print_warning "deno.json: $deno_version"
        exit 1
    fi
    
    print_success "Versions are synchronized: $pkg_version"
    echo "$pkg_version"
}

# Function to update versions
update_versions() {
    local new_version=$1
    
    print_step "Updating version to $new_version..."
    
    # Update package.json
    node -e "
        const fs = require('fs');
        const pkg = require('./package.json');
        pkg.version = '$new_version';
        fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\\n');
    "
    
    # Update deno.json
    node -e "
        const fs = require('fs');
        const deno = JSON.parse(fs.readFileSync('./deno.json', 'utf8'));
        deno.version = '$new_version';
        fs.writeFileSync('./deno.json', JSON.stringify(deno, null, 2) + '\\n');
    "
    
    print_success "Versions updated to $new_version"
}

# Function to create tag and release
create_release() {
    local version=$1
    local tag_name="v${version}"

    # Check if tag already exists
    if git rev-parse "$tag_name" >/dev/null 2>&1; then
        print_error "Tag $tag_name already exists"
        exit 1
    fi

    # Commit version changes (skip if already at target version)
    git add package.json deno.json
    if git diff --cached --quiet; then
        print_warning "Version already at $version, skipping commit"
    else
        print_step "Committing version changes..."
        git commit -m "chore: bump version to $version"
        print_success "Version bump committed"
    fi

    # Create tag
    print_step "Creating tag $tag_name..."
    git tag -a "$tag_name" -m "Release version $version"
    print_success "Tag $tag_name created"

    # Push changes and tag
    print_step "Pushing to remote..."
    git push origin main
    git push origin "$tag_name"
    print_success "Changes and tag pushed to remote"

    echo
    print_success "🎉 Release $tag_name has been created!"
    print_warning "The publish workflow will now run automatically."
    print_warning "Monitor the workflow at: https://github.com/CharlesWiltgen/TagLib-Wasm/actions"
    
    # Create GitHub release if gh is available
    if command -v gh &> /dev/null; then
        print_step "Creating GitHub release..."
        
        # Get the previous tag for changelog
        local prev_tag=$(git describe --tags --abbrev=0 "$tag_name^" 2>/dev/null || echo "")
        local changelog_link=""
        
        if [[ -n "$prev_tag" ]]; then
            changelog_link="**Full Changelog**: https://github.com/CharlesWiltgen/TagLib-Wasm/compare/${prev_tag}...${tag_name}"
        fi
        
        # Mark pre-release versions appropriately
        local release_flags="--latest"
        if [[ "$version" == *-* ]]; then
            release_flags="--prerelease"
        fi

        gh release create "$tag_name" \
            --title "Release $tag_name" \
            --notes "## What's Changed

- Version bump to $version

$changelog_link" \
            $release_flags
            
        print_success "GitHub release created"
    else
        print_warning "GitHub CLI (gh) not found. Create release manually at:"
        print_warning "https://github.com/CharlesWiltgen/TagLib-Wasm/releases/new?tag=$tag_name"
    fi
}

# Main script
main() {
    echo "🚀 TagLib-Wasm Safe Release Script"
    echo "=================================="
    echo

    # Get version argument or auto-increment
    local new_version=""
    
    if [[ $# -eq 0 ]]; then
        # No version specified, auto-increment patch version
        local current_version=$(node -p "require('./package.json').version")
        
        # Parse version components
        IFS='.' read -ra VERSION_PARTS <<< "$current_version"
        local major="${VERSION_PARTS[0]}"
        local minor="${VERSION_PARTS[1]}"
        local patch="${VERSION_PARTS[2]}"
        
        # Increment patch version
        patch=$((patch + 1))
        new_version="${major}.${minor}.${patch}"
        
        print_step "Auto-incrementing version: $current_version → $new_version"
    else
        new_version=$1
        
        # Validate version format (semver with optional pre-release)
        if ! [[ "$new_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-.+)?$ ]]; then
            print_error "Invalid version format: $new_version"
            print_warning "Version must be in format X.Y.Z or X.Y.Z-pre (e.g., 2.2.5, 1.0.0-beta.5)"
            exit 1
        fi
    fi

    # Pre-release checks
    print_step "Running pre-release checks..."
    check_main_branch
    check_clean_working_tree
    check_up_to_date

    # Check current version synchronization
    local current_version=$(check_version_sync)
    
    # Show version change
    echo
    print_step "Version change: $current_version → $new_version"
    read -p "Continue with this version change? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Release cancelled"
        exit 0
    fi

    # Run comprehensive tests (includes build)
    run_tests

    # Verify WASM binaries match what's committed
    verify_wasm_freshness

    # Run preflight checks for package publishing
    run_preflight_checks

    # Update versions
    update_versions "$new_version"

    # Run tests again after version update
    print_step "Running tests after version update..."
    run_tests

    # Create release
    create_release "$new_version"
}

# Run main function
main "$@"