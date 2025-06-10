# Publishing Guide

This document explains how to publish `taglib-wasm` to both JSR (JavaScript Registry) and NPM with only the essential runtime components.

## 📦 Essential Components

Only these components are published to registries:

### 1. **WASM TagLib** 
- `build/taglib.wasm` - Compiled TagLib WebAssembly module
- `build/taglib.js` - Emscripten-generated JavaScript glue code

### 2. **TypeScript API**
- `src/mod.ts` - Main module exports
- `src/taglib.ts` - Core TagLib and AudioFile classes
- `src/types.ts` - TypeScript type definitions  
- `src/wasm.ts` - WASM module interface and utilities

### 3. **Documentation & Licensing**
- `README.md` - Usage documentation
- `LICENSE` - MIT license
- `lib/taglib/COPYING*` - TagLib library licenses

## 🚀 Publishing Process

### Prerequisites

1. **Build the WASM module:**
   ```bash
   deno task build:wasm
   ```

2. **Verify essential files exist:**
   ```bash
   ls -la build/taglib.wasm build/taglib.js src/
   ```

### JSR Publishing (Deno)

```bash
# Publish to JSR (JavaScript Registry)
deno publish

# Or via npm script
npm run publish:jsr
```

**JSR Configuration** (`deno.json`):
- **Package name**: `@taglib/wasm`
- **Entry point**: `./src/mod.ts`
- **Includes**: TypeScript source + WASM files

**Installation**:
```typescript
import { TagLib } from "jsr:@taglib/wasm";
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
- **Entry point**: `src/mod.ts`
- **Includes**: TypeScript source + WASM files

**Installation**:
```bash
npm install taglib-wasm
bun add taglib-wasm
```

### Publish to Both

```bash
# Publish to both registries
npm run publish:all
```

## 📋 What Gets Published

### Included Files

```
Published Package:
├── src/
│   ├── mod.ts          # Main exports
│   ├── taglib.ts       # Core API
│   ├── types.ts        # Type definitions
│   └── wasm.ts         # WASM interface
├── build/
│   ├── taglib.wasm     # Compiled WebAssembly
│   └── taglib.js       # Emscripten glue code
├── lib/taglib/
│   ├── COPYING.LGPL    # TagLib license
│   └── COPYING.MPL     # TagLib license
├── README.md           # Documentation
├── LICENSE             # MIT license
└── package.json        # Package metadata
```

### Excluded Files

The following development files are **NOT** published:

```
❌ Not Published:
├── .git/               # Git repository
├── test-files/         # Test audio samples
├── tests/              # Test suite
├── examples/           # Usage examples
├── build/build-wasm.sh # Build scripts
├── lib/taglib/         # Full TagLib source (except licenses)
├── CLAUDE.md           # Development notes
├── IMPLEMENTATION.md   # Implementation details
└── *.ts (test files)   # Test scripts
```

## 🔍 Verification

### Check Package Contents

**NPM**:
```bash
npm pack --dry-run
```

**JSR**:
```bash
deno publish --dry-run
```

### Test Installation

**From NPM**:
```bash
# Test in a temporary directory
mkdir /tmp/test-npm && cd /tmp/test-npm
npm init -y
npm install taglib-wasm
node -e "console.log(require('taglib-wasm'))"
```

**From JSR**:
```bash
# Test with Deno
deno eval "import { TagLib } from 'jsr:@taglib/wasm'; console.log(TagLib)"
```

## 📈 Version Management

### Bump Version

1. **Update version** in both `package.json` and `deno.json`
2. **Commit changes**:
   ```bash
   git add package.json deno.json
   git commit -m "Bump version to X.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```
3. **Publish**:
   ```bash
   npm run publish:all
   ```

### Version Consistency

Ensure both files have the same version:
- `package.json` → `"version": "X.Y.Z"`
- `deno.json` → `"version": "X.Y.Z"`

## 🚨 Important Notes

### Runtime Compatibility

- **JSR**: TypeScript files work directly in Deno
- **NPM**: TypeScript files work in Node.js/Bun with loaders
- **Browser**: Requires bundler (Vite, Webpack, etc.)

### WASM File Access

The WASM files (`build/taglib.wasm` and `build/taglib.js`) are included in the published packages and loaded automatically by the TypeScript API.

### Size Considerations

- **Package size**: ~350KB (mostly WASM)
- **Core files**: TypeScript source is <50KB
- **WASM module**: ~300KB compiled TagLib

## 🎯 Publishing Checklist

Before publishing:

- [ ] WASM module built (`build/taglib.wasm` exists)
- [ ] Tests passing (`npm test`)
- [ ] Version bumped in both `package.json` and `deno.json`
- [ ] Changes committed and tagged
- [ ] README updated with new features
- [ ] Dry-run successful (`npm pack --dry-run` and `deno publish --dry-run`)

---

This streamlined publishing process ensures only the essential runtime components reach end users while keeping the development repository clean and organized.