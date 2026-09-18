/**
 * The gated path open for the WASI backend: `WasiFileHandle.loadFromPath` plus
 * the content check a path needs and a buffer does not.
 *
 * `read_from_path` resolves the file class by *extension* first, and upstream's
 * `MPEG::File` reports itself valid for any bytes at all (its `read()` never
 * clears validity, `lib/taglib/taglib/mpeg/mpegfile.cpp`), so `junk.mp3` opens
 * where the same bytes in a buffer are refused. Two independent signals say
 * whether anything was really there, in cost order:
 *
 * 1. {@link statesAudioProperties} — whether the parse read an audio property
 *    out of the file. No extra I/O: the snapshot is what the open already
 *    produced. A file that states a sample rate is audio TagLib read, whatever
 *    its head looks like — which is how an MP3 behind a 4 KiB or 70 KiB APEv2
 *    tag (this repo's own corpus shapes, tests/media-checksum-corpus.test.ts)
 *    stays readable even though neither detector can see the frames behind the
 *    tag.
 * 2. {@link hasRecognizableHead} — whether the head is content the boundary's
 *    detector knows, or opens as a buffer. This is what saves a file whose
 *    properties are legitimately absent (`lib/taglib/tests/data/segfault.wav`
 *    is 30 bytes of `RIFF`/`WAVE`; `tests/test-files/mp4/synth-multi-mdat.mp4`
 *    has `ftyp` and no `moov`) and every tag-only file, whose head *is* its tag:
 *    content is recognizable even when there is nothing to measure.
 *
 * A path is refused only when *both* say nothing — a zero-length file, junk
 * bytes behind an audio extension. That is the shape of every refusal in this
 * repo's and upstream's corpora (163 fixtures, swept by
 * `tests/checksum-input-contract.test.ts`), and neither signal can refuse a file
 * the buffer form accepts: every detector rule is head-based (MOD's signature at
 * offset 1080 is the deepest, and the window clears it), the ID3v2 rule answers
 * "MP3" rather than giving up when the tag runs past the window
 * (`src/capi/taglib_boundary.c`, `tl_detect_format`), and a head that opens as a
 * buffer *is* the buffer form's own verdict.
 *
 * The one asymmetry that survives is upstream's deliberately corrupt fixtures
 * whose bytes still yield a property (`garbage.mp3`, `sv4_header.mpc`,
 * `sv5_header.mpc`, `stripped.xm`): TagLib reads a header out of them, so the
 * path form keeps accepting them exactly as it did before this change, while the
 * buffer form's narrower magic rules refuse them. Nothing in the C detector can
 * place SV4/SV5 MPC or junk-with-a-frame-header — see taglib-uat8 for that
 * reachability gap — and refusing them here would mean refusing files the parse
 * did read.
 */

import type { FileHandle, WasmFileHandle } from "../../wasm.ts";
import type { WasiModule } from "../wasmer-sdk-loader/types.ts";
import {
  FileOperationError,
  InvalidFormatError,
} from "../../errors/classes.ts";
import { getFileSize, readPartialFileData } from "../../utils/file.ts";
import { readTagsFromWasm } from "./wasm-io.ts";

/** `TL_FORMAT_AUTO`: what the detector answers for bytes it cannot place
 * (`src/capi/core/taglib_core.h`). */
const TL_FORMAT_AUTO = 0;

/**
 * How much of the head the detector gets: every rule it has reads inside this
 * (the deepest is MOD's signature at offset 1080), and a file smaller than this
 * is read whole, which makes the head's buffer verdict exactly the buffer
 * branch's verdict for it. A larger window would cost a larger read per refused
 * path and could only agree more often, never less.
 */
const HEADER_WINDOW = 4096;

/** The WASI backend this open runs on: its host module (where the detector and
 * the WASI→host path resolution live, `WasiToTagLibAdapter.hostModule`) and its
 * handle factory. */
export interface PathOpenHost {
  readonly hostModule: WasiModule;
  createFileHandle(): FileHandle;
}

/**
 * Load an audio file by path, verifying that its content is audio.
 *
 * Every failure the caller can act on is distinct: `FileOperationError` for a
 * path the host does not have (what the buffer form's own stat answers, so a
 * typo reads the same on both backends), `InvalidFormatError` for content the
 * boundary could not resolve as audio, and the wasm-level errors unchanged.
 * Either content signal above suffices; both saying nothing is a refusal.
 *
 * The returned handle is the library-owned one (the WASI brand asserted here,
 * the WASI equivalent of `wrapEmbindHandle`), destroyed on any failure — the
 * caller's `AudioFile` takes it over on success.
 */
export async function openAudioPath(
  backend: PathOpenHost,
  wasiPath: string,
  displayPath: string,
): Promise<WasmFileHandle> {
  const handle = backend.createFileHandle() as WasmFileHandle;
  try {
    let loaded: boolean;
    try {
      loaded = handle.loadFromPath!(wasiPath);
    } catch (error) {
      // The boundary does not separate "nothing at this path" from "this is not
      // audio": a path the host does not have is a file operation, and anything
      // else is content it could not resolve (the code→class rule in wasm-io.ts
      // is what raised the error we are holding).
      if (!(error instanceof InvalidFormatError)) throw error;
      const hostPath = backend.hostModule.hostPathFor(wasiPath);
      if (hostPath === undefined) {
        // No preopen covers this path, so the host cannot reach it at all:
        // there is nothing to read and nothing to recognise. That is a file
        // operation, the same answer as a file that is not there.
        throw new FileOperationError(
          "read",
          "The path is outside the WASI preopens this host was created with",
          displayPath,
        );
      }
      await getFileSize(hostPath);
      throw error;
    }
    if (!loaded) {
      throw new InvalidFormatError(
        `Failed to load audio file. Path: ${displayPath}`,
      );
    }
    if (!(await holdsAudio(backend, wasiPath, handle))) {
      throw new InvalidFormatError(
        `Failed to load audio file. File may be corrupted or in an unsupported format. Path: ${displayPath}`,
      );
    }
    return handle;
  } catch (error) {
    handle.destroy();
    throw error;
  }
}

/** Whether either signal fires: the parse read an audio property, or the head is
 * content a detector knows. */
async function holdsAudio(
  backend: PathOpenHost,
  wasiPath: string,
  handle: FileHandle,
): Promise<boolean> {
  return statesAudioProperties(handle) ||
    await hasRecognizableHead(backend, wasiPath);
}

/**
 * Whether the parse read an audio property out of the file.
 *
 * `mpegVersion`, `mpegLayer` and `formatVersion` are deliberately not evidence —
 * the boundary writes them for any file the extension named MPEG, junk included
 * (a 1 KiB junk `.mp3` and a zero-byte one both report `mpegVersion: 1`,
 * measured) — and neither are `codec`/`containerFormat`/`isLossless`, which are
 * the file class's opinion of itself rather than something read from the audio.
 *
 * Tags are not part of this signal either: a tag-only file's head *is* the tag,
 * so the second signal covers it, and counting tags here would keep a file whose
 * only finding is a tag TagLib parsed out of corrupt bytes (measured:
 * `lib/taglib/tests/data/64bit.mp4` yields one).
 */
function statesAudioProperties(handle: FileHandle): boolean {
  const audio = handle.getAudioProperties();
  return audio !== null &&
    (audio.sampleRate > 0 || audio.channels > 0 || audio.bitrate > 0 ||
      audio.duration > 0 || audio.bitsPerSample > 0);
}

/**
 * Whether the head is content a detector knows. A path no preopen covers is
 * `false` too — the guest cannot read it either, and the failure it earns is the
 * same `InvalidFormatError`.
 */
async function hasRecognizableHead(
  backend: PathOpenHost,
  wasiPath: string,
): Promise<boolean> {
  const wasi = backend.hostModule;
  const hostPath = wasi.hostPathFor(wasiPath);
  if (hostPath === undefined) return false;

  const head = await readPartialFileData(hostPath, HEADER_WINDOW, 0);
  return detectsFormat(wasi, head) || opensAsBuffer(wasi, head);
}

function detectsFormat(
  wasi: WasiModule,
  head: Uint8Array,
): boolean {
  const ptr = wasi.malloc(Math.max(head.length, 1));
  try {
    new Uint8Array(wasi.memory.buffer).set(head, ptr);
    return wasi.tl_detect_format(ptr, head.length) !== TL_FORMAT_AUTO;
  } finally {
    wasi.free(ptr);
  }
}

/** Whether the buffer branch accepts these bytes — the same call `TagLib.open()`
 * makes for a `Uint8Array`, whose acceptance is the authority here. Only the
 * acceptance is of interest, so the tag snapshot is dropped. */
function opensAsBuffer(wasi: WasiModule, head: Uint8Array): boolean {
  try {
    readTagsFromWasm(wasi, head);
    return true;
  } catch (error) {
    if (error instanceof InvalidFormatError) return false;
    throw error;
  }
}
