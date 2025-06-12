# Implementation Guide

This document provides detailed technical information about the `taglib-wasm` implementation.

## 🏗️ Architecture Overview

The project consists of three main layers:

1. **TagLib C++ Library** (`lib/taglib/`) - The original TagLib v2.1 source
2. **C++ WASM Wrapper** (`build/build-wasm.sh`) - Custom C functions that bridge TagLib to WASM
3. **TypeScript API** (`src/`) - Modern JavaScript/TypeScript interface

## 🔧 Key Technical Solutions

### Memory Management: The Critical Discovery

The most important implementation detail is **proper memory management between JavaScript and WASM**:

#### ❌ What Doesn't Work

```typescript
// Manual memory allocation + copying causes data corruption
const ptr = module._malloc(buffer.length);
module.HEAPU8.set(buffer, ptr); // ← This corrupts data!
```

#### ✅ What Works

```typescript
// Emscripten's allocate() function works reliably
const ptr = module.allocate(buffer, module.ALLOC_NORMAL);
```

**Why**: The manual approach suffers from memory synchronization issues between the JavaScript and WASM memory spaces. Emscripten's `allocate()` function handles this synchronization correctly.

**Impact**: This fix enabled all audio formats to load successfully. Before this, all files appeared as corrupted data (zeros) to the C++ code.

### C++ Wrapper Design

The C++ wrapper (`build/build-wasm.sh`) bridges TagLib's object-oriented C++ API to C functions suitable for WASM:

#### Object Lifetime Management

```cpp
// Global storage for C++ objects
std::map<int, std::unique_ptr<TagLib::FileRef>> g_files;
std::map<int, std::unique_ptr<TagLib::ByteVectorStream>> g_streams;
int g_next_id = 1;

// C function that returns an ID instead of a pointer
extern "C" int taglib_file_new_from_buffer(const char* data, int size) {
    auto buffer = TagLib::ByteVector(data, size);
    auto stream = std::make_unique<TagLib::ByteVectorStream>(buffer);
    auto fileRef = std::make_unique<TagLib::FileRef>(stream.get());
    
    int id = g_next_id++;
    g_streams[id] = std::move(stream);
    g_files[id] = std::move(fileRef);
    return id;
}
```

#### Memory-Based File Processing

```cpp
// Uses ByteVectorStream for in-memory processing
TagLib::ByteVector buffer(data, size);
auto stream = std::make_unique<TagLib::ByteVectorStream>(buffer);
auto fileRef = std::make_unique<TagLib::FileRef>(stream.get());
```

This enables processing audio files entirely in memory without filesystem access.

#### Format Detection and Fallback

```cpp
// Try FileRef first (auto-detection)
auto fileRef = std::make_unique<TagLib::FileRef>(stream.get());

if (fileRef->isNull() || !fileRef->file()) {
    // Fallback: manual format detection
    std::string format = detectFileFormat(data, size);
    
    TagLib::File* specificFile = nullptr;
    if (format == "mp3") {
        specificFile = new TagLib::MPEG::File(stream.get());
    } else if (format == "flac") {
        specificFile = new TagLib::FLAC::File(stream.get());
    }
    // ... handle other formats
}
```

### TypeScript API Design

The TypeScript layer (`src/`) provides a modern async API:

#### Module Initialization

```typescript
class TagLib {
  static async initialize(config?: TagLibConfig): Promise<TagLib> {
    const module = await createWasmModule(config);
    return new TagLib(module);
  }
}
```

#### Safe Object Disposal

```typescript
class AudioFile {
  dispose(): void {
    if (this.fileId !== 0) {
      this.module._taglib_file_delete(this.fileId);
      this.fileId = 0;
    }
  }
}
```

#### String Handling

```typescript
function jsToCString(module: TagLibModule, str: string): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str + "\0");
  return module.allocate(bytes, module.ALLOC_NORMAL); // ← Using allocate()
}
```

## 📦 Build System

### Emscripten Configuration

The build script (`build/build-wasm.sh`) uses specific Emscripten settings:

```bash
emcc \
  # Memory settings
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=16777216 \
  -s MAXIMUM_MEMORY=268435456 \
  
  # Export settings  
  -s EXPORTED_RUNTIME_METHODS='["allocate","ALLOC_NORMAL",...]' \
  -s EXPORTED_FUNCTIONS='["_taglib_file_new_from_buffer",...]' \
  
  # Module settings
  -s MODULARIZE=1 \
  -s EXPORT_NAME="TagLibWASM" \
  -s ENVIRONMENT='web,node'
```

### TagLib Configuration

TagLib is compiled with full format support:

```bash
emcmake cmake "$TAGLIB_DIR" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DWITH_ASF=ON \
  -DWITH_MP4=ON \
  # ... other format flags
```

## 🧪 Testing Strategy

### Systematic Format Testing

The test suite (`test-systematic.ts`) validates:

1. **File Loading**: Can the WASM module load the file?
2. **Format Detection**: Is the format correctly identified?
3. **Audio Properties**: Are bitrate, sample rate, etc. correct?
4. **Tag Reading**: Can existing tags be read?
5. **Tag Writing**: Can new tags be written?
6. **Memory Management**: Are objects properly disposed?

### Test File Structure

```
test-files/
├── wav/kiss-snippet.wav     # Simplest format
├── mp3/kiss-snippet.mp3     # Most common format
├── flac/kiss-snippet.flac   # Lossless format
├── ogg/kiss-snippet.ogg     # Open format
└── mp4/kiss-snippet.m4a     # Container format
```

## 🚧 Known Technical Limitations

### Memory Usage

- Entire files are loaded into memory
- Memory usage = file size + TagLib overhead
- No streaming support (limitation of ByteVectorStream approach)

### File Writing

- Changes only affect in-memory representation
- No automatic persistence to filesystem
- Browser applications need manual download/save

### Threading

- Not thread-safe (JavaScript limitation)
- Multiple files should be processed sequentially

## 🔍 Debugging Tips

### Memory Corruption Issues

If you see data corruption (files appearing as zeros):

1. Check that you're using `allocate()` not `malloc() + HEAPU8.set()`
2. Verify WASM module is fully initialized before use
3. Check that memory isn't freed too early

### Function Export Issues

If functions are "not defined":

1. Verify function is in EXPORTED_FUNCTIONS list
2. Check C function signature matches TypeScript interface
3. Ensure WASM module loaded successfully

### Build Issues

If Emscripten build fails:

1. Check Emscripten SDK installation
2. Verify TagLib dependencies (utfcpp)
3. Check CMake configuration flags

## 📈 Performance Considerations

### Optimization Flags

```bash
-O3                    # Maximum optimization
--closure 1            # Google Closure Compiler
-s ASSERTIONS=0        # Disable runtime checks in production
```

### Memory Management

- Use `dispose()` to free C++ objects promptly
- Consider object pooling for frequent operations
- Monitor memory usage with browser dev tools

### File Size Optimization

- WASM bundle: ~800KB (optimized)
- Supports tree-shaking for unused formats
- Consider format-specific builds for size-critical applications

## 🔄 Future Improvements

### Potential Enhancements

1. **Streaming Support**: Investigate TagLib::IOStream implementations
2. **Worker Thread Support**: Offload processing to Web Workers
3. **Format-Specific Builds**: Smaller bundles for specific use cases
4. **Picture Support**: Add album artwork handling
5. **Automatic Tag Mapping**: Support for custom/proprietary tags

### Performance Optimizations

1. **Lazy Loading**: Load WASM module on first use
2. **Memory Pooling**: Reuse allocated buffers
3. **Batch Processing**: Process multiple files efficiently
4. **Compression**: Compress WASM binary further

---

This implementation represents a complete, production-ready WebAssembly port of TagLib with modern TypeScript bindings. The key discoveries around memory management and C++ wrapper design should be preserved for future development.
