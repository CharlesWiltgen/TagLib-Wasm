/**
 * @fileoverview BWF (Broadcast Wave Format) metadata types — the `bext` chunk
 * (EBU Tech 3285). The iXML chunk is exposed as a raw string, not modeled here.
 */

/**
 * Parsed BWF `bext` (Broadcast Audio Extension) chunk. Available on WAV and
 * FLAC files via {@link AudioFile.getBext} / {@link AudioFile.setBext}.
 *
 * `version` governs which optional fields are meaningful: 0 = none; 1 = `umid`;
 * 2 = `umid` plus the loudness fields. Encoding always writes the full
 * 602-byte fixed prefix regardless of version (unused fields are zeroed).
 */
export interface BroadcastAudioExtension {
  /** Free-text description. Truncated to 256 ASCII bytes on write. */
  description: string;
  /** Producer / recording device. Truncated to 32 ASCII bytes on write. */
  originator: string;
  /** Unambiguous reference (e.g. original tape ID). 32 bytes on write. */
  originatorReference: string;
  /** Origination date, "YYYY-MM-DD" (10 bytes). */
  originationDate: string;
  /** Origination time, "HH:MM:SS" (8 bytes). */
  originationTime: string;
  /** Sample count from midnight to the start of the recorded sequence. */
  timeReferenceSamples: bigint;
  /** bext chunk version: 0, 1, or 2. */
  version: number;
  /** SMPTE UMID as a lowercase hex string (the 64-byte field). Present when version ≥ 1. */
  umid?: string;
  /** Integrated loudness (LUFS). Present when version ≥ 2. */
  loudnessValueDb?: number;
  /** Loudness range (LU). Present when version ≥ 2. */
  loudnessRangeDb?: number;
  /** Maximum true-peak level (dBTP). Present when version ≥ 2. */
  maxTruePeakLevelDbtp?: number;
  /** Maximum momentary loudness (LUFS). Present when version ≥ 2. */
  maxMomentaryLoudnessDb?: number;
  /** Maximum short-term loudness (LUFS). Present when version ≥ 2. */
  maxShortTermLoudnessDb?: number;
  /** Encoding history (the spec uses CR/LF-delimited lines; exposed verbatim). */
  codingHistory: string;
}
