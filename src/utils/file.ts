import { EnvironmentError, FileOperationError } from "../errors.ts";
import { getPlatformIO } from "../runtime/platform-io.ts";

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
  if (typeof file === "string") {
    try {
      return await getPlatformIO().readFile(file);
    } catch (error) {
      if (error instanceof EnvironmentError) throw error;
      throw new FileOperationError("read", (error as Error).message, file);
    }
  }

  const inputType = Object.prototype.toString.call(file);
  throw new FileOperationError(
    "read",
    `Invalid file input type: ${inputType}. Expected string path, Uint8Array, ArrayBuffer, or File object.`,
  );
}

/** Get the size of a file without reading its contents. */
export async function getFileSize(path: string): Promise<number> {
  try {
    const s = await getPlatformIO().stat(path);
    return s.size;
  } catch (error) {
    if (error instanceof EnvironmentError) throw error;
    throw new FileOperationError("stat", (error as Error).message, path);
  }
}

/** Read partial file data (header and footer sections). */
export async function readPartialFileData(
  path: string,
  headerSize: number,
  footerSize: number,
): Promise<Uint8Array> {
  const io = getPlatformIO();
  if (!io.readPartial) {
    throw new EnvironmentError(
      "current runtime",
      "does not support partial file reading",
      "filesystem access with seek support",
    );
  }

  try {
    return await io.readPartial(path, headerSize, footerSize);
  } catch (error) {
    if (error instanceof EnvironmentError) throw error;
    throw new FileOperationError("read", (error as Error).message, path);
  }
}
