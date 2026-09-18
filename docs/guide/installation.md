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

**Requirements:** Node.js v24.0.0 or higher (the Active LTS line)

TagLib-Wasm works out of the box on Node.js — the library automatically falls
back to the Emscripten backend if WASI isn't available, and logs a warning that
names the `--experimental-wasm-exnref` flag. Adding that flag (Node.js 24 LTS)
gets you the WASI backend and its faster path-based I/O. Node.js 25+ supports
exnref natively with no flag needed.

Deno and Bun work without any flags.

#### Running TypeScript

```bash
# Option 1: Node's built-in TypeScript support (native since v23.6)
node --experimental-wasm-exnref your-script.ts

# Option 2: TypeScript loader (recommended)
npm install --save-dev tsx
node --experimental-wasm-exnref --import tsx your-script.ts
```

#### JavaScript (no extra tooling)

```javascript
// The NPM package includes pre-compiled JavaScript
import { TagLib } from "taglib-wasm";
import { applyTags, readTags } from "taglib-wasm/simple";

// No loader or flag needed — same API as TypeScript
const taglib = await TagLib.initialize();
const tags = await readTags("song.mp3");
```

## Runtime Requirements

### Memory Requirements

Each backend declares its memory limits at build time, and the declaration is
fixed — there is no runtime knob to raise it:

- **WASI backend** (Deno, Node.js, Bun): 16 MiB initial, 2 GiB maximum. The
  module declares `--initial-memory=16777216` and `--max-memory=2147483648`
  (`build/build-wasi.sh`).
- **Emscripten backend** (browsers, Web Workers, Cloudflare Workers, plain
  Node.js): memory growth enabled with a 4 GiB ceiling
  (`-s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=4GB`, `build/build-wasm.sh`).
- **Cloudflare Workers**: the platform caps memory at 128 MB per request, which
  you will reach long before either Wasm ceiling.

### Browser Compatibility

Requires a modern browser:

- WebAssembly support
- ES2020 features
- `async`/`await` support

Tested on:

- Chrome 95+
- Firefox 100+
- Safari 15.2+
- Edge 95+

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

### Telling TypeScript About the `browser` Condition

Some entries ship two builds: the barrel (`taglib-wasm`), `taglib-wasm/simple`,
and `taglib-wasm/web` resolve a `browser` export condition, so a
browser-targeted bundler gets a different — smaller, browser-safe — file.
TypeScript resolves that condition only when it is asked to:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "customConditions": ["browser"]
  }
}
```

Without `customConditions`, TypeScript reads the Node declarations while the
bundler ships the browser build. An import that cannot work in a browser —
`scanFolder` from `taglib-wasm`, which walks a filesystem — then compiles
cleanly and fails later, in the bundler. With the condition set, TypeScript uses
`dist/index.browser.d.ts` and the same import is a compile error naming the
missing export (`TS2305`). The pure helpers that do run in a browser
(`groupAlbums`, `discFolderInfo`, `bwf`) still compile from the barrel.

### Bundler Interop

`dist/taglib-wrapper.js`, the Emscripten glue, contains a dynamic
`import("module")` that browser targets have no builtin for, so two bundlers
need one line each: esbuild `--external:module`, and webpack
`externals: { module: "module" }` (webpack `target: "web"` alone fails on it).
Rollup needs nothing extra, and vite externalizes it for the browser with a
warning.

## Import Paths

| Import                    | Exports                                                                                   | Where it runs                                                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taglib-wasm`             | The barrel: Full API, Folder API, ratings, chapters, `bwf`, `groupAlbums`                 | Any runtime, resolving the `browser` condition — in a browser build the filesystem exports (`scanFolder`, `findDuplicates`, …) are absent, which is a compile error naming the export rather than a bundler error |
| `taglib-wasm/simple`      | Simple API: `readTags`, `applyTagsToFile`, batch reads/writes, cover art, media checksums | Any runtime, resolving the `browser` condition                                                                                                                                                                    |
| `taglib-wasm/folder`      | The filesystem Folder API: `scanFolder`, `findDuplicates`, `exportFolderMetadata`         | Deno / Node.js / Bun only. The entry is Node-only by design (no `browser` condition), so a browser-targeted build fails loudly                                                                                    |
| `taglib-wasm/disc-folder` | `groupAlbums`, `discFolderInfo` — pure functions over a scan result                       | Any runtime, browsers included (pure JavaScript)                                                                                                                                                                  |
| `taglib-wasm/web`         | Browser media helpers: `pictureToDataURL`, `dataURLToPicture`, canvas and file helpers    | Any runtime; the `browser` condition resolves an Emscripten-only build that pulls `taglib-web.wasm` alone                                                                                                         |
| `taglib-wasm/rating`      | `RatingUtils` conversions                                                                 | Any runtime (pure JavaScript)                                                                                                                                                                                     |

Importing anything from the barrel does not pull in the Folder or Web API — on
Node.js, Deno and Bun every bundler tree-shakes to leaf granularity (the
pre-bundled browser entries do not shake to a leaf; the README section has the
numbers). The measured per-entry bundle sizes, the export-condition rationale,
and the exact esbuild/rollup/vite/webpack invocations behind these notes live in
the repository README's
[Bundle Size and Tree-Shaking](https://github.com/CharlesWiltgen/TagLib-Wasm#bundle-size-and-tree-shaking)
section.

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
