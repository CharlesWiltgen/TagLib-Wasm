import { MetadataError } from "../errors/classes.ts";
import type { Picture } from "../types.ts";
import {
  applyCoverArt,
  applyPictures,
  readCoverArt,
  readPictures,
} from "../simple/index.ts";
import { readFileData } from "../utils/file.ts";
import { writeFileData } from "../utils/write.ts";

/**
 * Copy cover art from one audio file to another
 *
 * @param sourcePath - Path to source audio file
 * @param targetPath - Path to target audio file (modified in place)
 * @param options - Copy options
 * @returns Promise that resolves when cover art is copied
 * @throws Error if source has no cover art
 *
 * @example
 * ```typescript
 * // Copy cover art from one file to another
 * await copyCoverArt("album/track01.mp3", "album/track02.mp3");
 *
 * // Copy all pictures
 * await copyCoverArt("source.mp3", "target.mp3", { copyAll: true });
 * ```
 */
export async function copyCoverArt(
  sourcePath: string,
  targetPath: string,
  options: {
    copyAll?: boolean;
  } = {},
): Promise<void> {
  if (options.copyAll) {
    const pictures = await readPictures(sourcePath);
    if (pictures.length === 0) {
      throw new MetadataError("read", `No pictures found. Path: ${sourcePath}`);
    }
    const modifiedBuffer = await applyPictures(targetPath, pictures);
    await writeFileData(targetPath, modifiedBuffer);
  } else {
    const coverData = await readCoverArt(sourcePath);
    if (!coverData) {
      throw new MetadataError(
        "read",
        `No cover art found. Path: ${sourcePath}`,
      );
    }

    const pictures = await readPictures(sourcePath);
    const coverPicture = pictures.find((p: Picture) =>
      p.type === "FrontCover"
    ) ?? pictures[0];

    const modifiedBuffer = await applyCoverArt(
      targetPath,
      coverData,
      coverPicture.mimeType,
    );
    await writeFileData(targetPath, modifiedBuffer);
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const data = await readFileData(path);
    return data.length > 0;
  } catch {
    return false;
  }
}

async function findCoverFile(
  dir: string,
  names: string[],
  extensions: string[],
): Promise<string | undefined> {
  for (const name of names) {
    for (const ext of extensions) {
      const path = `${dir}${name}.${ext}`;
      if (await fileExists(path)) {
        return path;
      }
    }
  }
  return undefined;
}

/**
 * Check if cover art files exist for an audio file
 *
 * Looks for common cover art filenames in the same directory as the audio file.
 *
 * @param audioPath - Path to the audio file
 * @returns Object with found cover art paths
 *
 * @example
 * ```typescript
 * const covers = await findCoverArtFiles("music/album/track01.mp3");
 * if (covers.front) {
 *   await importCoverArt("music/album/track01.mp3", covers.front);
 * }
 * ```
 */
export async function findCoverArtFiles(
  audioPath: string,
): Promise<{
  front?: string;
  back?: string;
  folder?: string;
  [key: string]: string | undefined;
}> {
  const dir = audioPath.substring(0, audioPath.lastIndexOf("/") + 1);
  const extensions = ["jpg", "jpeg", "png", "gif", "webp"];
  const found: Record<string, string> = {};

  const frontPath = await findCoverFile(
    dir,
    ["cover", "front", "Cover", "Front"],
    extensions,
  );
  if (frontPath) found.front = frontPath;

  const folderPath = await findCoverFile(
    dir,
    ["folder", "Folder"],
    extensions,
  );
  if (folderPath) found.folder = folderPath;

  const otherNames = ["album", "artwork", "Album", "Artwork"];
  for (const name of otherNames) {
    const path = await findCoverFile(dir, [name], extensions);
    if (path) found[name.toLowerCase()] = path;
  }

  const backPath = await findCoverFile(
    dir,
    ["back", "Back", "back-cover", "Back-Cover"],
    extensions,
  );
  if (backPath) found.back = backPath;

  return found;
}
