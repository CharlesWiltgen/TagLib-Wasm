/**
 * Single registry of "extra" editable state (everything beyond basic tags and
 * the text PropertyMap) that must survive a file reconstruct in
 * {@link saveViaFreshHandle}. Adding a new metadata kind is ONE entry here; the
 * `extra-state-registry.test.ts` coverage check fails CI if a passthrough field
 * is added without a registry entry, so a field can no longer be silently
 * dropped on save (the taglib-upg class of bug).
 */
import type { FileHandle, RawChapter } from "../wasm.ts";
import type { RawMP4FreeformItem } from "../types/tags.ts";

type ExtraField = {
  /** Stable name, used by the test-net coverage check. */
  readonly name: string;
  /**
   * Copy this field from `source` onto `target`. `sourceComplete` is true when
   * `source` holds the file's full state (WASI save-as): empty/absent means
   * "explicitly cleared" and is propagated. It is false for partial loads,
   * where empty may just mean "not read from the truncated middle" — those are
   * skipped so the freshly-reloaded full handle keeps its originals.
   */
  copy(target: FileHandle, source: FileHandle, sourceComplete: boolean): void;
};

function chapterStyle(chapters: readonly RawChapter[]): string {
  // `source` is stamped from the chosen MP4 style by AudioFileImpl.setChapters
  // and read back from the container by getChapters, so it carries the style
  // for both user-set and read chapters. "id3"/undefined → the (ignored for
  // MP3) MP4 default.
  const s = chapters[0]?.source;
  return s === "nero" || s === "both" ? s : "quicktime";
}

/** Order-independent signature of a raw freeform list (byte-exact). */
function freeformSignature(items: readonly RawMP4FreeformItem[]): string {
  return items
    .map(
      (item) =>
        `${item.mean}\u0000${item.name}\u0000${item.type}\u0000` +
        Array.from(item.value).join(","),
    )
    .sort()
    .join("\n");
}

export const EXTRA_FIELDS: readonly ExtraField[] = [
  {
    name: "pictures",
    copy(target, source, complete) {
      const v = source.getPictures();
      if (complete || v.length > 0) target.setPictures(v);
    },
  },
  {
    name: "ratings",
    copy(target, source, complete) {
      const v = source.getRatings();
      if (complete || v.length > 0) target.setRatings(v);
    },
  },
  {
    name: "lyrics",
    copy(target, source, complete) {
      const v = source.getLyrics();
      if (complete || v.length > 0) target.setLyrics(v);
    },
  },
  {
    name: "chapters",
    copy(target, source, complete) {
      const v = source.getChapters();
      if (complete || v.length > 0) target.setChapters(v, chapterStyle(v));
    },
  },
  {
    name: "bextData",
    copy(target, source, complete) {
      const v = source.getBextData();
      if (v !== undefined) target.setBextData(v);
      else if (complete) target.setBextData(null);
    },
  },
  {
    name: "ixml",
    copy(target, source, complete) {
      const v = source.getIxml();
      if (v !== undefined) target.setIxml(v);
      else if (complete) target.setIxml(null);
    },
  },
  {
    name: "_mp4Freeform",
    copy(target, source, complete) {
      // Typed MP4 freeform items (taglib-gja): editable state carried in the
      // WASI snapshot, applied by the Embind adapter directly. A reconstruct
      // must carry them or a save-as drops every binary atom.
      const items = source.getMP4FreeformItems?.();
      if (items === undefined) return;
      if (!complete && items.length === 0) return;
      // The read snapshot is not a dirty list: a property write may have
      // updated a freeform-backed atom without touching this copy. Copy only
      // when it differs from the fresh handle's own snapshot, or a reconstruct
      // would replace the property write with the stale read state.
      const targetItems = target.getMP4FreeformItems?.() ?? [];
      if (freeformSignature(items) === freeformSignature(targetItems)) return;
      target.setMP4FreeformItems?.(items);
    },
  },
  {
    name: "_mp4ItemRemovals",
    copy(target, source, complete) {
      // Foreign-mean freeform atom deletions (taglib-65nm): carried state on
      // the WASI handle (Emscripten applies removals immediately and has no
      // list), so it must ride a reconstruct or a save-as drops the removal.
      const v = source.getMp4ItemRemovals?.();
      if (complete || (v !== undefined && v.length > 0)) {
        target.setMp4ItemRemovals?.(v ?? []);
      }
    },
  },
  {
    name: "id3v2Frames",
    copy(target, source) {
      // Staged-only by design: copying the full raw view would clobber typed
      // edits on the fresh handle and drag cover-art bytes along (see spec).
      const staged = source.getStagedId3v2Frames?.();
      if (!staged) return;
      for (const [id, bodies] of Object.entries(staged)) {
        target.setId3v2Frames(id, bodies);
      }
    },
  },
];

/** Copy every registered extra-state field from `source` onto `target`. */
export function copyExtraState(
  target: FileHandle,
  source: FileHandle,
  sourceComplete: boolean,
): void {
  for (const field of EXTRA_FIELDS) {
    field.copy(target, source, sourceComplete);
  }
}
