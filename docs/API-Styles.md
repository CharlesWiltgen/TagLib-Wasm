# API Styles Guide

taglib-wasm offers multiple API styles to match different developer preferences and use cases. Choose the one that best fits your needs!

## 🎯 Simple API

**Best for:** Quick scripts, simple use cases, developers who value simplicity

Inspired by [go-taglib](https://github.com/sentriz/go-taglib)'s excellent developer experience, this API provides just 3 main functions.

```typescript
import { readTags, writeTags, readProperties } from "taglib-wasm/simple";

// Read tags
const tags = await readTags("song.mp3");
console.log(tags.album);

// Write tags  
await writeTags("song.mp3", { 
  album: "New Album",
  artist: "New Artist" 
});

// Read properties
const props = await readProperties("song.mp3");
console.log(`Duration: ${props.length}s`);
```

**Pros:**
- Dead simple - just 3 functions to remember
- Auto-initialization handled for you
- Works with file paths or buffers
- Automatic resource cleanup

**Cons:**
- Less control over memory management
- Can't reuse TagLib instance across operations
- Limited to basic tag operations

## 🚀 Auto-Initializing API

**Best for:** Applications that need more control but want zero configuration

```typescript
import { TagLib, withFile } from "taglib-wasm/auto";

// Direct usage - no initialization needed
const file = await TagLib.openFile("song.mp3");
console.log(file.tag().title);
file.dispose();

// Or use the withFile helper for automatic cleanup
const result = await withFile("song.mp3", file => ({
  title: file.tag().title,
  format: file.format(),
  duration: file.audioProperties().length
}));
```

**Pros:**
- No initialization boilerplate
- Full access to all TagLib features
- Convenient `withFile` helper for auto-disposal
- Lazy initialization on first use

**Cons:**
- Still requires manual `dispose()` (unless using `withFile`)
- Slightly less efficient for batch operations

## ⛓️ Fluent API

**Best for:** Developers who love method chaining, batch operations

```typescript
import { TagLib } from "taglib-wasm/fluent";

// Chain operations
await TagLib
  .fromFile("song.mp3")
  .setTitle("Chained Title")
  .setArtist("Chained Artist")
  .setAlbum("Chained Album")
  .save();

// Quick operations
const tags = await TagLib.read("song.mp3");
const props = await TagLib.properties("song.mp3");

// Batch processing
const results = await TagLib.batch(files, async file => {
  await file.setAlbum("Batch Album").save();
  return file.getTags();
});
```

**Pros:**
- Elegant, readable code through chaining
- Built-in batch processing support
- Terminal operations handle cleanup automatically
- Quick static methods for common operations

**Cons:**
- Need to understand terminal vs non-terminal operations
- Less flexibility for complex workflows

## 🎛️ Traditional API

**Best for:** Maximum control, existing TagLib users, complex applications

```typescript
import { TagLib } from "taglib-wasm";

// Full control over initialization
const taglib = await TagLib.initialize({
  debug: true,
  memory: {
    initial: 32 * 1024 * 1024,
    maximum: 128 * 1024 * 1024
  }
});

// Manual resource management
const file = taglib.openFile(audioData);
try {
  // Full access to all features
  const tags = file.tag();
  const props = file.audioProperties();
  
  // Advanced operations
  file.setExtendedTag({
    acoustidFingerprint: "...",
    musicbrainzTrackId: "..."
  });
  
  file.save();
} finally {
  file.dispose();
}
```

**Pros:**
- Complete control over memory and initialization
- Access to all advanced features
- Can optimize for specific use cases
- Familiar to TagLib C++ users

**Cons:**
- More boilerplate code
- Manual resource management required
- Need to handle initialization

## 🤔 Which API Should I Use?

### Use Simple API if:
- You're writing quick scripts
- You just need basic tag reading/writing
- You value simplicity over features
- You're coming from go-taglib

### Use Auto API if:
- You want full features without boilerplate
- You're building a larger application
- You need advanced metadata features
- You want automatic initialization

### Use Fluent API if:
- You love method chaining
- You're doing batch operations
- You want readable, expressive code
- You're processing many files

### Use Traditional API if:
- You need maximum control
- You're optimizing for performance
- You're building a complex application
- You're familiar with TagLib C++

## 📊 API Comparison

| Feature | Simple | Auto | Fluent | Traditional |
|---------|--------|------|--------|-------------|
| Functions/Methods | 3 | All | All | All |
| Auto-init | ✅ | ✅ | ✅ | ❌ |
| Auto-cleanup | ✅ | Partial* | ✅** | ❌ |
| Method chaining | ❌ | ❌ | ✅ | ❌ |
| Batch operations | ❌ | ❌ | ✅ | ❌ |
| Advanced metadata | ❌ | ✅ | ✅ | ✅ |
| Memory control | ❌ | Limited | Limited | ✅ |
| Learning curve | Minimal | Low | Medium | High |

\* Auto API provides `withFile` helper for automatic cleanup  
\*\* Fluent API auto-cleans on terminal operations

## 🔄 Migrating Between APIs

All APIs work with the same underlying TagLib implementation, so you can mix and match as needed:

```typescript
// Start simple
import { readTags } from "taglib-wasm/simple";
const tags = await readTags("song.mp3");

// Need more features? Switch to auto
import { TagLib } from "taglib-wasm/auto";
const file = await TagLib.openFile("song.mp3");
file.setExtendedTag({ bpm: 120 });
file.dispose();

// Want chaining? Use fluent
import { TagLib as FluentTagLib } from "taglib-wasm/fluent";
await FluentTagLib
  .fromFile("song.mp3")
  .setExtendedTags({ compilation: true })
  .save();
```

## 📚 Examples

See the `examples/` directory for complete examples of each API style:
- `examples/simple-api.ts` - Simple API examples
- `examples/auto-api.ts` - Auto-initializing API examples  
- `examples/fluent-api.ts` - Fluent API examples
- `examples/basic-usage.ts` - Traditional API examples