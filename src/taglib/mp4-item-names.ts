import { mp4FreeformAtomNames } from "../constants/properties.ts";

/**
 * Reserved property-map key carrying freeform MP4 atom EDITS to the C++ write
 * path, as `{ name, values }` entries. An entry with no values removes the atom.
 *
 * NOT a property and NOT handle state: it is a write-time directive assembled at
 * each write site, so it needs no entry in the extra-state reconstruct registry —
 * but every site that builds a property map must supply it, or a freeform atom is
 * rewritten through TagLib's PropertyMap, which destroys its casing, duplicates
 * it, and relocates a non-Apple mean into `com.apple.iTunes`
 * (taglib-bnhl, taglib-wkyi).
 *
 * Sites: `BaseAudioFileImpl.setProperties`/`setProperty`/`setMP4Item`/
 * `removeMP4Item`, and the `saveToFile` reconstruct in `save-reconstruct.ts`.
 */
export const MP4_ITEMS_KEY = "_mp4Items";

/** One freeform atom edit. Empty `values` removes the atom. */
export type Mp4ItemEdit = { readonly name: string; readonly values: string[] };

/** True for a freeform atom key, which the PropertyMap cannot represent. */
export function isFreeformAtom(key: string): boolean {
  return key.startsWith("----");
}

/**
 * Edits for every freeform-atom-backed property in `translated`, pairing the
 * canonical atom name with the value being written. An empty value list is
 * carried through as a removal, so clearing such a property removes its atom.
 *
 * Callers must already know the file is MP4; this only maps keys to atom names.
 */
export function freeformEditsFor(
  translated: Record<string, string[]>,
): Mp4ItemEdit[] {
  const edits: Mp4ItemEdit[] = [];
  for (const wireKey of Object.keys(translated)) {
    for (const name of mp4FreeformAtomNames([wireKey])) {
      edits.push({ name, values: translated[wireKey] ?? [] });
    }
  }
  return edits;
}
