# Embind Migration Guide

This guide shows the differences between the old C-style API and the new Embind-based API.

## Overview

The migration to Embind provides:
- 🎯 **Direct class access** - No more integer IDs or manual memory management
- 🧹 **Automatic cleanup** - JavaScript garbage collection handles object lifetime
- 📝 **Natural API** - Methods look and feel like native JavaScript
- 🔒 **Type safety** - Better TypeScript integration
- 📦 **Smaller code** - ~80% less wrapper code

## API Comparison

### Module Loading

**Old API (C-style):**
```typescript
import { createTagLib } from "taglib-wasm";
const taglib = await createTagLib();
```

**New API (Embind):**
```typescript
import createTagLibModule from "taglib-wasm";
const module = await createTagLibModule();
```

### File Loading

**Old API:**
```typescript
// Allocate memory manually
const dataPtr = module.allocate(buffer, module.ALLOC_NORMAL);
const fileId = module._taglib_file_new_from_buffer(dataPtr, buffer.length);
module._free(dataPtr);
```

**New API:**
```typescript
// Direct object creation
const fileHandle = module.createFileHandle();
const binaryString = Array.from(new Uint8Array(buffer), b => String.fromCharCode(b)).join('');
fileHandle.loadFromBuffer(binaryString);
```

### Tag Access

**Old API:**
```typescript
// Get tag pointer
const tagPtr = module._taglib_file_tag(fileId);

// Read values with manual string conversion
const titlePtr = module._taglib_tag_title(tagPtr);
const title = module.UTF8ToString(titlePtr);

// Write values with manual memory allocation
const newTitlePtr = module.stringToUTF8OnStack("New Title");
module._taglib_tag_set_title(tagPtr, newTitlePtr);
```

**New API:**
```typescript
// Direct method calls
const tag = fileHandle.getTag();
const title = tag.title();
tag.setTitle("New Title");
```

### Audio Properties

**Old API:**
```typescript
const propsPtr = module._taglib_file_audioproperties(fileId);
const duration = module._taglib_audioproperties_length(propsPtr);
const bitrate = module._taglib_audioproperties_bitrate(propsPtr);
```

**New API:**
```typescript
const props = fileHandle.getAudioProperties();
const duration = props.lengthInSeconds();
const bitrate = props.bitrate();
```

### Property Map

**Old API:**
```typescript
// Get properties as JSON string
const jsonPtr = module._taglib_file_properties_json(fileId);
const json = module.UTF8ToString(jsonPtr);
const properties = JSON.parse(json);

// Set property with manual string conversion
const keyPtr = module.stringToUTF8OnStack("CUSTOM");
const valuePtr = module.stringToUTF8OnStack("Value");
module._taglib_file_set_property(fileId, keyPtr, valuePtr);
```

**New API:**
```typescript
// Direct object access
const properties = fileHandle.getProperties();
fileHandle.setProperty("CUSTOM", "Value");
```

### Memory Management

**Old API:**
```typescript
// Manual cleanup required
module._taglib_file_delete(fileId);
// Forgot to free? Memory leak!
```

**New API:**
```typescript
// Automatic cleanup - no action needed
// Objects are cleaned up when they go out of scope
```

## Complete Example

### Old API:
```typescript
async function oldExample() {
  const taglib = await createTagLib();
  const module = taglib.module;
  
  // Load file with manual memory management
  const dataPtr = module.allocate(buffer, module.ALLOC_NORMAL);
  const fileId = module._taglib_file_new_from_buffer(dataPtr, buffer.length);
  module._free(dataPtr);
  
  if (!module._taglib_file_is_valid(fileId)) {
    module._taglib_file_delete(fileId);
    throw new Error("Invalid file");
  }
  
  // Get tag with C-style functions
  const tagPtr = module._taglib_file_tag(fileId);
  const titlePtr = module._taglib_tag_title(tagPtr);
  const title = module.UTF8ToString(titlePtr);
  
  // Set new title
  const newTitlePtr = module.stringToUTF8OnStack("New Title");
  module._taglib_tag_set_title(tagPtr, newTitlePtr);
  
  // Save and cleanup
  module._taglib_file_save(fileId);
  module._taglib_file_delete(fileId);
}
```

### New API:
```typescript
async function newExample() {
  const module = await createTagLibModule();
  
  // Create file handle
  const fileHandle = module.createFileHandle();
  const binaryString = Array.from(new Uint8Array(buffer), b => String.fromCharCode(b)).join('');
  
  if (!fileHandle.loadFromBuffer(binaryString)) {
    throw new Error("Failed to load file");
  }
  
  // Natural API calls
  const tag = fileHandle.getTag();
  const title = tag.title();
  tag.setTitle("New Title");
  
  // Save changes
  fileHandle.save();
  // No cleanup needed!
}
```

## Benefits Summary

1. **Code Reduction**: ~80% less boilerplate code
2. **Type Safety**: Full TypeScript support with proper types
3. **Memory Safety**: No manual memory management
4. **Natural API**: Feels like native JavaScript
5. **Performance**: Direct method calls without C indirection
6. **Maintainability**: Much easier to extend and modify

## Migration Steps

1. Update imports to use the Embind module
2. Replace integer file IDs with FileHandle objects
3. Remove all manual memory management code
4. Update method calls to use the new object-oriented API
5. Remove cleanup code - it's automatic now

## Caveats

1. **Binary String Conversion**: ArrayBuffers must be converted to binary strings for Embind
2. **Module Size**: Embind adds ~50-100KB to the WASM binary
3. **No Raw Pointers**: Direct pointer manipulation is no longer possible (by design)

The new Embind API makes `taglib-wasm` much more pleasant to use while maintaining all the functionality of the original implementation.