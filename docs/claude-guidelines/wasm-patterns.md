# WebAssembly Patterns

## Memory Management

### Allocation Pattern

Always use try-finally to ensure memory cleanup:

```typescript
export function processWithMemory(data: Uint8Array): Result {
  const ptr = Module._malloc(data.length);

  try {
    // Copy data to Wasm memory
    Module.HEAPU8.set(data, ptr);

    // Process data
    const resultPtr = Module._process(ptr, data.length);

    // Extract result
    return extractResult(resultPtr);
  } finally {
    // Always free memory
    Module._free(ptr);
  }
}
```

### String Handling

```typescript
function stringToWasm(str: string): number {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  const ptr = Module._malloc(encoded.length + 1);

  Module.HEAPU8.set(encoded, ptr);
  Module.HEAPU8[ptr + encoded.length] = 0; // Null terminator

  return ptr;
}

function stringFromWasm(ptr: number): string {
  if (!ptr) return "";

  let len = 0;
  while (Module.HEAPU8[ptr + len] !== 0) len++;

  const decoder = new TextDecoder();
  return decoder.decode(Module.HEAPU8.subarray(ptr, ptr + len));
}
```

## Error Handling

### Module Initialization Check

```typescript
function ensureModuleReady(): void {
  if (!Module || !Module._malloc) {
    throw new Error(
      "WebAssembly module not initialized: Call init() before using the API.",
    );
  }

  if (!Module.HEAPU8) {
    throw new Error("WebAssembly heap not available: Module may be corrupted.");
  }
}
```

### Safe Function Calls

```typescript
export function safeWasmCall<T>(fn: () => T): T {
  ensureModuleReady();

  try {
    return fn();
  } catch (error) {
    if (error instanceof WebAssembly.RuntimeError) {
      throw new Error(`WebAssembly runtime error: ${error.message}`);
    }
    throw error;
  }
}
```

## Performance Patterns

### Batch Processing

```typescript
export function processBatch(items: ArrayBuffer[]): Result[] {
  ensureModuleReady();

  // Allocate once for all items
  const totalSize = items.reduce((sum, item) => sum + item.byteLength, 0);
  const batchPtr = Module._malloc(totalSize);

  try {
    let offset = 0;
    const results: Result[] = [];

    for (const item of items) {
      const view = new Uint8Array(item);
      Module.HEAPU8.set(view, batchPtr + offset);

      const result = Module._processItem(batchPtr + offset, view.length);
      results.push(extractResult(result));

      offset += view.length;
    }

    return results;
  } finally {
    Module._free(batchPtr);
  }
}
```

### Typed Array Usage

```typescript
// Use typed arrays for efficient data transfer
export function processAudioData(samples: Float32Array): Float32Array {
  const ptr = Module._malloc(samples.length * 4); // 4 bytes per float

  try {
    // Direct memory view
    const wasmFloats = new Float32Array(
      Module.HEAPU8.buffer,
      ptr,
      samples.length,
    );

    // Copy data
    wasmFloats.set(samples);

    // Process
    Module._processAudio(ptr, samples.length);

    // Return processed data
    return new Float32Array(wasmFloats);
  } finally {
    Module._free(ptr);
  }
}
```

## Module Lifecycle

### Initialization

```typescript
let moduleInstance: EmscriptenModule | null = null;

export async function init(): Promise<void> {
  if (moduleInstance) return;

  try {
    moduleInstance = await createModule();

    // Verify module is properly loaded
    if (!moduleInstance._malloc || !moduleInstance._free) {
      throw new Error("WebAssembly module missing required exports");
    }
  } catch (error) {
    moduleInstance = null;
    throw new Error(
      `Failed to initialize WebAssembly module: ${error.message}`,
    );
  }
}
```

### Cleanup

```typescript
export function cleanup(): void {
  if (moduleInstance) {
    // Free any remaining allocated memory
    // Reset module state
    moduleInstance = null;
  }
}
```
