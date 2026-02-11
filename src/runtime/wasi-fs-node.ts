/**
 * @fileoverview Node.js/Bun filesystem provider for WASI host
 *
 * Uses node:fs with manual position tracking since Node lacks seekSync.
 * Bun implements node:fs faithfully, so this provider covers both.
 */

import type {
  FileSystemProvider,
  WasiFileHandle,
  WasiOpenOptions,
} from "./wasi-fs-provider.ts";

type NodeFs = typeof import("node:fs");

function mapOpenFlags(options: WasiOpenOptions): string {
  if (options.create && options.truncate) return "w+";
  if (options.write) return "r+";
  return "r";
}

function createNodeFileHandle(fs: NodeFs, fd: number): WasiFileHandle {
  let position = 0;

  return {
    readSync(target: Uint8Array): number | null {
      const n = fs.readSync(fd, target, 0, target.length, position);
      if (n === 0) return null;
      position += n;
      return n;
    },
    writeSync(data: Uint8Array): number {
      const n = fs.writeSync(fd, data, 0, data.length, position);
      position += n;
      return n;
    },
    seekSync(offset: number, whence: 0 | 1 | 2): number {
      if (whence === 0) {
        position = offset;
      } else if (whence === 1) {
        position += offset;
      } else {
        const stat = fs.fstatSync(fd);
        position = stat.size + offset;
      }
      return position;
    },
    truncateSync(size: number): void {
      fs.ftruncateSync(fd, size);
    },
    close(): void {
      fs.closeSync(fd);
    },
  };
}

export async function createNodeFsProvider(): Promise<FileSystemProvider> {
  const fs = await import("node:fs");

  return {
    openSync(path: string, options: WasiOpenOptions): WasiFileHandle {
      const flags = mapOpenFlags(options);
      const fd = fs.openSync(path, flags);
      return createNodeFileHandle(fs, fd);
    },
    async readFile(path: string): Promise<Uint8Array> {
      const { readFile } = await import("node:fs/promises");
      return new Uint8Array(await readFile(path));
    },
    isNotFoundError(error: unknown): boolean {
      return (error as NodeJS.ErrnoException)?.code === "ENOENT";
    },
  };
}
