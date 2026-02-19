/**
 * Cloudflare Workers API for audio metadata processing at the edge.
 *
 * Uses C-style Emscripten bindings optimized for the Workers environment.
 * Supports basic tags and audio properties; see docs for limitations.
 *
 * @module workers
 *
 * @example
 * ```typescript
 * import { TagLibWorkers } from "@charlesw/taglib-wasm/workers";
 * import wasmBinary from "../build/taglib.wasm";
 *
 * const taglib = await TagLibWorkers.initialize(wasmBinary);
 * using file = taglib.open(audioBuffer);
 * const tag = file.tag();
 * console.log(tag.title, tag.artist);
 * ```
 */

export * from "./src/workers/index.ts";
