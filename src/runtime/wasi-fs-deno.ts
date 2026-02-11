/**
 * @fileoverview Deno filesystem provider for WASI host
 *
 * Thin wrapper mapping Deno APIs to the FileSystemProvider interface.
 */

import type {
  FileSystemProvider,
  WasiFileHandle,
  WasiOpenOptions,
} from "./wasi-fs-provider.ts";

function wrapDenoFile(file: Deno.FsFile): WasiFileHandle {
  return {
    readSync: (target) => file.readSync(target),
    writeSync: (data) => file.writeSync(data),
    seekSync: (offset, whence) =>
      file.seekSync(offset, whence as Deno.SeekMode),
    truncateSync: (size) => file.truncateSync(size),
    close: () => file.close(),
  };
}

export function createDenoFsProvider(): FileSystemProvider {
  return {
    openSync(path: string, options: WasiOpenOptions): WasiFileHandle {
      const file = Deno.openSync(path, options);
      return wrapDenoFile(file);
    },
    readFile(path: string): Promise<Uint8Array> {
      return Deno.readFile(path);
    },
    isNotFoundError(error: unknown): boolean {
      return error instanceof Deno.errors.NotFound;
    },
  };
}
