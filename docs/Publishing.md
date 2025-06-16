# Publishing Guide

This document explains how to publish `taglib-wasm` to NPM with only the
essential runtime components.

## 📦 Essential Components

Only these components are published to registries:

### 1. **Wasm TagLib**

- `build/taglib.wasm` - Compiled TagLib WebAssembly module
- `build/taglib-wrapper.js` - Emscripten-generated JavaScript wrapper

### 2. **TypeScript API**

- `index.ts` - NPM main module exports
- `src/taglib.ts` - Core TagLib and AudioFile classes
- `src/types.ts` - TypeScript type definitions
- `src/wasm.ts` - Wasm module interface and utilities

### 3. **Documentation & Licensing**

- `README.md` - Usage documentation
- `LICENSE` - MIT license
- `lib/taglib/COPYING*` - TagLib library licenses

## 🚀 Publishing Process

### Prerequisites

1. **Build the Wasm module:**
   ```bash
   npm run build:wasm
   ```

2. **Verify essential files exist:**
   ```bash
   ls -la build/taglib.wasm build/taglib-wrapper.js src/
   ```

### NPM Publishing

```bash
# Publish to NPM
npm publish

# Or via npm script  
npm run publish:npm
```

**NPM Configuration** (`package.json`):

- **Package name**: `taglib-wasm`
- **Entry point**: `index.ts`
- **Includes**: TypeScript source + Wasm files

**Installation**:

```bash
npm install taglib-wasm
bun add taglib-wasm
```

### GitHub Packages Publishing

```bash
# Publish to GitHub Packages
npm run publish:github

# Or manually
./scripts/publish-github.sh
```

**GitHub Packages Configuration** (`.github-package.json`):

- **Package name**: `@charleswiltgen/taglib-wasm`
- **Registry**: `https://npm.pkg.github.com/`
- **Entry point**: `index.ts`
- **Includes**: TypeScript source + Wasm files

**Installation**:

```bash
npm install @charleswiltgen/taglib-wasm --registry=https://npm.pkg.github.com/
bun add @charleswiltgen/taglib-wasm --registry=https://npm.pkg.github.com/
```

**Authentication** for GitHub Packages:

1. Generate a GitHub Personal Access Token with `packages:write` permission
2. Set environment variable: `export GITHUB_TOKEN=your_token_here`
3. Or configure `.npmrc` with your token

## 📋 What Gets Published

### Included Files

```
Published Package:
├── src/
│   ├── taglib.ts       # Core API
│   ├── types.ts        # Type definitions
│   └── wasm.ts         # Wasm interface
├── build/
│   ├── taglib.wasm     # Compiled WebAssembly
│   └── taglib.js       # Emscripten glue code
├── lib/taglib/
│   ├── COPYING.LGPL    # TagLib license
│   └── COPYING.MPL     # TagLib license
├── index.ts            # Main exports
├── README.md           # Documentation
└── package.json        # Package metadata
```

### Excluded from Publication

These files are **NOT** included in the published package:

- **Development files**: Test files, scripts, build tools
- **Documentation**: `/docs` folder (available on GitHub)
- **Examples**: `/examples` folder (available on GitHub)
- **TagLib C++ source**: `/lib/taglib` (except licenses)
- **Build artifacts**: CMake files, object files
- **Git files**: `.git`, `.gitignore`, `.gitmodules`

## 🔧 Version Management

### Updating Version

**Manual version update:**

```bash
# Update version in package.json
npm version patch  # or minor/major

# This updates version in package.json and creates a git tag
```

**Important**: Always ensure versions match between:

- `package.json` - NPM package version

## 🚀 CI/CD Publishing

The project uses GitHub Actions for automated publishing:

1. **Create a GitHub Release**:
   - Tag version should match package version (e.g., `v0.1.0`)
   - This triggers automatic publishing to NPM and GitHub Packages

2. **Manual workflow dispatch**:
   - Go to Actions → "Publish to NPM and GitHub Packages"
   - Click "Run workflow"
   - Enter version to publish

## 📝 Pre-Publishing Checklist

Before publishing a new version:

- [ ] Run tests: `npm test`
- [ ] Build Wasm: `npm run build:wasm`
- [ ] Build TypeScript: `npm run build:ts`
- [ ] Update version in `package.json`
- [ ] Update CHANGELOG.md (if exists)
- [ ] Commit changes: `git commit -m "chore: bump version"`
- [ ] Create git tag: `git tag v0.1.0`
- [ ] Push changes: `git push && git push --tags`

## 🔑 Required Secrets

For CI/CD publishing, configure these GitHub repository secrets:

- `NPM_TOKEN` - NPM authentication token
- GitHub Package Registry uses `GITHUB_TOKEN` (automatically provided)

## 🎯 Quick Commands

```bash
# Local development build
npm run build

# Run tests
npm test

# Manual NPM publish
npm publish

# Manual GitHub Packages publish
npm run publish:github
```
