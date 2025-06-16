/**
 * File reading utilities for taglib-wasm
 * Provides cross-runtime support for reading files from various sources
 */

import { EnvironmentError, FileOperationError } from "../errors.ts";

/**
 * Read a file's data from various sources.
 * Supports file paths (Node.js/Deno/Bun), buffers, and File objects (browser).
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @returns Promise resolving to Uint8Array of file data
 * @throws {FileOperationError} If file read fails
 * @throws {EnvironmentError} If environment doesn't support file paths
 */
export async function readFileData(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<Uint8Array> {
  // Already a Uint8Array
  if (file instanceof Uint8Array) {
    return file;
  }

  // ArrayBuffer - convert to Uint8Array
  if (file instanceof ArrayBuffer) {
    return new Uint8Array(file);
  }

  // File object (browser)
  if (typeof File !== "undefined" && file instanceof File) {
    return new Uint8Array(await file.arrayBuffer());
  }

  // String path - read from filesystem
  if (typeof file === "string") {
    try {
      // Deno
      if (typeof Deno !== "undefined") {
        return await Deno.readFile(file);
      }

      // Node.js
      if (
        typeof process !== "undefined" && process.versions &&
        process.versions.node
      ) {
        const { readFile } = await import("fs/promises");
        return new Uint8Array(await readFile(file));
      }

      // Bun
      if (typeof (globalThis as any).Bun !== "undefined") {
        const bunFile = (globalThis as any).Bun.file(file);
        return new Uint8Array(await bunFile.arrayBuffer());
      }
    } catch (error) {
      // Convert system file errors to FileOperationError
      throw new FileOperationError(
        "read",
        (error as Error).message,
        file
      );
    }

    const env = typeof Deno !== "undefined" ? "Deno" :
                typeof process !== "undefined" ? "Node.js" :
                typeof (globalThis as any).Bun !== "undefined" ? "Bun" :
                "Browser";
    throw new EnvironmentError(
      env,
      "does not support file path reading",
      "filesystem access"
    );
  }

  const inputType = Object.prototype.toString.call(file);
  throw new FileOperationError(
    "read",
    `Invalid file input type: ${inputType}. Expected string path, Uint8Array, ArrayBuffer, or File object.`
  );
}