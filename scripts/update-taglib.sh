#!/bin/bash
set -e

# Update TagLib to a new version
# Usage: ./scripts/update-taglib.sh v2.2
#        ./scripts/update-taglib.sh v2.1.1
#
# Version format: vMAJOR.MINOR or vMAJOR.MINOR.PATCH
# Examples: v2.1, v2.1.1, v3.0

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to print colored messages
error() { echo -e "${RED}❌ Error: $1${NC}" >&2; }
warning() { echo -e "${YELLOW}⚠️  Warning: $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "ℹ️  $1"; }

# Validate prerequisites
check_prerequisites() {
  if ! command -v git &> /dev/null; then
    error "git is not installed. Please install git first."
    exit 1
  fi
  
  if ! git rev-parse --git-dir &> /dev/null; then
    error "Not in a git repository. Please run from the project root."
    exit 1
  fi
  
  # Check for uncommitted changes
  if ! git diff --quiet || ! git diff --cached --quiet; then
    error "You have uncommitted changes. Please commit or stash them first."
    exit 1
  fi
}

# Validate version format
validate_version() {
  local version=$1
  
  # Check if version matches the expected format (vMAJOR.MINOR or vMAJOR.MINOR.PATCH)
  if ! [[ "$version" =~ ^v[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
    error "Invalid version format: $version"
    echo "Expected format: vMAJOR.MINOR or vMAJOR.MINOR.PATCH"
    echo "Examples: v2.1, v2.1.1, v3.0"
    exit 1
  fi
  
  # Check if the version exists in the remote repository
  info "Checking if version $version exists in TagLib repository..."
  if ! git ls-remote --tags https://github.com/taglib/taglib.git | grep -q "refs/tags/$version$"; then
    error "Version $version does not exist in TagLib repository"
    echo "Available versions:"
    git ls-remote --tags https://github.com/taglib/taglib.git | grep -E 'refs/tags/v[0-9]+\.[0-9]+' | sed 's/.*refs\/tags\///' | sort -V | tail -10
    exit 1
  fi
  
  success "Version $version is valid and exists"
}

# Save current branch to return to it later
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Track whether we're in an actual update operation
UPDATE_STARTED=false

# Cleanup function for error recovery
cleanup_on_error() {
  local exit_code=$?
  if [ $exit_code -ne 0 ] && [ "$UPDATE_STARTED" = true ]; then
    warning "Update failed. Attempting to recover..."
    
    # Abort any merge in progress
    if [ -f .git/MERGE_HEAD ]; then
      info "Aborting merge..."
      git merge --abort 2>/dev/null || true
    fi
    
    # Return to original branch
    if [ -n "$CURRENT_BRANCH" ] && [ "$(git rev-parse --abbrev-ref HEAD)" != "$CURRENT_BRANCH" ]; then
      info "Returning to branch $CURRENT_BRANCH..."
      git checkout "$CURRENT_BRANCH" 2>/dev/null || true
    fi
    
    # Reset any staged changes
    git reset HEAD 2>/dev/null || true
    
    error "Update failed. Repository has been restored to its previous state."
    echo "You may need to run 'git status' to verify the repository state."
  fi
}

# Set up error trap
trap cleanup_on_error EXIT

# Main script
main() {
  local NEW_VERSION=${1:-""}
  
  # If no version provided, show usage
  if [ -z "$NEW_VERSION" ]; then
    error "No version specified"
    echo "Usage: $0 <version>"
    echo "Example: $0 v2.1.1"
    echo ""
    echo "Recent TagLib versions:"
    git ls-remote --tags https://github.com/taglib/taglib.git | grep -E 'refs/tags/v[0-9]+\.[0-9]+' | sed 's/.*refs\/tags\///' | sort -V | tail -5
    exit 1
  fi
  
  # Run all validations
  check_prerequisites
  validate_version "$NEW_VERSION"
  
  info "Starting TagLib update to $NEW_VERSION..."
  
  # Mark that we're starting the actual update
  UPDATE_STARTED=true
  
  # Create a backup tag before update
  BACKUP_TAG="backup-before-taglib-${NEW_VERSION}-$(date +%Y%m%d-%H%M%S)"
  info "Creating backup tag: $BACKUP_TAG"
  git tag "$BACKUP_TAG"
  
  # Pull the new version using git subtree
  # Use -X theirs strategy to automatically resolve conflicts in favor of upstream
  info "Pulling TagLib $NEW_VERSION with git subtree..."
  
  if ! git subtree pull --prefix=lib/taglib https://github.com/taglib/taglib.git "$NEW_VERSION" --squash -m "Update TagLib to $NEW_VERSION" -X theirs; then
    warning "Merge conflict detected. Resolving in favor of upstream TagLib..."
    
    # Get list of conflicted files
    CONFLICTED_FILES=$(git status --porcelain | grep "^UU" | awk '{print $2}')
    
    if [ -z "$CONFLICTED_FILES" ]; then
      error "Failed to identify conflicted files"
      exit 1
    fi
    
    # Accept all changes from upstream for any conflicted files
    echo "$CONFLICTED_FILES" | while read -r file; do
      if [ -n "$file" ]; then
        info "Accepting upstream version of $file"
        if ! git checkout --theirs "$file"; then
          error "Failed to resolve conflict for $file"
          exit 1
        fi
        if ! git add "$file"; then
          error "Failed to stage $file"
          exit 1
        fi
      fi
    done
    
    # Complete the merge
    info "Completing merge..."
    if ! git commit -m "Update TagLib to $NEW_VERSION (resolved conflicts in favor of upstream)"; then
      error "Failed to complete merge commit"
      exit 1
    fi
  fi
  
  # Disable trap for successful completion
  trap - EXIT
  
  success "TagLib updated to $NEW_VERSION"
  info "Backup created at tag: $BACKUP_TAG"
  
  echo ""
  echo "📝 Next steps:"
  echo "   1. Review changes: git diff HEAD~1"
  echo "   2. Build project: npm run build"
  echo "   3. Run tests: npm test"
  echo ""
  echo "If issues occur, you can restore the previous state with:"
  echo "   git reset --hard $BACKUP_TAG"
  echo "   git tag -d $BACKUP_TAG  # After confirming everything works"
}

# Run main function
main "$@"