/**
 * @fileoverview Chapter / cue-marker types.
 */

/**
 * A single chapter / cue marker.
 *
 * Read from ID3v2 `CHAP` frames (MP3), QuickTime chapter tracks, or Nero
 * `chpl` atoms (MP4). On write, MP3 produces ID3v2 CHAP frames; for MP4 the
 * structure(s) written are chosen via {@link SetChaptersOptions.mp4ChapterStyle}.
 */
export interface Chapter {
  /** Chapter start, milliseconds from the start of the file. */
  startTimeMs: number;
  /**
   * Chapter end, milliseconds. Explicit for ID3v2 CHAP frames; inferred for
   * MP4 chapters (the next chapter's start time, or the track duration for the
   * last chapter). `undefined` only when the duration cannot be determined.
   */
  endTimeMs?: number;
  /** Chapter title. */
  title?: string;
  /**
   * ID3v2 CHAP element ID. `undefined` for MP4 chapters — Nero and QuickTime
   * chapters carry no element identifiers.
   */
  id?: string;
  /** Which container structure this chapter was read from. */
  source?: "id3" | "nero" | "quicktime";
}

/** Options for {@link AudioFile.setChapters}. */
export interface SetChaptersOptions {
  /**
   * MP4 files only. Selects which chapter structure(s) to write (other
   * structures are removed, so the file ends up with exactly what is
   * requested):
   * - `"quicktime"` (default): a QuickTime chapter track — the standard
   *   mechanism, honored by Apple Books / Podcasts / iOS and most players.
   * - `"nero"`: a Nero `chpl` atom — read by ffmpeg / foobar2000 / MP4Box but
   *   ignored by Apple devices; hard limit of 255 chapters.
   * - `"both"`: both of the above. When there are more than 255 chapters the
   *   QuickTime track gets all of them and the Nero atom gets the first 255.
   *
   * Ignored for non-MP4 files (MP3 always writes ID3v2 CHAP frames).
   */
  mp4ChapterStyle?: "quicktime" | "nero" | "both";
}
