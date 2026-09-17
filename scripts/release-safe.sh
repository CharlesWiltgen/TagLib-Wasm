#!/bin/bash
set -euo pipefail

# Safe Release Script for TagLib-Wasm
# Runs the gates, bumps and pushes the version, waits for CI on that commit, and
# then dispatches the publish workflow. The tag and the GitHub release are
# created by that workflow's finalize job, only after JSR, npm, and GitHub
# Packages all carry the version (taglib-rkx0).
#
# Usage:
#   deno task release                    # Auto-increment patch version (0.0.1)
#   deno task release 2.3.4              # Set specific version
#   SKIP_PUBLISH_WATCH=1 deno task release   # Do not wait for the publish result

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

    # Same check for the WASI binary. `deno task build` now rebuilds both
    # backends, so a stale committed binary shows up as a dirty working tree.
    #
    # This replaces an older cmp against dist/wasi/taglib-wasi.wasm, which
    # could never fail: build-wasi.sh writes build/ and dist/wasi/ from the
    # same run, so it compared a file to its own copy. Worse, when dist/wasi/
    # was absent it fell through to an exists-and-over-100KB warning — so a
    # WASI binary built from an older lib/taglib passed silently (taglib-mpw).
    if [ ! -f build/taglib-wasi.wasm ]; then
        print_error "build/taglib-wasi.wasm is missing!"
        print_warning "Run: deno task build:wasm:wasi"
        exit 1
    fi
    # The WASI reference binary is the CI/Linux build: wasi-sdk's clang emits
    # different bytes per host platform (taglib-peml), so a macOS rebuild can
    # never match the committed reference. CI's byte-compare gate is the
    # authority (release waits for CI green before tagging), so the local
    # compare only applies on Linux hosts.
    if [[ "$(uname -s)" == "Linux" ]]; then
        if ! git diff --quiet -- build/taglib-wasi.wasm; then
            print_error "build/taglib-wasi.wasm is stale!"
            print_warning "The WASI build produced a different binary than what's committed."
            print_warning "Stage the updated file and re-run the release:"
            print_warning "  git add build/taglib-wasi.wasm && git commit --amend --no-edit"
            exit 1
        fi
        print_success "build/taglib-wasi.wasm matches fresh build"
    else
        print_warning "Skipping local WASI byte-compare on $(uname -s) — the committed"
        print_warning "reference is the CI/Linux build; CI validates freshness before tagging."
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

    # The npm checks below lint the packed npm tarball, so dist/ must hold a
    # complete package first. `deno task build` above does not produce one:
    # its build:ts is scripts/build-js.mjs, which emits .js only — the .d.ts
    # files come from tsc, which lives in the npm build:ts. Without this step
    # the checks lint whatever stale dist/ happened to be lying around (and
    # fail outright once it is cleaned). The wasm is copied rather than
    # rebuilt; `deno task build` already produced fresh binaries.
    print_step "Building npm package artifacts..."
    if ! (npm run build:clean && npm run build:copy-wasm && npm run build:ts \
        && npm run postbuild) > /dev/null 2>&1; then
        print_error "npm package build failed"
        print_warning "Run 'npm run build' to see details"
        exit 1
    fi
    print_success "npm package artifacts built"

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

# Function to check version sync (delegates to sync-version.ts for all 4 files)
check_version_sync() {
    print_step "Checking version synchronization..."

    if ! deno task version:check; then
        print_error "Version mismatch detected!"
        print_warning "Run 'deno task version:set <version>' to synchronize all version references"
        exit 1
    fi

    local pkg_version=$(node -p "require('./package.json').version")
    print_success "Versions are synchronized: $pkg_version"
    echo "$pkg_version"
}

# Function to update versions (delegates to sync-version.ts for all 4 files)
update_versions() {
    local new_version=$1

    print_step "Updating version to $new_version..."

    if ! deno task version:set "$new_version"; then
        print_error "Failed to update versions"
        exit 1
    fi
}

# Function to wait for remote CI to pass on the current HEAD commit.
# Required legs must succeed; flaky legs (Windows/macOS) are tolerated.
# This blocks the release flow so we never tag a commit that hasn't validated.
wait_for_remote_ci() {
    local commit_sha
    commit_sha=$(git rev-parse HEAD)

    print_step "Waiting for remote CI to validate ${commit_sha:0:7}..."
    print_warning "This typically takes 5–10 minutes; do not interrupt."

    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if ! bash "${script_dir}/wait-for-ci.sh" "$commit_sha"; then
        print_error "Remote CI failed for ${commit_sha:0:7}"
        print_warning "The version-bump commit is on main, but no tag was created."
        print_warning "Fix the failures, push another commit, and re-run the release."
        exit 1
    fi
    print_success "Remote CI passed — safe to tag"
}

# Function to dispatch the publish workflow and report the outcome
publish_release() {
    local version=$1
    local tag_name="v${version}"

    # Check if tag already exists
    if git rev-parse "$tag_name" >/dev/null 2>&1; then
        print_error "Tag $tag_name already exists"
        exit 1
    fi

    # Commit version changes (skip if already at target version)
    git add package.json deno.json sonar-project.properties src/version.ts
    if git diff --cached --quiet; then
        print_warning "Version already at $version, skipping commit"
    else
        print_step "Committing version changes..."
        git commit -m "chore: bump version to $version"
        print_success "Version bump committed"
    fi

    # Push commit FIRST so CI runs against the exact commit we're about to tag.
    print_step "Pushing version bump to remote..."
    git push origin main
    print_success "Version bump pushed to remote"

    # Block until remote CI passes on this commit. Never tag an unvalidated commit.
    wait_for_remote_ci

    # Verify the npm publish path before tagging. A missing or mismatched
    # trusted-publisher entry fails the npm leg of publish-everywhere.yml AFTER
    # the tag and GitHub release exist (2.2.3, taglib-ljh6). An unverifiable
    # check (no npm session, or the 2FA prompt) warns and continues.
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    print_step "Verifying the npm publish path..."
    if ! bash "${script_dir}/check-publish-access.sh"; then
        print_error "npm publish path is broken — fix it before tagging"
        exit 1
    fi

    # Hand the release to CI. The tag and the GitHub release are created by the
    # publish workflow's finalize job, and only after every registry has the
    # version (taglib-rkx0): tagging locally publishes a release that a failed
    # publish leg then strands on some registries.
    print_step "Dispatching the publish workflow for $version..."
    if ! gh workflow run publish-everywhere.yml -f version="$version"; then
        print_error "Could not dispatch the publish workflow"
        print_warning "Dispatch it manually: gh workflow run publish-everywhere.yml -f version=$version"
        exit 1
    fi

    # Find the run we just queued: match the commit whose CI we waited on.
    local commit_sha run_id=""
    commit_sha=$(git rev-parse HEAD)
    for _ in $(seq 1 12); do
        run_id=$(gh run list --workflow=publish-everywhere.yml --limit 10 \
            --json databaseId,headSha,event \
            --jq "[.[] | select(.headSha == \"$commit_sha\" and .event == \"workflow_dispatch\")][0].databaseId // empty" 2>/dev/null || true)
        [ -n "$run_id" ] && break
        sleep 5
    done

    if [ -z "$run_id" ]; then
        print_warning "Dispatched, but the run has not appeared yet."
        print_warning "Monitor: https://github.com/CharlesWiltgen/TagLib-Wasm/actions/workflows/publish-everywhere.yml"
        return 0
    fi

    print_success "Publish run queued: https://github.com/CharlesWiltgen/TagLib-Wasm/actions/runs/$run_id"
    print_warning "The workflow tags and releases v$version only after JSR, npm, and GitHub Packages all have it."

    if [ "${SKIP_PUBLISH_WATCH:-}" = "1" ]; then
        print_warning "SKIP_PUBLISH_WATCH=1 — not waiting for the publish result"
        return 0
    fi

    print_step "Waiting for the publish result..."
    if gh run watch "$run_id" --exit-status; then
        echo
        print_success "🎉 v$version published to JSR, npm, and GitHub Packages; tag and GitHub release created"
    else
        print_error "Publish workflow failed — no tag was created, so nothing is half-released"
        print_warning "Recover with: gh run rerun $run_id --failed"
        exit 1
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

    # Publish: CI owns the tag and the GitHub release
    publish_release "$new_version"
}

# Run main function
main "$@"