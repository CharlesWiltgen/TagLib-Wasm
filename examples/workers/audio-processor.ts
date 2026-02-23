/**
 * @fileoverview Cloudflare Workers example for processing audio metadata
 */

import { processAudioMetadata, TagLibWorkers } from "taglib-wasm/workers";
import type { AudioFormat, AudioProperties, Tag } from "taglib-wasm/workers";

// In a real Workers deployment, you would import the WASM binary like this:
// import wasmBinary from "../../build/taglib.wasm";

// For this example, we'll assume the WASM binary is provided via environment
// or bundled by your build process (Wrangler, etc.)

/**
 * Example Cloudflare Worker that processes audio file metadata
 *
 * Usage:
 * POST /metadata - Upload audio file and get metadata
 * GET / - Basic info endpoint
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for browser requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Basic info endpoint
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        service: "TagLib-Wasm Audio Processor",
        version: "1.0.0",
        endpoints: {
          "POST /metadata": "Upload audio file to extract metadata",
          "POST /metadata/batch": "Process multiple audio files",
        },
        supportedFormats: ["MP3", "MP4", "M4A", "FLAC", "OGG", "WAV"],
      }, { headers: corsHeaders });
    }

    // Single file metadata extraction
    if (request.method === "POST" && url.pathname === "/metadata") {
      try {
        // Get WASM binary (this would need to be provided by your build process)
        const wasmBinary = await getWasmBinary(env);

        // Get audio data from request
        const audioData = new Uint8Array(await request.arrayBuffer());

        if (audioData.length === 0) {
          return Response.json(
            { error: "No audio data provided" },
            { status: 400, headers: corsHeaders },
          );
        }

        // Process the audio file
        const result = await processAudioMetadata(wasmBinary, audioData, {
          debug: false, // Set to true for debugging in Workers
          memory: {
            initial: 8 * 1024 * 1024, // 8MB
            maximum: 32 * 1024 * 1024, // 32MB (conservative for Workers)
          },
        });

        // Return metadata with performance info
        return Response.json({
          success: true,
          metadata: {
            tag: result.tag,
            audioProperties: result.properties,
            format: result.format,
          },
          fileSize: audioData.length,
          timestamp: new Date().toISOString(),
        }, { headers: corsHeaders });
      } catch (error) {
        console.error("Error processing audio file:", error);
        return Response.json({
          error: "Failed to process audio file",
          message: (error as Error).message,
        }, {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // Batch processing endpoint
    if (request.method === "POST" && url.pathname === "/metadata/batch") {
      try {
        const wasmBinary = await getWasmBinary(env);

        // Parse multipart form data or JSON array
        const contentType = request.headers.get("content-type") || "";

        let results: Array<{
          filename?: string;
          metadata?: {
            tag: Tag;
            audioProperties: AudioProperties | null;
            format: AudioFormat;
          };
          error?: string;
        }> = [];

        if (contentType.includes("application/json")) {
          // Expect JSON array of base64-encoded files
          const files = await request.json() as Array<{
            filename: string;
            data: string; // base64
          }>;

          for (const file of files) {
            try {
              const audioData = Uint8Array.from(
                atob(file.data),
                (c) => c.charCodeAt(0),
              );
              const metadata = await processAudioMetadata(
                wasmBinary,
                audioData,
              );
              results.push({ filename: file.filename, metadata });
            } catch (error) {
              results.push({
                filename: file.filename,
                error: (error as Error).message,
              });
            }
          }
        } else {
          return Response.json({
            error:
              "Batch processing requires JSON format with base64-encoded files",
          }, { status: 400, headers: corsHeaders });
        }

        return Response.json({
          success: true,
          results,
          processed: results.length,
          timestamp: new Date().toISOString(),
        }, { headers: corsHeaders });
      } catch (error) {
        console.error("Error in batch processing:", error);
        return Response.json({
          error: "Batch processing failed",
          message: (error as Error).message,
        }, {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // Default 404 response
    return Response.json({
      error: "Not found",
      message: `${request.method} ${url.pathname} not supported`,
    }, {
      status: 404,
      headers: corsHeaders,
    });
  },
};

/**
 * Get the WASM binary from environment, KV storage, or bundle
 * In a real deployment, you would:
 * 1. Bundle the WASM with your Worker using Wrangler
 * 2. Store it in KV storage
 * 3. Fetch it from R2 or external URL
 */
async function getWasmBinary(env: Env): Promise<Uint8Array> {
  // Option 1: From KV storage
  if (env.TAGLIB_WASM_KV) {
    const wasmData = await env.TAGLIB_WASM_KV.get("taglib.wasm", "arrayBuffer");
    if (wasmData) {
      return new Uint8Array(wasmData);
    }
  }

  // Option 2: From R2 bucket
  if (env.ASSETS_BUCKET) {
    const obj = await env.ASSETS_BUCKET.get("taglib.wasm");
    if (obj) {
      return new Uint8Array(await obj.arrayBuffer());
    }
  }

  // Option 3: From external URL (not recommended for production)
  if (env.WASM_URL) {
    const response = await fetch(env.WASM_URL);
    if (response.ok) {
      return new Uint8Array(await response.arrayBuffer());
    }
  }

  // Option 4: Bundled with Worker (requires Wrangler configuration)
  // This would typically be handled by your build process
  throw new Error(
    "WASM binary not available. Please configure TAGLIB_WASM_KV, ASSETS_BUCKET, " +
      "or WASM_URL environment variables, or bundle the WASM with your Worker.",
  );
}

/**
 * Environment interface for type safety
 */
interface Env {
  // Optional KV namespace for storing WASM binary
  TAGLIB_WASM_KV?: KVNamespace;

  // Optional R2 bucket for assets
  ASSETS_BUCKET?: R2Bucket;

  // Optional external URL for WASM binary
  WASM_URL?: string;
}
