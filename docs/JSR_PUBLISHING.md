# JSR Publishing Setup

This document explains how JSR (JavaScript Registry) publishing is configured for taglib-wasm.

## Overview

The project publishes to JSR using GitHub Actions OIDC (OpenID Connect) authentication, which allows secure, tokenless publishing directly from GitHub Actions workflows.

## Configuration

### 1. GitHub Actions Workflow

The `.github/workflows/publish-everywhere.yml` workflow includes:

```yaml
publish-jsr:
  permissions:
    contents: read
    id-token: write # Required for OIDC authentication to JSR
```

This permission allows the workflow to request OIDC tokens from GitHub.

### 2. JSR Package Configuration

In `deno.json`:

- Package name: `@charlesw/taglib-wasm`
- Exports are configured for main entry points
- Publish exclusions prevent unnecessary files from being published

### 3. OIDC Setup on JSR

To enable OIDC publishing from GitHub Actions:

1. **Create JSR Account**: Sign up at https://jsr.io
2. **Create Package**: Create the package `@charlesw/taglib-wasm` on JSR
3. **Link GitHub Repository**:
   - Go to package settings on JSR
   - Link to GitHub repository `CharlesWiltgen/taglib-wasm`
   - This automatically configures OIDC trust relationship

### 4. Publishing Process

When a tag is pushed or release is created:

1. GitHub Actions workflow starts
2. JSR publish job requests OIDC token from GitHub
3. Deno CLI uses OIDC token to authenticate with JSR
4. Package is published without needing stored secrets

## Troubleshooting

### Authentication Errors

If you see:

```
error: No means to authenticate. Pass a token to `--token`, or enable tokenless publishing from GitHub Actions using OIDC.
```

Ensure:

1. The workflow has `id-token: write` permission
2. The JSR package is linked to the correct GitHub repository
3. You're running from GitHub Actions (OIDC doesn't work locally)

### Manual Publishing

For local publishing (not recommended for releases):

```bash
deno publish --token=<your-jsr-token>
```

Get a token from https://jsr.io/account/tokens

## Current Status

- NPM: ✅ Publishing works
- GitHub Packages: ✅ Publishing works
- JSR: 🔧 OIDC configuration pending (needs repository linking on JSR)

## Next Steps

1. Create/claim the `@charlesw/taglib-wasm` package on JSR
2. Link it to the GitHub repository
3. The workflow will automatically work on the next release

## References

- [JSR OIDC Documentation](https://jsr.io/docs/publishing-packages#publishing-from-github-actions)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
