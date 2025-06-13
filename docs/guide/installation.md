# Installation

## Package Managers

::: code-tabs
@tab Deno
```typescript
import { TagLib } from "jsr:@charleswiltgen/taglib-wasm";
```

@tab Node.js
```bash
npm install taglib-wasm
```

**Note:** The NPM package ships TypeScript source files. Use a TypeScript loader like [`tsx`](https://github.com/privatenumber/tsx):

```bash
npm install --save-dev tsx
npx tsx your-script.ts
```

@tab Bun
```bash
bun add taglib-wasm
```

@tab Browsers
```html
<!-- Use a bundler like Vite, Webpack, or Parcel -->
<script type="module">
  import { TagLib } from 'taglib-wasm';
</script>
```
:::

## Runtime Requirements

### Memory Requirements

TagLib-WASM requires WebAssembly support with sufficient memory:

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

For TypeScript projects, TagLib-WASM includes complete type definitions:

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
console.log("TagLib-WASM initialized successfully!");
```

## Next Steps

- Continue to [Quick Start](./quick-start.md) to write your first code
- See [Runtime Compatibility](/Runtime-Compatibility.md) for platform-specific details