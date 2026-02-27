/**
 * Directory traversal logic for folder scanning
 */

import { DEFAULT_AUDIO_EXTENSIONS, type FolderScanOptions } from "./types.ts";
import { EnvironmentError } from "../errors/classes.ts";

function join(...paths: string[]): string {
  return paths.filter(Boolean).join("/").replaceAll(/\/+/g, "/");
}

function extname(path: string): string {
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1 || lastDot === path.length - 1) return "";
  return path.slice(lastDot);
}

async function* processDirectoryEntry(
  path: string,
  entryName: string,
  isDirectory: boolean,
  isFile: boolean,
  options: FolderScanOptions,
): AsyncGenerator<string> {
  const { recursive = true, extensions = DEFAULT_AUDIO_EXTENSIONS } = options;
  const fullPath = join(path, entryName);

  if (isDirectory && recursive) {
    yield* walkDirectory(fullPath, options);
  } else if (isFile) {
    const ext = extname(entryName).toLowerCase();
    if (extensions.includes(ext)) {
      yield fullPath;
    }
  }
}

async function getDirectoryReader() {
  if (typeof Deno !== "undefined") {
    return {
      readDir: async function* (path: string) {
        for await (const entry of Deno.readDir(path)) {
          yield {
            name: entry.name,
            isDirectory: entry.isDirectory,
            isFile: entry.isFile,
          };
        }
      },
    };
  }

  const isNode = (globalThis as any).process !== undefined &&
    (globalThis as any).process.versions?.node;
  const isBun = (globalThis as any).process !== undefined &&
    (globalThis as any).process.versions?.bun;

  if (isNode || isBun) {
    const fs = await import("node:fs/promises");
    return {
      readDir: async function* (path: string) {
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

  throw new EnvironmentError(
    "unknown",
    "Directory scanning not supported",
    "filesystem API",
  );
}

export async function* walkDirectory(
  path: string,
  options: FolderScanOptions = {},
): AsyncGenerator<string> {
  const reader = await getDirectoryReader();

  for await (const entry of reader.readDir(path)) {
    yield* processDirectoryEntry(
      path,
      entry.name,
      entry.isDirectory,
      entry.isFile,
      options,
    );
  }
}
