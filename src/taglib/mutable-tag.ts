/**
 * Mutable tag interface for the Full API's direct C++ binding.
 *
 * Returns single strings from TagLib's C++ Tag accessors. This is the interface
 * returned by `AudioFile.tag()` in the Full API. Setters are chainable.
 *
 * The Simple API's `Tag` type is different: it wraps values in `string[]` arrays
 * for multi-value support (e.g. multiple artists). Use `readTags()` from
 * `taglib-wasm/simple` for the array-based interface.
 *
 * @example
 * ```typescript
 * const file = await taglib.open("song.mp3");
 * const tag = file.tag();
 *
 * // Read metadata (single strings)
 * console.log(tag.title); // "My Song"
 *
 * // Write metadata (chainable)
 * tag.setTitle("New Title").setArtist("New Artist");
 * file.save();
 * ```
 */
export interface MutableTag {
  /** Track title */
  readonly title?: string;
  /** Artist name */
  readonly artist?: string;
  /** Album name */
  readonly album?: string;
  /** Comment */
  readonly comment?: string;
  /** Genre */
  readonly genre?: string;
  /** Year */
  readonly year?: number;
  /** Track number */
  readonly track?: number;
  /** Set the track title */
  setTitle(value: string): MutableTag;
  /** Set the artist name */
  setArtist(value: string): MutableTag;
  /** Set the album name */
  setAlbum(value: string): MutableTag;
  /** Set the comment */
  setComment(value: string): MutableTag;
  /** Set the genre */
  setGenre(value: string): MutableTag;
  /** Set the release year */
  setYear(value: number): MutableTag;
  /** Set the track number */
  setTrack(value: number): MutableTag;
}
