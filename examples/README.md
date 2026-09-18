# TagLib-Wasm Examples

Examples demonstrating TagLib-Wasm usage across different JavaScript runtimes.

📚
**[View the full Examples Guide](https://charleswiltgen.github.io/TagLib-Wasm/guide/examples.html)**
in our documentation for detailed instructions and code samples.

## Quick Start

```bash
# Run with Deno
deno run --allow-read examples/common/basic-usage.ts

# Run with Node.js  
npx tsx examples/common/basic-usage.ts

# Run with Bun
bun examples/common/basic-usage.ts
```

## Directory Structure

- `common/` - Runtime-agnostic examples
- `browser/` - Browser-specific examples
- `bun/` - Bun examples
- `deno/` - Deno examples
- `deno-compile/` - Deno compiled-binary examples
- `*.ts` (top level) - Standalone scripts over the repo source; run with
  `deno run`
