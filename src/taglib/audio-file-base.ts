import type { FileHandle, TagLibModule } from "../wasm.ts";
import type {
  AudioProperties,
  FileType,
  OpenOptions,
  PropertyMap,
} from "../types.ts";
import {
  mp4AtomWireKey,
  mp4FreeformAtomNames,
  remapKeysFromTagLib,
  toTagLibKey,
} from "../constants/properties.ts";
import { MetadataError, UnsupportedFormatError } from "../errors.ts";
import type { MutableTag } from "./mutable-tag.ts";
import type { TypedAudioFile } from "./audio-file-interface.ts";
import { freeformEditsFor, MP4_ITEMS_KEY } from "./mp4-item-names.ts";
import { buildMutableTag } from "./mutable-tag-impl.ts";

// Lyrics (ID3v2 USLT / Vorbis LYRICS) is a structured field surfaced through the
// dedicated get/setLyrics() accessor, like pictures/ratings/chapters. It is
// excluded from the text properties() map AND preserved across a text-only
// setProperties, so get/setLyrics() is the single canonical owner and a
// read-modify-write (applyTags) can never drop it. On Emscripten lyrics ride the
// Embind PropertyMap; on WASI they live in tagData (already hidden via
// INTERNAL_KEYS), so the WASI paths below are no-ops.
const LYRICS_PROPERTY_KEY = "lyrics"; // camelCase
const LYRICS_WIRE_KEY = toTagLibKey(LYRICS_PROPERTY_KEY); // "LYRICS"

const EMPTY_KEY_SET: ReadonlySet<string> = new Set();

/**
 * Base implementation with core read/property operations.
 * Extended by AudioFileImpl to add save/picture/rating/extended methods.
 *
 * @internal Not exported from the public API.
 */
export abstract class BaseAudioFileImpl {
  protected fileHandle: FileHandle | null;
  protected cachedAudioProperties: AudioProperties | null = null;
  protected readonly sourcePath?: string;
  protected originalSource?: string | Uint8Array | ArrayBuffer | File;
  protected isPartiallyLoaded: boolean = false;
  protected readonly partialLoadOptions?: OpenOptions;
  /** Text-property wire keys in the partial header at load; undefined if full. */
  protected readonly partialKeysAtLoad?: ReadonlySet<string>;

  constructor(
    protected readonly module: TagLibModule,
    fileHandle: FileHandle,
    sourcePath?: string,
    originalSource?: string | Uint8Array | ArrayBuffer | File,
    isPartiallyLoaded: boolean = false,
    partialLoadOptions?: OpenOptions,
  ) {
    this.fileHandle = fileHandle;
    this.sourcePath = sourcePath;
    this.originalSource = originalSource;
    this.isPartiallyLoaded = isPartiallyLoaded;
    this.partialLoadOptions = partialLoadOptions;
    this.partialKeysAtLoad = isPartiallyLoaded
      ? new Set(Object.keys(fileHandle.getProperties()))
      : undefined;
  }

  /**
   * Wire-key text properties present in the partial header at load but now
   * absent — the user deleted them. The partial-load reconstruct subtracts these
   * from its preserve-the-original merge so a deletion persists without wiping
   * frames beyond the loaded header (taglib-d14). Lyrics are excluded (they ride
   * their own reconstruct path); empty for a full load.
   */
  protected partialDeletedPropertyKeys(): ReadonlySet<string> {
    if (!this.partialKeysAtLoad) return EMPTY_KEY_SET;
    const current = new Set(Object.keys(this.handle.getProperties()));
    const deleted = new Set<string>();
    for (const key of this.partialKeysAtLoad) {
      if (key !== LYRICS_WIRE_KEY && !current.has(key)) deleted.add(key);
    }
    return deleted;
  }

  protected get handle(): FileHandle {
    if (!this.fileHandle) {
      throw new MetadataError("read", "File handle has been disposed");
    }
    return this.fileHandle;
  }

  getFormat(): FileType {
    return this.handle.getFormat() as FileType;
  }

  isFormat<F extends FileType>(format: F): this is TypedAudioFile<F> {
    return this.getFormat() === format;
  }

  tag(): MutableTag {
    return buildMutableTag(this.handle);
  }

  audioProperties(): AudioProperties | undefined {
    if (!this.cachedAudioProperties) {
      this.cachedAudioProperties = this.handle.getAudioProperties() ?? null;
    }
    return this.cachedAudioProperties ?? undefined;
  }

  properties(): PropertyMap {
    const remapped = remapKeysFromTagLib(this.handle.getProperties());
    delete (remapped as Record<string, unknown>)[LYRICS_PROPERTY_KEY];
    return remapped as PropertyMap;
  }

  setProperties(properties: PropertyMap): void {
    const translated: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(properties)) {
      if (values !== undefined) translated[toTagLibKey(key)] = values;
    }
    // Lyrics is owned by get/setLyrics(), not the properties() surface; when a
    // text-only setProperties (e.g. the applyTags read-modify-write) omits it,
    // preserve the existing frame so the replace-style Emscripten setProperties
    // can't drop it. WASI keeps lyrics in tagData, so its handle never returns
    // this key and the branch is a no-op there (taglib-eyp).
    if (!(LYRICS_WIRE_KEY in translated)) {
      const existing = this.handle.getProperties()[LYRICS_WIRE_KEY];
      if (existing !== undefined) translated[LYRICS_WIRE_KEY] = existing;
    }
    // Properties backed by an MP4 freeform atom cannot travel through the
    // PropertyMap without losing their atom name, so they ride the edits channel
    // with the canonical name from the PROPERTIES table (taglib-bnhl).
    const edits = this.isMP4() ? freeformEditsFor(translated) : [];
    if (edits.length > 0) {
      (translated as Record<string, unknown>)[MP4_ITEMS_KEY] = edits;
    }
    this.handle.setProperties(translated);
  }

  getProperty(key: string): string | undefined {
    const value = this.handle.getProperty(toTagLibKey(key));
    if (value !== "") return value;
    // MP4 only: this is the sole format whose PropertyMap key can differ from our
    // wire key, and materializing the whole map on every miss would otherwise
    // turn N absent-property probes into N full map builds.
    if (!this.isMP4()) return undefined;
    // A direct wire-key lookup can miss when the format keys the field
    // differently: MP4 reports the `Acoustid Fingerprint` atom as
    // "ACOUSTID FINGERPRINT" (space) while our wire key — correct for Vorbis —
    // is ACOUSTID_FINGERPRINT (underscore). properties() goes through the full
    // key remap, which resolves both, so fall back to it on a miss (taglib-bnhl).
    // Empty means absent here too, matching the direct path: a cleared property
    // can still be present as [""].
    const remapped = (this.properties() as Record<string, string[]>)[key]?.[0];
    return remapped === "" ? undefined : remapped;
  }

  setProperty(key: string, value: string): void {
    const wireKey = toTagLibKey(key);
    // setProperty has no property map to carry the edits channel, so a
    // freeform-backed property is routed through setProperties, which does
    // (taglib-bnhl).
    if (this.isMP4() && mp4FreeformAtomNames([wireKey]).length > 0) {
      this.setProperties(
        { ...this.properties(), [key]: [value] } as PropertyMap,
      );
      return;
    }
    this.handle.setProperty(wireKey, value);
  }

  isMP4(): boolean {
    return this.handle.isMP4();
  }

  getMP4Item(key: string): string | undefined {
    if (!this.isMP4()) {
      throw new UnsupportedFormatError(this.getFormat(), ["MP4", "M4A"]);
    }
    // Symmetric with setMP4Item: standard atoms are read through the property
    // surface, which renders every item type. The Embind item reader handles
    // Int/StringList/Bool/Byte but not IntPair, so `trkn`/`disk` read back as
    // empty (taglib-uj2b).
    const wireKey = mp4AtomWireKey(key);
    const value = wireKey !== undefined
      ? this.handle.getProperty(wireKey)
      : this.handle.getMP4Item(key);
    return value === "" ? undefined : value;
  }

  setMP4Item(key: string, value: string): void {
    if (!this.isMP4()) {
      throw new UnsupportedFormatError(this.getFormat(), ["MP4", "M4A"]);
    }
    // A STANDARD atom's item type is fixed by its NAME, not by how its value
    // looks: `trkn`/`disk` are int PAIRS and `©nam` is text. Only TagLib's own
    // item factory knows that mapping, so route standard atoms through the
    // property surface and let it choose. Guessing from the value string wrote
    // an Int item for an IntPair atom (silently dropped) and filed a text atom
    // whose value was all digits as an Int (taglib-uj2b). The dedicated item API
    // stays for FREEFORM atoms, where the exact name matters and the type is
    // always text.
    const wireKey = mp4AtomWireKey(key);
    if (wireKey !== undefined) {
      this.handle.setProperty(wireKey, value);
      return;
    }
    // Freeform atoms keep their exact name — including a non-Apple mean, which
    // the PropertyMap silently relocates into com.apple.iTunes. Each backend's
    // handle knows how: Embind uses the Item API directly, WASI stages an
    // exact-name edit (taglib-wkyi).
    this.handle.setMP4Item(key, value);
  }

  removeMP4Item(key: string): void {
    if (!this.isMP4()) {
      throw new UnsupportedFormatError(this.getFormat(), ["MP4", "M4A"]);
    }
    this.handle.removeMP4Item(key);
  }

  isValid(): boolean {
    return this.handle.isValid();
  }

  dispose(): void {
    if (this.fileHandle) {
      this.fileHandle.destroy();
      this.fileHandle = null;
      this.cachedAudioProperties = null;
    }
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}
