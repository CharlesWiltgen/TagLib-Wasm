# Version Management

This project maintains version numbers in both `deno.json` and `package.json`. To ensure these stay synchronized, we use automated tools and git hooks.

## Quick Start

### Setup Git Hooks (One-time)

```bash
./scripts/setup-git-hooks.sh
```

This installs a pre-commit hook that prevents commits when versions are out of sync.

## Version Commands

### Increment Version

Use Deno tasks to update versions in both files:

```bash
# Increment patch version (0.3.22 → 0.3.23)
deno task version:patch

# Increment minor version (0.3.22 → 0.4.0)
deno task version:minor

# Increment major version (0.3.22 → 1.0.0)
deno task version:major

# Set specific version
deno task version:set 1.2.3
```

### Check Version Sync

```bash
# Check if versions match
deno task version:check
```

## How It Works

### Version Sync Script

The `scripts/sync-version.ts` script:
- Reads version from both `deno.json` and `package.json`
- Updates both files atomically when changing versions
- Validates semantic version format
- Provides clear error messages

### Git Pre-commit Hook

The `.githooks/pre-commit` hook:
- Runs automatically before each commit
- Checks if versions in both files match
- Prevents commits if versions differ
- Checks both working directory and staged files
- Can be bypassed with `git commit --no-verify` if needed

## Workflow Example

1. **Start a new feature**:
   ```bash
   git checkout -b feature/awesome-feature
   ```

2. **Make changes and update version**:
   ```bash
   # After implementing feature
   deno task version:minor
   ```

3. **Commit changes**:
   ```bash
   git add .
   git commit -m "feat: add awesome feature"
   # Pre-commit hook validates version sync automatically
   ```

## Troubleshooting

### Version Mismatch Error

If you see:
```
❌ Version mismatch detected!
   package.json: 0.3.22
   deno.json:    0.3.23
```

Fix it by running one of the version commands above.

### Disable Git Hooks Temporarily

```bash
# For a single commit
git commit --no-verify

# To disable hooks completely
git config --unset core.hooksPath

# To re-enable hooks
./scripts/setup-git-hooks.sh
```

### Manual Version Edit

If you manually edit version numbers, ensure you update both files:
1. Edit `package.json` version field
2. Edit `deno.json` version field
3. Commit both files together

## Best Practices

1. **Always use version tasks** instead of manual edits
2. **Update version when**:
   - Adding new features (minor)
   - Making breaking changes (major)
   - Fixing bugs (patch)
3. **Include version bump in feature commits** when appropriate
4. **Tag releases** after version updates:
   ```bash
   git tag v0.3.23
   git push origin v0.3.23
   ```