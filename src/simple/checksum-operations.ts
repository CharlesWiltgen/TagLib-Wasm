import type { AudioFileInput } from "../types.ts";
import type {
  MediaChecksum,
  MediaChecksumOptions,
} from "../taglib/audio-file-checksum.ts";
import { withAudioFile } from "./with-audio-file.ts";

/**
 * Reads a checksum of an audio file's media content.
 *
 * The digest is of the *encoded media payload* — the bytes that are the audio,
 * not the tags around them — so it survives a tag edit, with one boundary: an
 * ID3v2 tag appended after a FLAC's audio is inside that payload, so editing it
 * does move the hash. Formats whose payload cannot be delimited answer the
 * whole file instead and say so (`source: "file"`), where a tag edit does move
 * the hash.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @param options - `basis: "pcm"` asks for FLAC's STREAMINFO MD5, the digest of
 *   the *uncompressed* stream, instead of the encoded payload's SHA-256
 * @returns The hex digest, the algorithm, what it covers (`source`), and how
 *   many bytes were hashed
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 * @throws {UnsupportedFormatError} If `basis: "pcm"` is asked of a non-FLAC file
 * @throws {MetadataError} If the payload cannot be walked, or the handle holds
 *   no bytes and no readable source
 */
export async function readMediaChecksum(
  file: AudioFileInput,
  options?: MediaChecksumOptions,
): Promise<MediaChecksum> {
  return withAudioFile(file, (audioFile) => audioFile.mediaChecksum(options));
}
