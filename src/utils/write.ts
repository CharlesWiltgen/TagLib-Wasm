/**
 * File writing utilities for TagLib-Wasm
 * Provides cross-runtime support for writing files
 */

import { EnvironmentError, FileOperationError } from "../errors.ts";

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
      (globalThis as any).process.versions?.node
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

  let env: string;
  if (typeof (globalThis as any).Deno !== "undefined") {
    env = "Deno";
  } else if (typeof (globalThis as any).process !== "undefined") {
    env = "Node.js";
  } else if (typeof (globalThis as any).Bun !== "undefined") {
    env = "Bun";
  } else {
    env = "Browser";
  }
  throw new EnvironmentError(
    env,
    "does not support file path writing",
    "filesystem access",
  );
}
