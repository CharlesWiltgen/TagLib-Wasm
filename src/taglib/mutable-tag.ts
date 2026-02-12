import type { Tag as BasicTag } from "../types.ts";

/**
 * Extended Tag interface with read/write capabilities for audio metadata.
 * Extends the basic Tag interface with setter methods for modifying metadata.
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
export interface MutableTag extends BasicTag {
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
