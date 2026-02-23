# Release Checklist for TagLib-Wasm

This checklist ensures a smooth and safe release process.

## Pre-Release Checklist

### 1. Code Quality

- [ ] All tests pass (`deno task test`)
- [ ] Code is properly formatted (`deno fmt --check`)
- [ ] No linting errors (`deno lint`)
- [ ] Type checking passes (`deno check ./src ./tests`)
- [ ] Build succeeds (`deno task build`)

### 2. Version Synchronization

- [ ] Version in `package.json` matches version in `deno.json`
- [ ] Version follows semantic versioning (MAJOR.MINOR.PATCH)

### 3. Git Status

- [ ] On `main` branch
- [ ] No uncommitted changes
- [ ] Local branch is up to date with `origin/main`
- [ ] No existing tag for the new version

### 4. Documentation

- [ ] CHANGELOG is updated (if applicable)
- [ ] README is up to date
- [ ] API documentation is current

## Release Process

### Automated Release (Recommended)

Use the safe release script that enforces all checks:

```bash
# Auto-increment patch version (e.g., 2.2.5 → 2.2.6)
deno task release

# Set a specific version
deno task release 2.3.0

# Or directly:
./scripts/release-safe.sh         # Auto-increment
./scripts/release-safe.sh 2.3.0   # Specific version
```

This script will:

1. Verify you're on the main branch
2. Check for uncommitted changes
3. Ensure local is up to date with remote
4. Run all tests (format, lint, type-check, unit tests)
5. Verify build process works
6. Check version synchronization
7. Update versions in both package.json and deno.json
8. Commit version changes
9. Create and push git tag
10. Trigger the publish workflow

### Manual Release (Not Recommended)

If you must release manually:

1. **Run all checks**:
   ```bash
   deno fmt --check
   deno lint
   deno check ./src ./tests
   deno task test
   deno task build
   ```

2. **Update versions**:
   - Edit `package.json` version
   - Edit `deno.json` version
   - Ensure they match

3. **Commit and tag**:
   ```bash
   git add package.json deno.json
   git commit -m "chore: bump version to X.Y.Z"
   git tag -a vX.Y.Z -m "Release version X.Y.Z"
   git push origin main
   git push origin vX.Y.Z
   ```

## Post-Release Checklist

### 1. Verify GitHub Actions

- [ ] Check the [Actions page](https://github.com/CharlesWiltgen/TagLib-Wasm/actions)
- [ ] Ensure "Publish to JSR/NPM/GitHub" workflow triggered
- [ ] Verify all publish jobs succeeded

### 2. Verify Package Availability

- [ ] Check [NPM](https://www.npmjs.com/package/taglib-wasm)
- [ ] Check [JSR](https://jsr.io/@charlesw/taglib-wasm)
- [ ] Check GitHub Packages

### 3. Test Installation

```bash
# Test NPM
npm install taglib-wasm@latest

# Test JSR
deno add @charlesw/taglib-wasm
```

### 4. Create GitHub Release

If not done automatically:

1. Go to [Releases](https://github.com/CharlesWiltgen/TagLib-Wasm/releases)
2. Click "Draft a new release"
3. Select the tag you created
4. Add release notes

## Troubleshooting

### Tests Failing

- Run `deno task fmt` to fix formatting
- Fix any linting errors shown by `deno lint`
- Ensure all tests pass locally before releasing

### Version Mismatch

- Ensure both `package.json` and `deno.json` have the same version
- Use the release script which handles this automatically

### Publish Workflow Fails

- Check the workflow logs for specific errors
- Common issues:
  - Missing OIDC permissions (JSR)
  - Invalid NPM token
  - Network issues

### Tag Already Exists

- Delete the local tag: `git tag -d vX.Y.Z`
- Delete the remote tag: `git push origin :refs/tags/vX.Y.Z`
- Start the release process again

## Best Practices

1. **Always use the release script** - It enforces all checks
2. **Release from main branch** - Ensures consistency
3. **Run tests before tagging** - Prevents broken releases
4. **Monitor the publish workflow** - Catch issues early
5. **Test the published package** - Verify it works for users
