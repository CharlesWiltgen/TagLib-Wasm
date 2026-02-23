/**
 * Mutable tag interface for the Full API's direct C++ binding.
 * Returns single strings from TagLib's Tag accessors.
 * The Simple API wraps these into multi-value Tag arrays.
 *
 * @example
 * ```typescript
 * const file = await taglib.open("song.mp3");
 * const tag = file.tag();
 *
 * // Read metadata
 * console.log(tag.title);
 *
 * // Write metadata
 * tag.setTitle("New Title");
 * tag.setArtist("New Artist");
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
