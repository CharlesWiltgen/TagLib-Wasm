import type { FileHandle, TagLibModule } from "../wasm.ts";
import type {
  AudioProperties,
  FileType,
  OpenOptions,
  PropertyMap,
} from "../types.ts";
import {
  mp4FreeformAtomNames,
  remapKeysFromTagLib,
  toTagLibKey,
} from "../constants/properties.ts";
import { MetadataError, UnsupportedFormatError } from "../errors.ts";
import type { MutableTag } from "./mutable-tag.ts";
import type { TypedAudioFile } from "./audio-file-interface.ts";

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
 * Reserved property-map key carrying exact MP4 atom names to the C++ write path.
 * Never a real property — both backends pull it out before building the
 * PropertyMap (taglib-bnhl).
 */
const MP4_ITEM_NAMES_KEY = "_mp4ItemNames";

/** Wire key for the raw track field, whose value may be "n" or "n/total". */
const RAW_TRACK_WIRE_KEY = toTagLibKey("trackNumber"); // "TRACKNUMBER"

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
    const handle = this.handle;
    let data = handle.getTagData();
    const tag: MutableTag = {
      get title() {
        return data.title;
      },
      get artist() {
        return data.artist;
      },
      get album() {
        return data.album;
      },
      get comment() {
        return data.comment;
      },
      get genre() {
        return data.genre;
      },
      get year() {
        return data.year;
      },
      get track() {
        return data.track;
      },
      get date() {
        return handle.getProperty("DATE") || undefined; // "DATE" = toTagLibKey("date")
      },
      setTitle: (value: string) => {
        handle.setTagData({ title: value });
        data = handle.getTagData();
        return tag;
      },
      setArtist: (value: string) => {
        handle.setTagData({ artist: value });
        data = handle.getTagData();
        return tag;
      },
      setAlbum: (value: string) => {
        handle.setTagData({ album: value });
        data = handle.getTagData();
        return tag;
      },
      setComment: (value: string) => {
        handle.setTagData({ comment: value });
        data = handle.getTagData();
        return tag;
      },
      setGenre: (value: string) => {
        handle.setTagData({ genre: value });
        data = handle.getTagData();
        return tag;
      },
      setYear: (value: number) => {
        handle.setTagData({ year: value });
        data = handle.getTagData();
        return tag;
      },
      setTrack: (value: number) => {
        // ID3v2::Tag::setTrack replaces the whole TRCK frame, so setting the
        // number over a "3/12" destroyed the total on Emscripten while WASI
        // preserved it via its separate totalTracks field (taglib-eq3). When a
        // total is present, write the pair through the property surface instead.
        // WASI never reaches this branch for an int-pair format: it splits the
        // pair on read, so its trackNumber holds no "/" and its own merge
        // re-attaches the total on save.
        // A non-positive value is a clear, not a renumbering, so it must reach
        // setTagData rather than staging "0/12".
        const existing = value > 0
          ? handle.getProperty(RAW_TRACK_WIRE_KEY)
          : "";
        const slash = existing.indexOf("/");
        if (slash !== -1) {
          handle.setProperty(
            RAW_TRACK_WIRE_KEY,
            `${value}${existing.slice(slash)}`,
          );
        } else {
          handle.setTagData({ track: value });
        }
        data = handle.getTagData();
        return tag;
      },
      setDate: (value: string) => {
        if (value === "") {
          handle.setTagData({ year: 0 }); // coherent clear: drops BOTH date and year
        } else {
          handle.setProperty("DATE", value);
        }
        data = handle.getTagData(); // re-read so `year` reflects the change immediately
        return tag;
      },
    };
    return tag;
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
    // Properties backed by a mixed-case MP4 freeform atom lose their casing in
    // TagLib's PropertyMap. C++ repairs it, but for an atom not yet on disk it
    // needs the name, and the PROPERTIES table is where we keep it (taglib-bnhl).
    const atomNames = mp4FreeformAtomNames(Object.keys(translated));
    if (atomNames.length > 0) translated[MP4_ITEM_NAMES_KEY] = atomNames;
    this.handle.setProperties(translated);
  }

  getProperty(key: string): string | undefined {
    const value = this.handle.getProperty(toTagLibKey(key));
    if (value !== "") return value;
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
    this.handle.setProperty(toTagLibKey(key), value);
  }

  isMP4(): boolean {
    return this.handle.isMP4();
  }

  getMP4Item(key: string): string | undefined {
    if (!this.isMP4()) {
      throw new UnsupportedFormatError(this.getFormat(), ["MP4", "M4A"]);
    }
    const value = this.handle.getMP4Item(key);
    return value === "" ? undefined : value;
  }

  setMP4Item(key: string, value: string): void {
    if (!this.isMP4()) {
      throw new UnsupportedFormatError(this.getFormat(), ["MP4", "M4A"]);
    }
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
