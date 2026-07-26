/**
 * Reserved property-map key carrying exact MP4 atom names to the C++ write path.
 *
 * NOT a property and NOT handle state: it is a write-time directive recomputed at
 * each write site from the PROPERTIES table, so it needs no entry in the
 * extra-state reconstruct registry — but every write site that builds a property
 * map must add it, or MP4 freeform atoms get TagLib's upper-cased name
 * (taglib-bnhl). Sites: `BaseAudioFileImpl.setProperties`/`setProperty` and the
 * `saveToFile` reconstruct in `save-reconstruct.ts`.
 */
export const MP4_ITEM_NAMES_KEY = "_mp4ItemNames";
