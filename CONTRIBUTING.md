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
- **Emscripten SDK** - For building WebAssembly
- **Git** - With git subtree support for TagLib updates

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/CharlesWiltgen/TagLib-Wasm.git
   cd taglib-wasm
   ```

2. **Install Emscripten**
   ```bash
   # Follow instructions at https://emscripten.org/docs/getting_started/downloads.html
   # Or use brew on macOS:
   brew install emscripten
   ```

3. **Build the project**
   ```bash
   npm run build
   # or
   deno task build
   ```

4. **Run tests**
   ```bash
   npm test
   # or
   deno task test
   ```

## 📝 Development Guidelines

### Code Style

- **TypeScript**: Strict mode enabled, no `any` types without justification
- **Formatting**: Use Deno formatter (`deno fmt`)
- **Linting**: Pass Deno linter (`deno lint`)
- **Comments**: JSDoc for all public APIs

### Project Structure

```
taglib-wasm/
├── src/           # TypeScript source code
├── build/         # Build scripts and C++ wrapper
├── tests/         # Test files
├── docs/          # Documentation
├── examples/      # Usage examples
└── lib/taglib/    # TagLib C++ library (git subtree)
```

### Key Files

- `build/taglib_embind.cpp` - C++ wrapper using Embind
- `src/taglib.ts` - Core TypeScript API
- `src/simple.ts` - Simplified API
- `tests/index.test.ts` - Main test suite

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test category
npm run test:core      # Core functionality
npm run test:edge      # Edge cases
npm run test:errors    # Error handling
npm run test:memory    # Memory management

# Watch mode
npm run test:watch
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
   npm test
   deno task fmt   # Format code
   deno task lint  # Check for issues
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

If you modify the C++ wrapper (`build/taglib_embind.cpp`):

1. **Edit the C++ code**
2. **Rebuild Wasm**
   ```bash
   npm run build:wasm
   ```
3. **Test thoroughly** - C++ changes can break everything

### C++ Guidelines

- Use `std::unique_ptr` for memory management
- Validate all inputs from JavaScript
- Handle exceptions gracefully
- Use Embind's `val` type for JavaScript objects
- Document any new exported functions

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

To update the TagLib C++ library:

```bash
./scripts/update-taglib.sh [version]
# Default: v2.1
```

This uses git subtree to update `lib/taglib/`.

## ❓ Questions?

- Open a discussion on GitHub
- Check existing issues
- Review the documentation

## 🙏 Thank You!

Your contributions make taglib-wasm better for everyone. We appreciate your time
and effort!
