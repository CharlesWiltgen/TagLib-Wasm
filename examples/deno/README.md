# Deno Examples

This directory contains examples specific to Deno usage of TagLib-Wasm.

## Examples

### basic-usage.ts

Basic example showing how to read and write audio metadata using TagLib-Wasm.

```bash
deno run --allow-read basic-usage.ts
```

### offline-compile.ts

Advanced example showing how to use TagLib-Wasm in Deno compiled binaries with
offline support. This is useful for creating standalone executables that don't
require network access.

#### Usage:

1. First, prepare the WASM file for embedding:
   ```bash
   deno run --allow-read --allow-write prepare-offline.ts
   ```

2. Compile your application with the embedded WASM:
   ```bash
   deno compile --allow-read --include taglib.wasm offline-compile.ts
   ```

3. Run the compiled binary:
   ```bash
   ./offline-compile path/to/audio/file.mp3
   ```

The compiled binary will work offline without needing to fetch the WASM file
from the network.

### prepare-offline.ts

Helper script to prepare the WASM file for embedding in compiled binaries. This
copies the WASM file from the TagLib-Wasm package to your local directory.

## Key Features

- **Network Independence**: Compiled binaries can work offline
- **Single Executable**: Everything bundled into one file
- **Fast Startup**: No network fetch required
- **Automatic Detection**: Automatically uses embedded WASM in compiled binaries
