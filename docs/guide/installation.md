# Installation

## Package Managers

::: code-group

```typescript [Deno (JSR)]
import { TagLib } from "@charlesw/taglib-wasm";
```

```typescript [Deno (NPM)]
import { TagLib } from "npm:taglib-wasm";
```

```bash [Node.js]
npm install taglib-wasm
```

```bash [Bun]
bun add taglib-wasm
```

```html [Browser]
<!-- Use a bundler like Vite, Webpack, or Parcel -->
<script type="module">
  import { TagLib } from "taglib-wasm";
</script>
```

:::

### Node.js Requirements

**Requirements:** Node.js v22.6.0 or higher

Node.js requires the `--experimental-wasm-exnref` flag for TagLib-Wasm's Wasm
exception handling. Deno and Bun work without any flags.

#### TypeScript Usage

```bash
# Option 1: Node's experimental TypeScript support (v22.6.0+)
node --experimental-wasm-exnref --experimental-strip-types your-script.ts

# Option 2: TypeScript loader (recommended)
npm install --save-dev tsx
node --experimental-wasm-exnref --import tsx your-script.ts
```

#### JavaScript Usage

```javascript
// The NPM package includes pre-compiled JavaScript
import { TagLib } from "taglib-wasm";
import { applyTagsToBuffer, readTags } from "taglib-wasm/simple";

// Works the same as TypeScript
const taglib = await TagLib.initialize();
const tags = await readTags("song.mp3");
```

## Runtime Requirements

### Memory Requirements

TagLib-Wasm requires WebAssembly support with sufficient memory:

- **Default**: 16MB initial, 256MB maximum
- **Cloudflare Workers**: 8MB recommended initial size
- **Large files**: May need increased maximum memory

### Browser Compatibility

Requires modern browser with:

- WebAssembly support
- ES2020 features
- `async`/`await` support

Tested on:

- Chrome 90+
- Firefox 89+
- Safari 14.1+
- Edge 90+

## TypeScript Configuration

For TypeScript projects, TagLib-Wasm includes complete type definitions:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"]
  }
}
```

## Verification

Verify your installation:

```typescript
import { TagLib } from "taglib-wasm";

const taglib = await TagLib.initialize();
console.log("TagLib-Wasm initialized successfully!");
```

## Next Steps

- Continue to [Quick Start](./quick-start.md) to write your first code
- See [Runtime Compatibility](/concepts/runtime-compatibility) for
  platform-specific details
