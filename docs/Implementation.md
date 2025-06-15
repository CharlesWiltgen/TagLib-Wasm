# Implementation Guide

This document provides detailed technical information about the `taglib-wasm` implementation.

> **Note**: This project has been migrated from a C-style wrapper with manual memory management to use Emscripten's Embind for cleaner, more maintainable bindings. The current implementation leverages Embind's automatic memory management and direct object access capabilities.

## 🏗️ Architecture Overview

The project consists of three main layers:

1. **TagLib C++ Library** (`lib/taglib/`) - The original TagLib v2.1 source
2. **C++ Wasm Wrapper** (`build/build-wasm.sh`) - Embind-based C++ bindings for Wasm
3. **TypeScript API** (`src/`) - Modern JavaScript/TypeScript interface

## 🔧 Key Technical Solutions

### Emscripten Embind Integration

The project uses **Emscripten's Embind** to create JavaScript bindings for TagLib's C++ API. This provides:

- **Automatic memory management** - No manual memory allocation/deallocation needed
- **Direct object access** - JavaScript can work with C++ objects naturally
- **Type safety** - Strong typing between C++ and JavaScript
- **Clean API** - No need for C-style wrapper functions

### C++ Wrapper Design

The C++ wrapper (`build/build-wasm.sh`) uses Embind to expose TagLib's classes directly:

#### Class Bindings

```cpp
// Expose TagLib classes to JavaScript using Embind
EMSCRIPTEN_BINDINGS(taglib_bindings) {
    // ByteVectorStream for in-memory file processing
    class_<ByteVectorStream>("ByteVectorStream")
        .constructor<const std::string&>()
        .function("name", &ByteVectorStream::name)
        .function("readBlock", &ByteVectorStream::readBlock)
        .function("seek", &ByteVectorStream::seek);
    
    // FileRef - main entry point for file operations
    class_<FileRef>("FileRef")
        .constructor<ByteVectorStream*>()
        .function("isValid", &FileRef::isValid)
        .function("save", &FileRef::save)
        .function("file", &FileRef::file, allow_raw_pointers())
        .function("tag", &FileRef::tag, allow_raw_pointers())
        .function("audioProperties", &FileRef::audioProperties, allow_raw_pointers());
    
    // Tag class for metadata operations
    class_<Tag>("Tag")
        .function("title", &Tag::title)
        .function("artist", &Tag::artist)
        .function("album", &Tag::album)
        .function("setTitle", &Tag::setTitle)
        .function("setArtist", &Tag::setArtist)
        .function("setAlbum", &Tag::setAlbum);
}
```

#### Memory-Based File Processing

```cpp
// ByteVectorStream wrapper for in-memory processing
class ByteVectorStream : public TagLib::IOStream {
    TagLib::ByteVector data;
public:
    ByteVectorStream(const std::string& buffer) 
        : data(buffer.data(), buffer.size()) {}
    
    // IOStream implementation for memory-based operations
    TagLib::ByteVector readBlock(size_t length) override;
    void writeBlock(const TagLib::ByteVector &data) override;
    void seek(long offset, Position p = Beginning) override;
};
```

#### Format Detection

```cpp
// Automatic format detection helper
std::string detectFormat(const std::string& data) {
    if (data.size() < 12) return "";
    
    // Check magic bytes for each format
    if (data.substr(0, 4) == "RIFF" && data.substr(8, 4) == "WAVE") return "wav";
    if (data[0] == 'I' && data[1] == 'D' && data[2] == '3') return "mp3";
    if (data[0] == (char)0xFF && (data[1] & 0xE0) == 0xE0) return "mp3";
    if (data.substr(0, 4) == "fLaC") return "flac";
    if (data.substr(0, 4) == "OggS") return "ogg";
    if (data.substr(4, 4) == "ftyp") return "mp4";
    
    return "";
}
```

### TypeScript API Design

The TypeScript layer (`src/`) provides a modern async API that wraps the Embind-exposed classes:

#### Module Initialization

```typescript
class TagLib {
  static async initialize(config?: TagLibConfig): Promise<TagLib> {
    const module = await createWasmModule(config);
    return new TagLib(module);
  }
}
```

#### Safe Object Management

```typescript
class AudioFile {
  private stream?: any;  // ByteVectorStream instance
  private fileRef?: any; // FileRef instance
  
  constructor(module: TagLibModule, buffer: Uint8Array) {
    // Convert buffer to string for Embind
    const dataStr = Array.from(buffer)
      .map(byte => String.fromCharCode(byte))
      .join('');
    
    // Create C++ objects via Embind
    this.stream = new module.ByteVectorStream(dataStr);
    this.fileRef = new module.FileRef(this.stream);
  }
  
  dispose(): void {
    // Embind objects are automatically cleaned up
    // when JavaScript references are garbage collected
    this.stream = undefined;
    this.fileRef = undefined;
  }
}
```

#### Type-Safe Tag Access

```typescript
// TypeScript interfaces match C++ API
interface Tags {
  title?: string;
  artist?: string;
  album?: string;
  // ... other properties
}

// Direct access to C++ objects through Embind
const tag = this.fileRef.tag();
const tags: Tags = {
  title: tag.title(),
  artist: tag.artist(),
  album: tag.album(),
};
```

## 📦 Build System

### Emscripten Configuration

The build script (`build/build-wasm.sh`) uses specific Emscripten settings:

```bash
emcc \
  # Memory settings
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MAXIMUM_MEMORY=1GB \
  -s STACK_SIZE=1MB \
  
  # Embind and runtime exports
  --bind \
  -s EXPORTED_RUNTIME_METHODS='["FS","UTF8ToString","stringToUTF8","lengthBytesUTF8"]' \
  
  # Module settings
  -s MODULARIZE=1 \
  -s EXPORT_NAME="TagLibWasm" \
  -s ENVIRONMENT='web,webview,node,shell' \
  
  # Optimization
  -O3 \
  --closure 1 \
  -s ASSERTIONS=0
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

1. **File Loading**: Can the Wasm module load the file?
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

### Embind Object Issues

If you encounter "undefined is not a function" errors:

1. Ensure the Wasm module is fully initialized before creating objects
2. Check that Embind classes are properly exposed in C++
3. Verify the `--bind` flag is used in Emscripten compilation

### Memory Issues

With Embind, memory is managed automatically, but watch for:

1. Large file buffers that may exceed browser memory limits
2. Keeping references to disposed objects
3. String conversion overhead for large binary data

### Type Conversion Issues

If data appears corrupted:

1. Check binary-to-string conversion for file buffers
2. Verify UTF-8 encoding for text strings
3. Ensure proper handling of null/undefined values

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

- Embind handles memory automatically for most cases
- Call `dispose()` to explicitly release large objects early
- Monitor memory usage with browser dev tools
- Be mindful of string conversion overhead for large buffers

### File Size Optimization

- Wasm bundle: ~800KB (optimized)
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

1. **Lazy Loading**: Load Wasm module on first use
2. **Memory Pooling**: Reuse allocated buffers
3. **Batch Processing**: Process multiple files efficiently
4. **Compression**: Compress Wasm binary further

---

This implementation represents a complete, production-ready WebAssembly port of TagLib with modern TypeScript bindings. The migration to Embind has significantly simplified the codebase while maintaining full functionality and improving maintainability.
