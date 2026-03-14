# Contributing to TagLib-Wasm

Thank you for your interest in contributing to TagLib-Wasm! This document
provides guidelines and instructions for contributing.

## 🤝 Code of Conduct

Be respectful and constructive in all interactions. We're here to build great
software together.

## 🚀 Getting Started

### Prerequisites

- **Deno 2.x** - Primary development runtime
- **Node.js 22.6+** - For npm compatibility testing
- **Emscripten SDK** - For building the Emscripten Wasm backend
- **WASI SDK 31** - For building the WASI Wasm backend (optional for TS-only changes)
- **Git** - With submodule support

### Development Setup

1. **Clone the repository** (includes TagLib, mpack, and msgpack submodules)
   ```bash
   git clone --recurse-submodules https://github.com/CharlesWiltgen/TagLib-Wasm.git
   cd TagLib-Wasm
   ```

2. **Install Emscripten** (required for Wasm builds)
   ```bash
   # Follow instructions at https://emscripten.org/docs/getting_started/downloads.html
   # Or use brew on macOS:
   brew install emscripten
   ```

3. **Install WASI SDK** (only needed if modifying the WASI backend)
   ```bash
   bash build/setup-wasi-sdk.sh        # Downloads WASI SDK 31
   bash build/build-eh-sysroot.sh      # Builds EH-enabled sysroot (one-time, ~5-10 min)
   ```

4. **Build the project**
   ```bash
   deno task build          # Build TypeScript + Emscripten Wasm
   deno task build:wasm     # Rebuild Emscripten Wasm only
   bash build/build-wasi.sh # Rebuild WASI Wasm only
   ```

5. **Run tests**
   ```bash
   deno task test           # Run ALL checks (format, lint, typecheck, tests)
   ```

## 📝 Development Guidelines

### Code Style

- **TypeScript**: Strict mode enabled, no `any` types without justification
- **Formatting**: Use Deno formatter (`deno fmt`)
- **Linting**: Pass Deno linter (`deno lint`)
- **Comments**: JSDoc for all public APIs

### Project Structure

```
TagLib-Wasm/
├── src/            # TypeScript source (core runtime, types, errors)
│   ├── capi/       # C/C++ binding layer (Wasm shim, MessagePack, boundary)
│   └── runtime/    # WASI host implementation
├── build/          # Build scripts (Emscripten + WASI)
├── tests/          # Test files
├── docs/           # Documentation site
├── examples/       # Usage examples
├── simple.ts       # Simple API entry point
├── index.ts        # Full API entry point
├── folder.ts       # Folder API entry point
└── lib/            # Git submodules (taglib, mpack, msgpack)
```

### Key Files

- `build/taglib_embind.cpp` - Emscripten C++ wrapper using Embind
- `src/capi/taglib_shim.cpp` - WASI C++ shim (FileRef-based)
- `src/capi/core/taglib_boundary.c` - Pure C WASI exports
- `src/taglib.ts` - Core TypeScript API
- `simple.ts` - Simple API entry point
- `tests/index.test.ts` - Main test suite

## 🧪 Testing

### Running Tests

```bash
# Run all checks (format, lint, typecheck, tests)
deno task test

# Watch mode
deno test --allow-read --allow-write --allow-env --watch tests/

# Run a specific test file
deno test --allow-read --allow-write --allow-env tests/basic-tags.test.ts
```

### Writing Tests

- Use BDD syntax (`describe`/`it`) from `@std/testing/bdd`
- Place tests in `tests/` directory
- Follow existing test patterns
- Test both success and error cases
- Include edge cases for new features

Example test:

```typescript
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

describe("Feature", () => {
  it("description", async () => {
    const taglib = await TagLib.initialize();
    const audioFile = await taglib.open(testFile);
    try {
      // Test your feature
      assertEquals(result, expected);
    } finally {
      audioFile.dispose();
    }
  });
});
```

## 💻 Making Changes

### Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

3. **Make your changes**
   - Write code following the style guide
   - Add tests for new functionality
   - Update documentation as needed

4. **Test your changes**
   ```bash
   deno task test  # Runs format, lint, typecheck, and tests
   ```

5. **Commit your changes**
   - Follow [Conventional Commits](https://www.conventionalcommits.org/)
   - See commit examples below

6. **Push and create PR**
   ```bash
   git push origin feat/your-feature-name
   ```

### Commit Message Format

Use the Conventional Commits specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks
- `perf`: Performance improvements

#### Examples

```
feat: add FLAC metadata support
fix: resolve memory leak in dispose method
docs: update API reference for SimpleAPI
test: add edge cases for Unicode handling
chore: update TagLib to v2.1.1
```

## 🔧 Building WebAssembly

The project has two Wasm backends:

| Backend    | Script                     | Used by           | C++ entry point            |
| ---------- | -------------------------- | ----------------- | -------------------------- |
| Emscripten | `deno task build:wasm`     | Browsers, Workers | `build/taglib_embind.cpp`  |
| WASI       | `bash build/build-wasi.sh` | Deno, Node.js     | `src/capi/taglib_shim.cpp` |

After C++ changes, rebuild the affected backend and test thoroughly.

### C++ Guidelines

- All C++ files **must** use `-fwasm-exceptions` (not `-fexceptions`) for consistent EH
- The WASI boundary layer (`taglib_boundary.c`) is pure C — keep it that way
- Validate all inputs from JavaScript/TypeScript side
- See `.claude/rules/wasm-exception-handling.md` for detailed EH constraints

## 📚 Documentation

### When to Update Docs

Update documentation when you:

- Add new features
- Change API behavior
- Fix confusing aspects
- Add examples

### Documentation Structure

- `README.md` - Main project documentation
- `docs/api/` - API reference
- `docs/guide/` - User guides and tutorials
- `examples/` - Working code examples

## 🐛 Reporting Issues

### Before Creating an Issue

1. Check existing issues
2. Try with the latest version
3. Verify it's not a TagLib limitation

### Issue Template

```markdown
**Description** Clear description of the issue

**Steps to Reproduce**

1. Code example
2. Expected behavior
3. Actual behavior

**Environment**

- taglib-wasm version:
- Runtime: [Deno/Node.js/Browser]
- OS:

**Additional Context** Error messages, logs, etc.
```

## 🚀 Pull Request Process

1. **Ensure all tests pass**
2. **Update documentation** if needed
3. **Add tests** for new features
4. **Keep PRs focused** - one feature/fix per PR
5. **Fill out PR template** completely

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] All tests pass
- [ ] Added new tests
- [ ] Tested on [Deno/Node.js/Bun/Browser]

## Checklist

- [ ] Follows code style
- [ ] Updated documentation
- [ ] Added to CHANGELOG (if applicable)
```

## 🔄 Updating TagLib

TagLib is a git submodule at `lib/taglib/`. To update:

```bash
cd lib/taglib
git fetch --tags
git checkout v2.2.1  # or desired version
cd ../..
git add lib/taglib
git commit -m "chore: update TagLib to v2.2.1"
```

## ❓ Questions?

- Open a discussion on GitHub
- Check existing issues
- Review the documentation

## 🙏 Thank You!

Your contributions make taglib-wasm better for everyone. We appreciate your time
and effort!
