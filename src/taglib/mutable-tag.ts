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
  /** Track title (undefined when absent) */
  readonly title: string | undefined;
  /** Artist name (undefined when absent) */
  readonly artist: string | undefined;
  /** Album name (undefined when absent) */
  readonly album: string | undefined;
  /** Comment (undefined when absent) */
  readonly comment: string | undefined;
  /** Genre (undefined when absent) */
  readonly genre: string | undefined;
  /** Year (undefined when absent) */
  readonly year: number | undefined;
  /** Full release date, e.g. "1975-10-31" or "1975". Lossless companion to {@link year}. */
  readonly date: string | undefined;
  /** Track number (undefined when absent) */
  readonly track: number | undefined;
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
  /**
   * Set the full release date at ISO precision (e.g. "1975-10-31"); `year` resyncs to the
   * leading year. `setDate("")` clears the date AND year together.
   */
  setDate(value: string): MutableTag;
  /** Set the track number */
  setTrack(value: number): MutableTag;
}
