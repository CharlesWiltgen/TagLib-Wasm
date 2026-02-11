/**
 * @fileoverview Filesystem provider interface for runtime-agnostic WASI host
 *
 * Abstracts the 6 file operations needed by WASI syscalls so that
 * Deno, Node.js, and Bun can all use seek-based I/O.
 */

export type WasiFileHandle = {
  readSync(target: Uint8Array): number | null;
  writeSync(data: Uint8Array): number;
  seekSync(offset: number, whence: 0 | 1 | 2): number;
  truncateSync(size: number): void;
  close(): void;
};

export type WasiOpenOptions = {
  read: boolean;
  write: boolean;
  create?: boolean;
  truncate?: boolean;
};

export type FileSystemProvider = {
  openSync(path: string, options: WasiOpenOptions): WasiFileHandle;
  readFile(path: string): Promise<Uint8Array>;
  isNotFoundError(error: unknown): boolean;
};
