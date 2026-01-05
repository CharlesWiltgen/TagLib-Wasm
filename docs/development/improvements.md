# Future Improvements

This document tracks potential improvements and feature additions for
taglib-wasm. These items represent opportunities to enhance the library based on
user feedback and technological advances.

## Test Suite Improvements

### Recent Improvements (Completed)

The test suite has been significantly enhanced with:

- **Better Organization** - Consistent naming, clear structure
- **Reduced Duplication** - Shared utilities eliminate repeated code
- **Real-World Testing** - Integration tests cover actual use cases
- **Performance Benchmarks** - Measure and track performance
- **Multi-Runtime Support** - Easy testing across environments
- **Developer Experience** - Watch mode, coverage reports, focused tests

### Test Coverage Status

- **Total Tests**: 140 (130 passing, 4 failing, 10 ignored)
- **Coverage Areas**:
  - ✅ Full API (100%)
  - ✅ Simple API (100%)
  - ✅ Picture API (100%)
  - ✅ Error handling (85%)
  - ✅ Memory management (100%)
  - ✅ Edge cases & Unicode (93%)
  - 🚧 Extended metadata (0% - not implemented)

### Next Steps for Testing

1. **Fix Failing Tests** (4 pre-existing failures):
   - Corrupted header handling
   - Format-specific error messages

2. **Implement Extended Metadata**:
   - Enable the 10 ignored tests when features are added

3. **Add More Edge Cases**:
   - Very large files (100MB+)
   - Unusual encodings
   - Malformed metadata

4. **CI/CD Integration**:
   - GitHub Actions for automated testing
   - Coverage reporting to track regressions

## High Priority Features

### 1. Fix Unicode String Handling

- **Issue**: Writing non-ASCII Unicode characters corrupts files
- **Impact**: Critical for international users
- **Tasks**:
  - Investigate string encoding in C++ wrapper
  - Check UTF-8 handling in Emscripten
  - Test with different ID3 versions
  - Update edge case tests when fixed

### 2. Extended Metadata Support

- **MusicBrainz IDs** - Track, album, artist, release group IDs
- **ReplayGain** - Track/album gain and peak values
- **AcoustID** - Audio fingerprint integration
- **Apple Sound Check** - iTunes normalization data
- **Custom Fields** - User-defined metadata fields

### 3. Streaming Support

- Process large files without loading entirely into memory
- Useful for server environments with limited memory
- Enable processing of very large audio files (>100MB)

## Medium Priority Enhancements

### 4. Additional Audio Formats

- **Opus** - Modern codec with growing adoption
- **WavPack** - Lossless compression format
- **APE** - Monkey's Audio lossless format
- **TrueAudio** - Free lossless audio codec
- **MusePack** - High-quality lossy format

### 5. Advanced Picture Support

- Multiple pictures with different types
- Picture compression/optimization
- Format conversion (JPEG ↔ PNG)
- Extraction to files with proper naming
- Batch picture operations

### 6. Performance Optimizations

- WebAssembly SIMD support for faster processing
- Parallel processing for batch operations
- Lazy loading of metadata sections
- Caching for repeated operations
- Smaller WASM bundle size

## Future Directions

### 7. Web Audio API Integration

- **Concept**: Combine Web Audio API decoding with TagLib analysis
- **Benefits**:
  - Use browser's native decoders
  - Smaller WASM size (no decoder bundling)
  - Hardware acceleration
  - Support for any browser-supported format
- **Use Cases**:
  - Client-side ReplayGain calculation
  - Audio visualization with metadata
  - Real-time audio analysis

### 8. ReplayGain Analysis

- **Option A**: Integrate with Web Audio API
  - Leverage browser decoders
  - Implement ITU-R BS.1770 in WASM
  - Calculate gain/peak values

- **Option B**: Port rsgain to WebAssembly
  - Full ReplayGain 2.0 scanner
  - Self-contained solution
  - Works in any environment

### 9. Cloud Integration

- **Cloudflare R2** - Direct integration for large file processing
- **AWS S3** - Streaming from object storage
- **Vercel Blob** - Edge function support
- **Deno KV** - Metadata caching

### 10. Developer Tools

- **CLI Tool** - Command-line interface for batch processing
- **VS Code Extension** - View/edit metadata in editor
- **Online Playground** - Try taglib-wasm in browser
- **Migration Tools** - Convert from other metadata libraries

## Platform-Specific Improvements

### 11. Deno Native Features

- Replace Emscripten wrapper with native WASM loading
- Use Deno's built-in test framework features
- Leverage Deno Deploy for edge processing
- Native TypeScript without compilation

### 12. Node.js Optimizations

- Native Node.js addon for performance-critical paths
- Worker threads for parallel processing
- Stream support for large files
- Better npm package structure

### 13. Browser Enhancements

- Service Worker for offline processing
- WebAssembly streaming compilation
- Progressive Web App example
- File System Access API integration

## Documentation & Community

### 14. Enhanced Documentation

- Video tutorials
- Interactive examples
- API playground
- Migration guides from other libraries
- Performance best practices

### 15. Community Building

- Discord server for support
- Example showcase
- Plugin ecosystem
- Regular release cycle
- Public roadmap

## Technical Debt

### 16. Code Quality

- Increase test coverage to 95%+
- Add mutation testing
- Implement property-based testing
- Static analysis tools
- Performance regression tests

### 17. Build System

- Faster WASM compilation
- Incremental builds
- Better error messages
- Cross-platform build scripts
- Automated releases

## Contributing

Want to help implement these improvements? See our
[Contributing Guide](https://github.com/CharlesWiltgen/taglib-wasm/blob/main/CONTRIBUTING.md) for details on:

- Setting up development environment
- Submitting pull requests
- Coding standards
- Testing requirements

Priority items are marked in the
[BACKLOG.md](https://github.com/CharlesWiltgen/taglib-wasm/blob/main/BACKLOG.md)
file.
