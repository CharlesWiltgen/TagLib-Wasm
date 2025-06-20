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
    // Check environment support first
    const hasDeno = typeof (globalThis as any).Deno !== "undefined";
    const hasNode = typeof (globalThis as any).process !== "undefined" &&
      (globalThis as any).process.versions &&
      (globalThis as any).process.versions.node;
    const hasBun = typeof (globalThis as any).Bun !== "undefined";

    // If no runtime supports filesystem, throw EnvironmentError
    if (!hasDeno && !hasNode && !hasBun) {
      const env = "Browser";
      throw new EnvironmentError(
        env,
        "does not support file path reading",
        "filesystem access",
      );
    }

    try {
      // Deno
      if (hasDeno) {
        return await (globalThis as any).Deno.readFile(file);
      }

      // Node.js
      if (hasNode) {
        const { readFile } = await import("fs/promises");
        return new Uint8Array(await readFile(file));
      }

      // Bun
      if (hasBun) {
        const bunFile = (globalThis as any).Bun.file(file);
        return new Uint8Array(await bunFile.arrayBuffer());
      }
    } catch (error) {
      // Convert system file errors to FileOperationError
      throw new FileOperationError(
        "read",
        (error as Error).message,
        file,
      );
    }
  }

  const inputType = Object.prototype.toString.call(file);
  throw new FileOperationError(
    "read",
    `Invalid file input type: ${inputType}. Expected string path, Uint8Array, ArrayBuffer, or File object.`,
  );
}

/**
 * Get the size of a file without reading its contents.
 *
 * @param path - File path
 * @returns Promise resolving to file size in bytes
 * @throws {FileOperationError} If file stat fails
 * @throws {EnvironmentError} If environment doesn't support file paths
 */
export async function getFileSize(path: string): Promise<number> {
  const hasDeno = typeof (globalThis as any).Deno !== "undefined";
  const hasNode = typeof (globalThis as any).process !== "undefined" &&
    (globalThis as any).process.versions &&
    (globalThis as any).process.versions.node;
  const hasBun = typeof (globalThis as any).Bun !== "undefined";

  if (!hasDeno && !hasNode && !hasBun) {
    throw new EnvironmentError(
      "Browser",
      "does not support file path operations",
      "filesystem access",
    );
  }

  try {
    // Deno
    if (hasDeno) {
      const stat = await (globalThis as any).Deno.stat(path);
      return stat.size;
    }

    // Node.js
    if (hasNode) {
      const { stat } = await import("fs/promises");
      const stats = await stat(path);
      return stats.size;
    }

    // Bun
    if (hasBun) {
      const bunFile = (globalThis as any).Bun.file(path);
      return bunFile.size;
    }
  } catch (error) {
    throw new FileOperationError(
      "stat",
      (error as Error).message,
      path,
    );
  }

  // Should never reach here
  throw new EnvironmentError(
    "Unknown",
    "No runtime detected",
    "filesystem access",
  );
}

/**
 * Read partial file data (header and footer sections).
 *
 * @param path - File path
 * @param headerSize - Size of header section to read
 * @param footerSize - Size of footer section to read
 * @returns Promise resolving to combined header and footer data
 * @throws {FileOperationError} If file read fails
 * @throws {EnvironmentError} If environment doesn't support file paths
 */
export async function readPartialFileData(
  path: string,
  headerSize: number,
  footerSize: number,
): Promise<Uint8Array> {
  const hasDeno = typeof (globalThis as any).Deno !== "undefined";
  const hasNode = typeof (globalThis as any).process !== "undefined" &&
    (globalThis as any).process.versions &&
    (globalThis as any).process.versions.node;

  if (!hasDeno && !hasNode) {
    throw new EnvironmentError(
      "Browser/Bun",
      "does not support partial file reading",
      "filesystem access with seek support",
    );
  }

  try {
    // Deno
    if (hasDeno) {
      const file = await (globalThis as any).Deno.open(path, { read: true });
      try {
        const stat = await file.stat();
        const fileSize = stat.size;

        // Read header
        const actualHeaderSize = Math.min(headerSize, fileSize);
        const header = new Uint8Array(actualHeaderSize);
        await file.read(header);

        // Read footer
        const actualFooterSize = Math.min(footerSize, fileSize);
        const footerStart = Math.max(0, fileSize - actualFooterSize);

        if (footerStart <= actualHeaderSize) {
          // File is small, we already have all the data
          return header.slice(0, fileSize);
        }

        // Seek to footer position
        await file.seek(footerStart, (globalThis as any).Deno.SeekMode.Start);
        const footer = new Uint8Array(actualFooterSize);
        await file.read(footer);

        // Combine header and footer
        const combined = new Uint8Array(actualHeaderSize + actualFooterSize);
        combined.set(header, 0);
        combined.set(footer, actualHeaderSize);

        return combined;
      } finally {
        file.close();
      }
    }

    // Node.js
    if (hasNode) {
      const { open } = await import("fs/promises");
      const file = await open(path, "r");
      try {
        const stats = await file.stat();
        const fileSize = stats.size;

        // Read header
        const actualHeaderSize = Math.min(headerSize, fileSize);
        const { Buffer } = await import("buffer");
        const header = Buffer.alloc(actualHeaderSize);
        await file.read(header, 0, actualHeaderSize, 0);

        // Read footer
        const actualFooterSize = Math.min(footerSize, fileSize);
        const footerStart = Math.max(0, fileSize - actualFooterSize);

        if (footerStart <= actualHeaderSize) {
          // File is small, we already have all the data
          return new Uint8Array(header.buffer, 0, fileSize);
        }

        const footer = Buffer.alloc(actualFooterSize);
        await file.read(footer, 0, actualFooterSize, footerStart);

        // Combine header and footer
        const combined = new Uint8Array(actualHeaderSize + actualFooterSize);
        combined.set(
          new Uint8Array(header.buffer, header.byteOffset, header.byteLength),
          0,
        );
        combined.set(
          new Uint8Array(footer.buffer, footer.byteOffset, footer.byteLength),
          actualHeaderSize,
        );

        return combined;
      } finally {
        await file.close();
      }
    }
  } catch (error) {
    throw new FileOperationError(
      "read",
      (error as Error).message,
      path,
    );
  }

  // Should never reach here
  throw new EnvironmentError(
    "Unknown",
    "No runtime detected",
    "filesystem access",
  );
}
