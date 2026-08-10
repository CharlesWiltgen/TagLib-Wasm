/**
 * Full-file reconstruct used by `saveToFile` for the two cases where the
 * editing handle does not itself hold the complete file bytes: an Emscripten
 * partial load, and the WASI path-mode "save as". Both must produce a complete
 * file at the target without mutating the editing handle's source in place.
 */
import type { FileHandle, TagLibModule, WasmFileHandle } from "../wasm.ts";
import { FileOperationError, InvalidFormatError } from "../errors.ts";
import { readFileData } from "../utils/file.ts";
import { writeFileData } from "../utils/write.ts";
import { type EmbindFileHandle, wrapEmbindHandle } from "./embind-adapter.ts";
import { copyExtraState } from "./extra-state-registry.ts";
import { mp4FreeformAtomNames } from "../constants/properties.ts";
import { MP4_ITEM_NAMES_KEY } from "./mp4-item-names.ts";

/**
 * Copy editable in-memory state from one handle onto another (e.g. a freshly
 * reloaded full-file handle). All structured metadata goes through the single
 * {@link copyExtraState} registry so a field can't be silently forgotten.
 * `sourceComplete` distinguishes a full-state source (WASI save-as) from a
 * partial-load source: when complete, the text PropertyMap replaces wholesale
 * and explicit clears propagate; when partial, properties are MERGED over the
 * reloaded full handle so text frames (and Emscripten lyrics, which ride the
 * PropertyMap) beyond the loaded header are not wiped, and empty structured
 * fields are skipped rather than wiping originals.
 */
function copyEditedState(
  target: FileHandle,
  source: FileHandle,
  sourceComplete: boolean,
  deletedKeys: ReadonlySet<string>,
): void {
  target.setTagData(source.getTagData());
  const merged = sourceComplete
    ? source.getProperties()
    : { ...target.getProperties(), ...source.getProperties() };
  // A partial source can't represent "deleted" as an absent key (absent may just
  // mean unread), so the merge above re-adds it from the full reload. Subtract
  // the keys the editing handle reports as explicitly deleted (taglib-d14).
  for (const key of deletedKeys) delete merged[key];
  // Atom names are a write-time directive derived at each write site, not state
  // carried on the handle, so getProperties() above cannot supply them. Recompute
  // here or the reconstruct writes MP4 freeform atoms under TagLib's upper-cased
  // name — the casing fix would hold for save() and silently revert for
  // saveToFile() (taglib-bnhl).
  const atomNames = mp4FreeformAtomNames(Object.keys(merged));
  if (atomNames.length > 0) merged[MP4_ITEM_NAMES_KEY] = atomNames;
  target.setProperties(merged);
  copyExtraState(target, source, sourceComplete);
}

/**
 * Reload the full file from `source` into a fresh handle, apply the editing
 * handle's state, save, and write the result to `targetPath`.
 */
export async function saveViaFreshHandle(
  module: TagLibModule,
  editing: FileHandle,
  source: string | Uint8Array | ArrayBuffer | File,
  targetPath: string,
  sourceComplete: boolean,
  deletedKeys: ReadonlySet<string> = new Set(),
): Promise<void> {
  const rawFullHandle = module.createFileHandle();
  const fullFileHandle: WasmFileHandle = module.isWasi
    ? (rawFullHandle as WasmFileHandle) // WASI raw == library-owned (taglib-0te)
    : wrapEmbindHandle(rawFullHandle as unknown as EmbindFileHandle);
  try {
    {
      // Scope the source bytes so they can be GC'd after the copy to the Wasm
      // heap, reducing peak memory from 3x to 2x file size.
      const data = await readFileData(source);
      if (!fullFileHandle.loadFromBuffer(data)) {
        throw new InvalidFormatError(
          "Failed to load full audio file for saving",
        );
      }
    }
    copyEditedState(fullFileHandle, editing, sourceComplete, deletedKeys);
    if (!fullFileHandle.save()) {
      throw new FileOperationError(
        "save",
        "Failed to save changes to full file",
      );
    }
    await writeFileData(targetPath, fullFileHandle.getBuffer());
  } finally {
    fullFileHandle.destroy();
  }
}
