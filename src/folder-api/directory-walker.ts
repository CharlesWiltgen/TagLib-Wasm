/**
 * Directory traversal logic for folder scanning
 */

import { DEFAULT_AUDIO_EXTENSIONS, type FolderScanOptions } from "./types.ts";
import { getPlatformIO } from "../runtime/platform-io.ts";

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

export async function* walkDirectory(
  path: string,
  options: FolderScanOptions = {},
): AsyncGenerator<string> {
  const io = getPlatformIO();

  for await (const entry of io.readDir(path)) {
    yield* processDirectoryEntry(
      path,
      entry.name,
      entry.isDirectory,
      entry.isFile,
      options,
    );
  }
}
