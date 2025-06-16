# Examples

This guide provides an overview of all available examples in the taglib-wasm repository and how to run them.

## Example Repository Structure

All examples are located in the `/examples` directory:

```
examples/
├── common/           # Runtime-agnostic examples
├── browser/          # Browser-specific examples
├── node/             # Node.js-specific examples  
├── bun/              # Bun runtime examples
├── deno/             # Deno runtime examples
└── workers/          # Cloudflare Workers examples
```

## Common Examples

These examples work across all JavaScript runtimes:

### Basic Usage (`basic-usage.ts`)

Demonstrates fundamental operations:
- Opening audio files
- Reading basic tags (title, artist, album, etc.)
- Writing/updating tags
- Reading audio properties
- Proper cleanup with `dispose()`

```bash
# Run with Deno
deno run --allow-read --allow-write examples/common/basic-usage.ts

# Run with Bun
bun examples/common/basic-usage.ts

# Run with Node.js (using tsx)
npx tsx examples/common/basic-usage.ts
```

### Simple API (`simple-api.ts`)

Shows the high-level Simple API:
- `readTags()` - Read all tags at once
- `writeTags()` - Update tags and get modified buffer
- `updateTags()` - Update tags in-place
- `readProperties()` - Get audio properties

This is the easiest way to use taglib-wasm for common tasks.

### Tag Constants (`tag-constants.ts`)

Demonstrates type-safe tag constants:
- Using the `Tags` object for IDE autocomplete
- Reading extended metadata fields
- Writing format-specific tags
- Cross-format tag mapping

### Automatic Tag Mapping (`automatic-tag-mapping.ts`)

Shows how taglib-wasm handles format differences:
- Writing the same tags to different formats
- Format-specific field mapping
- PropertyMap API for extended metadata

### ReplayGain & Sound Check (`replaygain-soundcheck.ts`)

Volume normalization metadata:
- Reading/writing ReplayGain tags
- Apple Sound Check (iTunNORM) support
- Converting between different normalization formats

### Cover Art (`cover-art.ts`)

Comprehensive picture/artwork handling:
- Reading embedded pictures
- Setting cover art from files
- Managing multiple picture types
- Format-specific limitations

### Embind API (`embind-example.ts`)

Low-level API usage:
- Direct access to C++ bindings
- Manual memory management
- Advanced use cases

## Runtime-Specific Examples

### Browser Examples

Located in `examples/browser/`:

#### Cover Art Canvas (`cover-art-canvas.html`)

Complete HTML example showing:
- File input handling
- Displaying cover art in `<img>` tags
- Canvas manipulation
- Downloading modified files

To run:
1. Open the HTML file in a modern browser
2. Or serve with: `npx serve examples/browser`

### Cloudflare Workers

Located in `examples/workers/`:

#### Audio Processor (`audio-processor.ts`)

Complete Workers application:
- POST endpoint for metadata extraction
- Memory-optimized configuration
- Error handling
- JSON response format

To run:
```bash
cd examples/workers
npm install
npm run dev  # Start local development server
```

## Running Examples

### Prerequisites

1. Clone the repository
2. Install dependencies (if needed)
3. Have sample audio files ready

### Quick Start Commands

```bash
# Clone the repo
git clone https://github.com/CharlesWiltgen/taglib-wasm.git
cd taglib-wasm

# Run a common example with Deno
deno run --allow-read --allow-write examples/common/simple-api.ts

# Run with Bun
bun examples/common/simple-api.ts

# Run with Node.js
npx tsx examples/common/simple-api.ts
```

### Using Your Own Audio Files

Most examples look for test files in `tests/test-files/`. You can:

1. Use the provided test files
2. Modify examples to use your own files
3. Pass file paths as command line arguments (some examples support this)

## Example Patterns

### Error Handling Pattern

```typescript
import { TagLib, isTagLibError } from "taglib-wasm";

try {
  const taglib = await TagLib.initialize();
  const file = await taglib.open("song.mp3");
  // ... work with file
  file.dispose();
} catch (error) {
  if (isTagLibError(error)) {
    console.error(`TagLib error (${error.code}): ${error.message}`);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

### Memory Management Pattern

```typescript
const taglib = await TagLib.initialize();
const file = await taglib.open("song.mp3");

try {
  // Always wrap operations in try/finally
  const tags = file.tag();
  tags.setTitle("New Title");
  file.save();
} finally {
  // Ensure cleanup happens
  file.dispose();
}
```

### Batch Processing Pattern

```typescript
import { updateTags } from "taglib-wasm/simple";

const files = ["song1.mp3", "song2.mp3", "song3.mp3"];

for (const filePath of files) {
  await updateTags(filePath, {
    album: "My Compilation",
    albumArtist: "Various Artists",
    compilation: true,
  });
  console.log(`Updated: ${filePath}`);
}
```

## Creating Your Own Examples

When creating examples:

1. **Import correctly** - Use `"taglib-wasm"` in your own projects
2. **Handle errors** - Always wrap in try/catch
3. **Clean up** - Call `dispose()` on AudioFile objects
4. **Document** - Add comments explaining what you're doing
5. **Test** - Verify on multiple runtimes if possible

## Common Use Cases

### Music Library Scanner

```typescript
import { readTags, readProperties } from "taglib-wasm/simple";
import { glob } from "glob";

const musicFiles = await glob("~/Music/**/*.{mp3,m4a,flac}");
const library = [];

for (const file of musicFiles) {
  const tags = await readTags(file);
  const props = await readProperties(file);
  
  library.push({
    path: file,
    ...tags,
    duration: props.length,
    bitrate: props.bitrate,
  });
}

console.log(`Scanned ${library.length} tracks`);
```

### Metadata Fixer

```typescript
import { updateTags } from "taglib-wasm/simple";

async function fixTrackNumbers(albumPath: string) {
  const files = await glob(`${albumPath}/*.mp3`);
  
  for (let i = 0; i < files.length; i++) {
    await updateTags(files[i], {
      track: i + 1,
      trackTotal: files.length,
    });
  }
}
```

### Format Converter Helper

```typescript
import { readTags, writeTags } from "taglib-wasm/simple";

async function copyMetadata(sourceFile: string, targetFile: string) {
  // Read all metadata from source
  const metadata = await readTags(sourceFile);
  
  // Write to target (different format)
  await writeTags(targetFile, metadata);
  
  console.log(`Copied metadata from ${sourceFile} to ${targetFile}`);
}
```

## Additional Resources

- [API Reference](../API.md) - Complete API documentation
- [Simple API Guide](./quick-start.md) - Getting started guide
- [Error Handling](../Error-Handling.md) - Error types and handling
- [GitHub Repository](https://github.com/CharlesWiltgen/taglib-wasm) - Source code and issues

## Contributing Examples

We welcome example contributions! To contribute:

1. Create your example in the appropriate directory
2. Follow the existing naming conventions
3. Include clear comments and documentation
4. Test on multiple runtimes if possible
5. Submit a pull request

Good examples should:
- Demonstrate a specific use case
- Include error handling
- Be well-commented
- Work across multiple runtimes (when possible)
- Follow TypeScript best practices