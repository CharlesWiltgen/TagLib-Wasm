import { EnvironmentError, FileOperationError } from "../errors.ts";

function detectRuntime(): {
  hasDeno: boolean;
  hasNode: boolean;
  hasBun: boolean;
} {
  const hasDeno = (globalThis as any).Deno !== undefined;
  const hasNode = (globalThis as any).process !== undefined &&
    (globalThis as any).process.versions?.node;
  const hasBun = (globalThis as any).Bun !== undefined;
  return { hasDeno, hasNode, hasBun };
}

function requireFilesystemRuntime(
  operation: string,
): { hasDeno: boolean; hasNode: boolean; hasBun: boolean } {
  const rt = detectRuntime();
  if (!rt.hasDeno && !rt.hasNode && !rt.hasBun) {
    throw new EnvironmentError(
      "Browser",
      `does not support ${operation}`,
      "filesystem access",
    );
  }
  return rt;
}

async function readFileFromPath(path: string): Promise<Uint8Array> {
  const { hasDeno, hasNode, hasBun } = requireFilesystemRuntime(
    "file path reading",
  );

  try {
    if (hasDeno) return await (globalThis as any).Deno.readFile(path);
    if (hasNode) {
      const { readFile } = await import("node:fs/promises");
      return new Uint8Array(await readFile(path));
    }
    if (hasBun) {
      const bunFile = (globalThis as any).Bun.file(path);
      return new Uint8Array(await bunFile.arrayBuffer());
    }
    throw new EnvironmentError(
      "unknown",
      "No runtime detected",
      "file system access",
    );
  } catch (error) {
    throw new FileOperationError("read", (error as Error).message, path);
  }
}

/**
 * Read a file's data from various sources.
 * Supports file paths (Node.js/Deno/Bun), buffers, and File objects (browser).
 */
export async function readFileData(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<Uint8Array> {
  if (file instanceof Uint8Array) return file;
  if (file instanceof ArrayBuffer) return new Uint8Array(file);
  if (typeof File !== "undefined" && file instanceof File) {
    return new Uint8Array(await file.arrayBuffer());
  }
  if (typeof file === "string") return readFileFromPath(file);

  const inputType = Object.prototype.toString.call(file);
  throw new FileOperationError(
    "read",
    `Invalid file input type: ${inputType}. Expected string path, Uint8Array, ArrayBuffer, or File object.`,
  );
}

/** Get the size of a file without reading its contents. */
export async function getFileSize(path: string): Promise<number> {
  const { hasDeno, hasNode, hasBun } = requireFilesystemRuntime(
    "file path operations",
  );

  try {
    if (hasDeno) {
      const stat = await (globalThis as any).Deno.stat(path);
      return stat.size;
    }
    if (hasNode) {
      const { stat } = await import("node:fs/promises");
      const stats = await stat(path);
      return stats.size;
    }
    if (hasBun) {
      const bunFile = (globalThis as any).Bun.file(path);
      return bunFile.size;
    }
  } catch (error) {
    throw new FileOperationError("stat", (error as Error).message, path);
  }

  throw new EnvironmentError(
    "Unknown",
    "No runtime detected",
    "filesystem access",
  );
}

/** Read partial file data (header and footer sections). */
export async function readPartialFileData(
  path: string,
  headerSize: number,
  footerSize: number,
): Promise<Uint8Array> {
  const { hasDeno, hasNode } = detectRuntime();

  if (!hasDeno && !hasNode) {
    throw new EnvironmentError(
      "Browser/Bun",
      "does not support partial file reading",
      "filesystem access with seek support",
    );
  }

  try {
    if (hasDeno) {
      const file = await (globalThis as any).Deno.open(path, { read: true });
      try {
        const stat = await file.stat();
        const fileSize = stat.size;
        const actualHeaderSize = Math.min(headerSize, fileSize);
        const header = new Uint8Array(actualHeaderSize);
        await file.read(header);

        const actualFooterSize = Math.min(footerSize, fileSize);
        const footerStart = Math.max(0, fileSize - actualFooterSize);
        if (footerStart <= actualHeaderSize) return header.slice(0, fileSize);

        await file.seek(footerStart, (globalThis as any).Deno.SeekMode.Start);
        const footer = new Uint8Array(actualFooterSize);
        await file.read(footer);

        const combined = new Uint8Array(actualHeaderSize + actualFooterSize);
        combined.set(header, 0);
        combined.set(footer, actualHeaderSize);
        return combined;
      } finally {
        file.close();
      }
    }

    if (hasNode) {
      const { open } = await import("node:fs/promises");
      const file = await open(path, "r");
      try {
        const stats = await file.stat();
        const fileSize = stats.size;
        const actualHeaderSize = Math.min(headerSize, fileSize);
        const { Buffer } = await import("node:buffer");
        const header = Buffer.alloc(actualHeaderSize);
        await file.read(header, 0, actualHeaderSize, 0);

        const actualFooterSize = Math.min(footerSize, fileSize);
        const footerStart = Math.max(0, fileSize - actualFooterSize);
        if (footerStart <= actualHeaderSize) {
          return new Uint8Array(header.buffer, 0, fileSize);
        }

        const footer = Buffer.alloc(actualFooterSize);
        await file.read(footer, 0, actualFooterSize, footerStart);

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
    throw new FileOperationError("read", (error as Error).message, path);
  }

  throw new EnvironmentError(
    "Unknown",
    "No runtime detected",
    "filesystem access",
  );
}
