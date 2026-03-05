import { EnvironmentError } from "../errors/classes.ts";
import { detectRuntime } from "./detector.ts";

export type PlatformIO = {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  stat(path: string): Promise<{ size: number }>;
  readDir(
    path: string,
  ): AsyncGenerator<{ name: string; isDirectory: boolean; isFile: boolean }>;
  readPartial?: (
    path: string,
    headerSize: number,
    footerSize: number,
  ) => Promise<Uint8Array>;
};

let platformIO: PlatformIO | undefined;

async function readFullFile(
  readFile: (path: string) => Promise<Uint8Array>,
  path: string,
  headerSize: number,
  footerSize: number,
  fileSize: number,
): Promise<Uint8Array | undefined> {
  const actualHeader = Math.min(headerSize, fileSize);
  const actualFooter = Math.min(footerSize, fileSize);
  const footerStart = Math.max(0, fileSize - actualFooter);
  if (footerStart > actualHeader) return undefined;
  return (await readFile(path)).slice(0, fileSize);
}

function createDenoIO(): PlatformIO {
  const D = (globalThis as Record<string, unknown>).Deno as typeof Deno;
  return {
    readFile: (path) => D.readFile(path),
    writeFile: (path, data) => D.writeFile(path, data),
    stat: async (path) => {
      const s = await D.stat(path);
      return { size: s.size };
    },
    async *readDir(path) {
      for await (const entry of D.readDir(path)) {
        yield {
          name: entry.name,
          isDirectory: entry.isDirectory,
          isFile: entry.isFile,
        };
      }
    },
    readPartial: async (path, headerSize, footerSize) => {
      const file = await D.open(path, { read: true });
      try {
        const fileSize = (await file.stat()).size;
        const full = await readFullFile(
          (p) => D.readFile(p),
          path,
          headerSize,
          footerSize,
          fileSize,
        );
        if (full) return full;

        const actualHeader = Math.min(headerSize, fileSize);
        const header = new Uint8Array(actualHeader);
        await file.read(header);

        const actualFooter = Math.min(footerSize, fileSize);
        const footerStart = fileSize - actualFooter;
        await file.seek(footerStart, D.SeekMode.Start);
        const footer = new Uint8Array(actualFooter);
        await file.read(footer);

        const combined = new Uint8Array(actualHeader + actualFooter);
        combined.set(header, 0);
        combined.set(footer, actualHeader);
        return combined;
      } finally {
        file.close();
      }
    },
  };
}

type NodeFs = typeof import("node:fs/promises");
type NodeBuffer = typeof import("node:buffer");

function createNodeIO(): PlatformIO {
  let fsCache: NodeFs | undefined;
  let bufCache: NodeBuffer | undefined;

  async function getFs(): Promise<NodeFs> {
    return (fsCache ??= await import("node:fs/promises"));
  }
  async function getBuf(): Promise<NodeBuffer> {
    return (bufCache ??= await import("node:buffer"));
  }

  return {
    readFile: async (path) => {
      const fs = await getFs();
      return new Uint8Array(await fs.readFile(path));
    },
    writeFile: async (path, data) => {
      const fs = await getFs();
      await fs.writeFile(path, data);
    },
    stat: async (path) => {
      const fs = await getFs();
      const s = await fs.stat(path);
      return { size: s.size };
    },
    async *readDir(path) {
      const fs = await getFs();
      const entries = await fs.readdir(path, { withFileTypes: true });
      for (const entry of entries) {
        yield {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
        };
      }
    },
    readPartial: async (path, headerSize, footerSize) => {
      const fs = await getFs();
      const { Buffer } = await getBuf();
      const file = await fs.open(path, "r");
      try {
        const fileSize = (await file.stat()).size;
        const full = await readFullFile(
          async (p) => new Uint8Array(await fs.readFile(p)),
          path,
          headerSize,
          footerSize,
          fileSize,
        );
        if (full) return full;

        const actualHeader = Math.min(headerSize, fileSize);
        const header = Buffer.alloc(actualHeader);
        await file.read(header, 0, actualHeader, 0);

        const actualFooter = Math.min(footerSize, fileSize);
        const footerStart = fileSize - actualFooter;
        const footer = Buffer.alloc(actualFooter);
        await file.read(footer, 0, actualFooter, footerStart);

        const combined = new Uint8Array(actualHeader + actualFooter);
        combined.set(
          new Uint8Array(header.buffer, header.byteOffset, header.byteLength),
          0,
        );
        combined.set(
          new Uint8Array(footer.buffer, footer.byteOffset, footer.byteLength),
          actualHeader,
        );
        return combined;
      } finally {
        await file.close();
      }
    },
  };
}

type BunFile = {
  arrayBuffer(): Promise<ArrayBuffer>;
  size: number;
};

type BunGlobal = {
  file(path: string): BunFile;
  write(path: string, data: Uint8Array): Promise<number>;
};

function createBunIO(): PlatformIO {
  const B = (globalThis as Record<string, unknown>).Bun as BunGlobal;
  return {
    readFile: async (path) => {
      return new Uint8Array(await B.file(path).arrayBuffer());
    },
    writeFile: async (path, data) => {
      await B.write(path, data);
    },
    stat: async (path) => {
      return { size: B.file(path).size };
    },
    async *readDir(path) {
      const fs = await import("node:fs/promises");
      const entries = await fs.readdir(path, { withFileTypes: true });
      for (const entry of entries) {
        yield {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
        };
      }
    },
  };
}

export function getPlatformIO(): PlatformIO {
  if (platformIO) return platformIO;

  const runtime = detectRuntime();

  switch (runtime.environment) {
    case "deno-wasi":
      platformIO = createDenoIO();
      break;
    case "bun-wasi":
      platformIO = createBunIO();
      break;
    case "node-wasi":
    case "node-emscripten":
      platformIO = createNodeIO();
      break;
    default:
      throw new EnvironmentError(
        runtime.environment,
        "does not support filesystem operations",
        "filesystem access",
      );
  }

  return platformIO;
}

/** @internal */
export function _setPlatformIOForTesting(io: PlatformIO): void {
  platformIO = io;
}

/** @internal */
export function _resetPlatformIO(): void {
  platformIO = undefined;
}
