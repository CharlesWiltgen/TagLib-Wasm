/**
 * File writing utilities for taglib-wasm
 * Provides cross-runtime support for writing files
 */

import { EnvironmentError, FileOperationError } from "../errors.ts";
import process from "node:process";

/**
 * Write data to a file across different runtimes.
 * Supports Node.js, Deno, and Bun environments.
 *
 * @param path - File path to write to
 * @param data - Data to write (Uint8Array)
 * @throws {FileOperationError} If file write fails
 * @throws {EnvironmentError} If environment doesn't support file writing
 */
export async function writeFileData(
  path: string,
  data: Uint8Array,
): Promise<void> {
  try {
    // Deno
    if (typeof (globalThis as any).Deno !== "undefined") {
      await (globalThis as any).Deno.writeFile(path, data);
      return;
    }

    // Node.js
    if (
      typeof (globalThis as any).process !== "undefined" &&
      (globalThis as any).process.versions &&
      (globalThis as any).process.versions.node
    ) {
      const { writeFile } = await import("fs/promises");
      await writeFile(path, data);
      return;
    }

    // Bun
    if (typeof (globalThis as any).Bun !== "undefined") {
      await (globalThis as any).Bun.write(path, data);
      return;
    }
  } catch (error) {
    // Convert system file errors to FileOperationError
    throw new FileOperationError(
      "write",
      (error as Error).message,
      path,
    );
  }

  const env = typeof (globalThis as any).Deno !== "undefined"
    ? "Deno"
    : typeof (globalThis as any).process !== "undefined"
    ? "Node.js"
    : typeof (globalThis as any).Bun !== "undefined"
    ? "Bun"
    : "Browser";
  throw new EnvironmentError(
    env,
    "does not support file path writing",
    "filesystem access",
  );
}
