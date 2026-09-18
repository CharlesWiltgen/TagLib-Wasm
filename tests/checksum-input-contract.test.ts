/**
 * @fileoverview taglib-j9ld: one contract for every input `readMediaChecksum()`
 * cannot read.
 *
 * The class is decided by the *input*, never by the backend or by the input's
 * form: a corrupt file answers the same error whether it arrives as a path or
 * as bytes, and the same error on WASI as on Emscripten. Measured at HEAD, four
 * kinds violated that — a zero-length input arrived as `WasmMemoryError`, an
 * unrecognized extension arrived as `WasmMemoryError`, and a *corrupt* file
 * opened by path answered a whole-file checksum instead of an error (the walk
 * fell back, because the extension had already decided the file's fate).
 *
 * The two honest answers are unchanged and pinned below: a format with no walk
 * answers `source: "file"`, and so does a format whose walk gives up — the
 * checksum's `source` says what was hashed, not whether the file was good.
 */

import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, describe, it } from "@std/testing/bdd";
import { resolve } from "@std/path";
import type { AudioFileInput } from "../src/types.ts";
import type { WasmModule } from "../src/wasm.ts";
import type { AudioFile } from "../src/taglib/index.ts";
import type { TagLibError } from "../src/errors.ts";
import { readMediaChecksum, setBufferMode } from "../src/simple/index.ts";
import { TagLib } from "../src/taglib.ts";
import { loadUnifiedTagLibModule } from "../src/runtime/unified-loader/index.ts";
import { FileOperationError, InvalidFormatError } from "../src/errors.ts";
import { HAS_WASI } from "./backend-adapter.ts";

const TEMP_DIR = await Deno.makeTempDir({ prefix: "taglib-j9ld-" });

/**
 * 1 KiB of bytes with no container signature: the shape a truncation or a disk
 * error leaves behind. The pattern is arbitrary, but its first bytes are not
 * `0xFF`/`0x49`/`0x66`, so no detector can recognise it as audio.
 */
const JUNK = new Uint8Array(1024);
for (let i = 0; i < JUNK.length; i++) JUNK[i] = (i * 37 + 11) & 0xff;

/** The same bytes behind an MPEG frame sync: a format IS recognised here, so it
 * is the walk that gives up — the fallback that must stay honest. */
const JUNK_MPEG_SYNC = Uint8Array.from([
  0xff,
  0xfb,
  0x90,
  0x00,
  ...JUNK.slice(4),
]);

await Deno.writeFile(`${TEMP_DIR}/empty.mp3`, new Uint8Array(0));
await Deno.writeFile(`${TEMP_DIR}/empty.bin`, new Uint8Array(0));
await Deno.writeFile(`${TEMP_DIR}/empty.mpc`, new Uint8Array(0));
await Deno.writeFile(`${TEMP_DIR}/junk.mp3`, JUNK);
await Deno.writeFile(`${TEMP_DIR}/junk.bin`, JUNK);
await Deno.writeFile(`${TEMP_DIR}/junk.txt`, JUNK);
await Deno.writeFile(`${TEMP_DIR}/mpeg-sync-junk.mp3`, JUNK_MPEG_SYNC);

afterAll(async () => {
  await Deno.remove(TEMP_DIR, { recursive: true });
});

/** The fixture paths both backends must agree on, with the digest's own
 * `source` for each: a payload walk for the four formats that have one, the
 * whole file for the formats that do not. */
const READABLE: Array<[string, string]> = [
  ["tests/test-files/mp3/kiss-snippet.mp3", "audio-payload"],
  ["tests/test-files/flac/kiss-snippet.flac", "audio-payload"],
  ["tests/test-files/mp4/kiss-snippet.m4a", "audio-payload"],
  ["tests/test-files/wav/kiss-snippet.wav", "audio-payload"],
  ["tests/test-files/ogg/kiss-snippet.ogg", "file"],
  ["tests/test-files/wma/kiss-snippet.wma", "file"],
  ["tests/test-files/wv/kiss-snippet.wv", "file"],
  ["tests/test-files/tta/kiss-snippet.tta", "file"],
];

type Outcome = `ok:${string}` | `throw:${string}`;

/** What a call observed: the error class, or the digest's `source`. Nothing
 * else — the contract is about the class, not about a message. */
async function outcome(run: () => Promise<unknown>): Promise<Outcome> {
  try {
    const { source } = await run() as { source: string };
    return `ok:${source}`;
  } catch (error) {
    return `throw:${(error as TagLibError).code}`;
  }
}

/** The unreadable inputs, each with the verdict every backend and every form
 * must reach. `INVALID_FORMAT` is "not audio"; `FILE_OPERATION` is "not there",
 * which a path reaches by the same route a buffer-mode open does: the read
 * fails before anything is asked of the decoder. */
const UNREADABLE: Array<
  [string, (dir: string) => AudioFileInput, Outcome]
> = [
  ["zero-length Uint8Array", () => new Uint8Array(0), "throw:INVALID_FORMAT"],
  ["zero-length ArrayBuffer", () => new ArrayBuffer(0), "throw:INVALID_FORMAT"],
  [
    "zero-length File",
    () => new File([], "empty.mp3", { type: "audio/mpeg" }),
    "throw:INVALID_FORMAT",
  ],
  [
    "zero-length path (.mp3)",
    (dir) => `${dir}/empty.mp3`,
    "throw:INVALID_FORMAT",
  ],
  [
    "zero-length path (.bin)",
    (dir) => `${dir}/empty.bin`,
    "throw:INVALID_FORMAT",
  ],
  [
    // The extension whose parser claims a property for zero bytes: an empty
    // `.mpc` reported sampleRate 44100 and duration 97391, so the content
    // signals cannot be the authority for a zero-byte file.
    "zero-length path (.mpc)",
    (dir) => `${dir}/empty.mpc`,
    "throw:INVALID_FORMAT",
  ],
  ["junk Uint8Array", () => JUNK, "throw:INVALID_FORMAT"],
  ["junk ArrayBuffer", () => JUNK.slice().buffer, "throw:INVALID_FORMAT"],
  [
    "junk File (.mp3)",
    () => new File([JUNK], "junk.mp3", { type: "audio/mpeg" }),
    "throw:INVALID_FORMAT",
  ],
  ["junk path (.mp3)", (dir) => `${dir}/junk.mp3`, "throw:INVALID_FORMAT"],
  ["junk path (.bin)", (dir) => `${dir}/junk.bin`, "throw:INVALID_FORMAT"],
  ["junk path (.txt)", (dir) => `${dir}/junk.txt`, "throw:INVALID_FORMAT"],
  [
    "missing path (.mp3)",
    (dir) => `${dir}/absent.mp3`,
    "throw:FILE_OPERATION",
  ],
];

/** The two backends the contract holds on. `setBufferMode(false)` is the
 * runtime's own choice (WASI under `deno test`); `true` forces Emscripten, the
 * only backend a browser has. */
const BACKENDS: Array<{ id: BackendId; enable(): void }> = [
  { id: "wasi", enable: () => setBufferMode(false) },
  { id: "emscripten", enable: () => setBufferMode(true) },
];

type BackendId = "wasi" | "emscripten";

const instances: Partial<Record<BackendId, Promise<TagLib>>> = {};

/** One instance per backend, created on first use: `TagLib.initialize()`
 * compiles the module, so a per-fixture call would compile it hundreds of
 * times — and lazily, so a backend that cannot load fails in its own test
 * rather than at this file's import. */
function taglib(backend: BackendId): Promise<TagLib> {
  return instances[backend] ??= TagLib.initialize({ forceWasmType: backend });
}

/** The verdict an open reaches: the format it reports, or the class it throws.
 * Both forms of the same bytes must reach the same one. */
async function openVerdict(
  backend: BackendId,
  input: string | Uint8Array,
): Promise<string> {
  const instance = await taglib(backend);
  let file: AudioFile;
  try {
    file = await instance.open(input);
  } catch (error) {
    return `throw:${(error as TagLibError).code}`;
  }
  try {
    return file.getFormat();
  } finally {
    file.dispose();
  }
}

describe("unreadable inputs", () => {
  for (const backend of BACKENDS) {
    it(`[${backend.id}] every input kind reports its contract class`, async () => {
      backend.enable();
      for (const [label, make, expected] of UNREADABLE) {
        assertEquals(
          await outcome(() => readMediaChecksum(make(TEMP_DIR))),
          expected,
          `${backend.id}: ${label}`,
        );
      }
    });
  }

  it("the backend this suite calls 'wasi' really is WASI", async () => {
    const module = await loadUnifiedTagLibModule();
    assertEquals(module.isWasi, true);
  });
});

describe("readable inputs", () => {
  for (const backend of BACKENDS) {
    it(`[${backend.id}] keeps the payload walks and the whole-file fallback`, async () => {
      backend.enable();
      for (const [path, source] of READABLE) {
        assertEquals(
          await outcome(() => readMediaChecksum(resolve(path))),
          `ok:${source}`,
          `${backend.id}: ${path} by path`,
        );
        assertEquals(
          await outcome(() => readMediaChecksum(Deno.readFileSync(path))),
          `ok:${source}`,
          `${backend.id}: ${path} by buffer`,
        );
      }
    });

    it(`[${backend.id}] answers a whole-file digest when a walk gives up`, async () => {
      backend.enable();
      const path = `${TEMP_DIR}/mpeg-sync-junk.mp3`;
      for (const input of [path, JUNK_MPEG_SYNC]) {
        const sum = await readMediaChecksum(input);
        assertEquals(sum.source, "file", `${backend.id}: source`);
        assertEquals(
          sum.bytesHashed,
          JUNK_MPEG_SYNC.length,
          `${backend.id}: bytesHashed`,
        );
      }
    });
  }
});

/**
 * The two corpora, one row per fixture: the verdict a *path* reaches and the
 * verdict the same bytes reach as a *buffer*. The expectations are pinned per
 * form rather than asserted equal, because the two forms were never equal — the
 * buffer form's content detector is narrower than TagLib's path open, and this
 * change must not narrow the path form below "TagLib read something".
 *
 * What is asserted is the direction that matters: a path may not accept bytes
 * the buffer form refuses, bar {@link PATH_ACCEPTS_WHILE_BUFFER_REFUSES}.
 *
 * `tests/test-files` is our own corpus. `lib/taglib/tests/data` is upstream's
 * pinned fixture set: it supplies the formats we keep no fixture of our own for
 * (APE, DSF, DSDIFF, MPC, SHN, MOD/S3M/IT/XM) and, in its deliberately corrupt
 * files (`garbage.mp3`, `sv4_header.mpc`, `stripped.xm`, …), every refusal.
 */
const OWN_CORPUS: Array<[string, string, string]> = [
  ["tests/test-files/aac/empty1s.aac", "AAC", "AAC"],
  ["tests/test-files/flac/bext-ixml.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/flac-appended-ape.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/flac-appended-id3v1.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/flac-both-tags.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/flac-prepended-id3v2-footer.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/flac-prepended-id3v2.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/kiss-snippet.flac", "FLAC", "FLAC"],
  ["tests/test-files/matroska/kiss-snippet.mka", "MATROSKA", "MATROSKA"],
  ["tests/test-files/matroska/kiss-snippet.mkv", "MATROSKA", "MATROSKA"],
  ["tests/test-files/matroska/kiss-snippet.webm", "MATROSKA", "MATROSKA"],
  ["tests/test-files/mp3/bitrate-mode/abr-lame.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/bitrate-mode/cbr-lame.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/bitrate-mode/no-xing.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/bitrate-mode/vbr-lame.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/bitrate-mode/vbri.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/chapters-id3.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/kiss-snippet.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/large-1_2MiB.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/tags-only.mp3", "MP3", "MP3"],
  ["tests/test-files/mp4/ac3.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/chapters-both.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/chapters-qt.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/eac3.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/flac.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/genre-gnre-after.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/genre-gnre-before.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/genre-gnre-omit.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/genre-gnre-only.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/kiss-snippet.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/kiss-snippet.mp4", "MP4", "MP4"],
  ["tests/test-files/mp4/opus.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/synth-multi-mdat.mp4", "MP4", "MP4"],
  ["tests/test-files/oga/kiss-snippet-flac.oga", "OggFLAC", "OggFLAC"],
  ["tests/test-files/oga/kiss-snippet.oga", "OGG", "OGG"],
  ["tests/test-files/ogg/kiss-snippet.ogg", "OGG", "OGG"],
  ["tests/test-files/opus/kiss-snippet-gain.opus", "OPUS", "OPUS"],
  ["tests/test-files/opus/kiss-snippet.opus", "OPUS", "OPUS"],
  ["tests/test-files/speex/kiss-snippet.spx", "SPEEX", "SPEEX"],
  ["tests/test-files/tta/kiss-snippet.tta", "TTA", "TTA"],
  ["tests/test-files/wav/bext-ixml.wav", "WAV", "WAV"],
  ["tests/test-files/wav/kiss-snippet.wav", "WAV", "WAV"],
  ["tests/test-files/wav/synth-multi-data.wav", "WAV", "WAV"],
  ["tests/test-files/wav/synth-plain.wav", "WAV", "WAV"],
  ["tests/test-files/wav/synth-tags-before-data.wav", "WAV", "WAV"],
  ["tests/test-files/wma/kiss-snippet.wma", "ASF", "ASF"],
  ["tests/test-files/wma/wma-lowercase-attr.wma", "ASF", "ASF"],
  ["tests/test-files/wv/kiss-snippet.wv", "WV", "WV"],
];

const UPSTREAM_CORPUS: Array<[string, string, string]> = [
  ["lib/taglib/tests/data/2sec-silence.shn", "SHN", "SHN"],
  [
    "lib/taglib/tests/data/64bit.mp4",
    "throw:INVALID_FORMAT",
    "throw:INVALID_FORMAT",
  ],
  ["lib/taglib/tests/data/ac3.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/alaw.aifc", "AIFF", "AIFF"],
  ["lib/taglib/tests/data/alaw.wav", "WAV", "WAV"],
  ["lib/taglib/tests/data/ape-id3v1.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/ape-id3v2.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/ape.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/bladeenc.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/changed.mod", "MOD", "MOD"],
  ["lib/taglib/tests/data/changed.s3m", "S3M", "S3M"],
  ["lib/taglib/tests/data/changed.xm", "XM", "XM"],
  ["lib/taglib/tests/data/click.mpc", "MPC", "MPC"],
  ["lib/taglib/tests/data/click.wv", "WV", "WV"],
  ["lib/taglib/tests/data/compressed_id3_frame.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/compressed_id3_frame_invalid.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/correctness_gain_silent_output.opus", "OPUS", "OPUS"],
  ["lib/taglib/tests/data/covr-junk.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/dsd_stereo.wv", "WV", "WV"],
  ["lib/taglib/tests/data/duplicate_id3v2.aiff", "AIFF", "AIFF"],
  ["lib/taglib/tests/data/duplicate_id3v2.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/duplicate_tags.wav", "WAV", "WAV"],
  ["lib/taglib/tests/data/eac3.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/empty-seektable.flac", "FLAC", "FLAC"],
  ["lib/taglib/tests/data/empty.aiff", "AIFF", "AIFF"],
  ["lib/taglib/tests/data/empty.ogg", "OGG", "OGG"],
  ["lib/taglib/tests/data/empty.spx", "SPEEX", "SPEEX"],
  ["lib/taglib/tests/data/empty.tta", "TTA", "TTA"],
  ["lib/taglib/tests/data/empty.wav", "WAV", "WAV"],
  ["lib/taglib/tests/data/empty10ms.dff", "DSDIFF", "DSDIFF"],
  ["lib/taglib/tests/data/empty10ms.dsf", "DSF", "DSF"],
  ["lib/taglib/tests/data/empty1s.aac", "AAC", "AAC"],
  ["lib/taglib/tests/data/empty_alac.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/empty_flac.oga", "OggFLAC", "OggFLAC"],
  ["lib/taglib/tests/data/empty_vorbis.oga", "OGG", "OGG"],
  [
    "lib/taglib/tests/data/excessive_alloc.aif",
    "throw:INVALID_FORMAT",
    "throw:INVALID_FORMAT",
  ],
  ["lib/taglib/tests/data/excessive_alloc.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/extended-header.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/flac.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/flac96.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/float64.wav", "WAV", "WAV"],
  ["lib/taglib/tests/data/four_channels.wv", "WV", "WV"],
  ["lib/taglib/tests/data/garbage.mp3", "MP3", "throw:INVALID_FORMAT"],
  ["lib/taglib/tests/data/gnre.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/has-tags.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/id3v22-tda.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/ilst-is-last.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/infloop.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/infloop.mpc", "MPC", "MPC"],
  ["lib/taglib/tests/data/infloop.wav", "WAV", "WAV"],
  ["lib/taglib/tests/data/infloop.wv", "WV", "WV"],
  ["lib/taglib/tests/data/invalid-chunk.wav", "WAV", "WAV"],
  ["lib/taglib/tests/data/invalid-frames1.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/invalid-frames2.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/invalid-frames3.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/itunes10.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/lame_cbr.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/lame_vbr.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/longloop.ape", "APE", "APE"],
  ["lib/taglib/tests/data/lossless.wma", "ASF", "ASF"],
  ["lib/taglib/tests/data/lowercase-fields.ogg", "OGG", "OGG"],
  ["lib/taglib/tests/data/mac-390-hdr.ape", "APE", "APE"],
  ["lib/taglib/tests/data/mac-396.ape", "APE", "APE"],
  ["lib/taglib/tests/data/mac-399-id3v2.ape", "APE", "APE"],
  ["lib/taglib/tests/data/mac-399-tagged.ape", "APE", "APE"],
  ["lib/taglib/tests/data/mac-399.ape", "APE", "APE"],
  ["lib/taglib/tests/data/mpeg-sync-flac.flac", "FLAC", "FLAC"],
  ["lib/taglib/tests/data/mpeg2.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/multiple-vc.flac", "FLAC", "FLAC"],
  ["lib/taglib/tests/data/multiplex.ogg", "OGG", "OGG"],
  ["lib/taglib/tests/data/no-tags.flac", "FLAC", "FLAC"],
  ["lib/taglib/tests/data/no-tags.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/no-tags.mka", "MATROSKA", "MATROSKA"],
  ["lib/taglib/tests/data/no-tags.webm", "MATROSKA", "MATROSKA"],
  ["lib/taglib/tests/data/no_length.wv", "WV", "WV"],
  ["lib/taglib/tests/data/noise.aif", "AIFF", "AIFF"],
  ["lib/taglib/tests/data/noise_odd.aif", "AIFF", "AIFF"],
  ["lib/taglib/tests/data/non-full-meta.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/non_standard_rate.wv", "WV", "WV"],
  ["lib/taglib/tests/data/nonprintable-atom-type.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/optimized.mkv", "MATROSKA", "MATROSKA"],
  ["lib/taglib/tests/data/opus.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/pcm_with_fact_chunk.wav", "WAV", "WAV"],
  ["lib/taglib/tests/data/rare_frames.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/real_example.wma", "ASF", "ASF"],
  ["lib/taglib/tests/data/rf64.wav", "WAV", "WAV"],
  ["lib/taglib/tests/data/segfault.aif", "AIFF", "AIFF"],
  ["lib/taglib/tests/data/segfault.mpc", "MPC", "MPC"],
  [
    "lib/taglib/tests/data/segfault.oga",
    "throw:INVALID_FORMAT",
    "throw:INVALID_FORMAT",
  ],
  ["lib/taglib/tests/data/segfault.wav", "WAV", "WAV"],
  ["lib/taglib/tests/data/segfault2.mpc", "MPC", "MPC"],
  ["lib/taglib/tests/data/silence-1.wma", "ASF", "ASF"],
  ["lib/taglib/tests/data/silence-44-s.flac", "FLAC", "FLAC"],
  ["lib/taglib/tests/data/sinewave.flac", "FLAC", "FLAC"],
  ["lib/taglib/tests/data/stripped.xm", "XM", "throw:INVALID_FORMAT"],
  ["lib/taglib/tests/data/sv4_header.mpc", "MPC", "throw:INVALID_FORMAT"],
  ["lib/taglib/tests/data/sv5_header.mpc", "MPC", "throw:INVALID_FORMAT"],
  ["lib/taglib/tests/data/sv8_header.mpc", "MPC", "MPC"],
  ["lib/taglib/tests/data/tagged.tta", "TTA", "TTA"],
  ["lib/taglib/tests/data/tagged.wv", "WV", "WV"],
  ["lib/taglib/tests/data/tags-before-cues.mkv", "MATROSKA", "MATROSKA"],
  ["lib/taglib/tests/data/test.it", "IT", "IT"],
  ["lib/taglib/tests/data/test.mod", "MOD", "MOD"],
  ["lib/taglib/tests/data/test.ogg", "OGG", "OGG"],
  ["lib/taglib/tests/data/test.s3m", "S3M", "S3M"],
  ["lib/taglib/tests/data/test.xm", "XM", "XM"],
  ["lib/taglib/tests/data/toc_many_children.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/uint8we.wav", "WAV", "WAV"],
  ["lib/taglib/tests/data/w000.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/xing.mp3", "MP3", "MP3"],
  ["lib/taglib/tests/data/zero-length-mdat.m4a", "MP4", "MP4"],
  ["lib/taglib/tests/data/zero-size-chunk.wav", "WAV", "WAV"],
  ["lib/taglib/tests/data/zero-sized-padding.flac", "FLAC", "FLAC"],
  ["lib/taglib/tests/data/zerodiv.ape", "APE", "APE"],
  ["lib/taglib/tests/data/zerodiv.mpc", "MPC", "MPC"],
];

/** The own corpus on the Emscripten backend, which this change does not touch:
 * pinned so that a WASI-side change cannot quietly diverge from it. */
const OWN_CORPUS_EMSCRIPTEN: Array<[string, string, string]> = [
  ["tests/test-files/aac/empty1s.aac", "AAC", "AAC"],
  ["tests/test-files/flac/bext-ixml.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/flac-appended-ape.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/flac-appended-id3v1.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/flac-both-tags.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/flac-prepended-id3v2-footer.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/flac-prepended-id3v2.flac", "FLAC", "FLAC"],
  ["tests/test-files/flac/kiss-snippet.flac", "FLAC", "FLAC"],
  ["tests/test-files/matroska/kiss-snippet.mka", "MATROSKA", "MATROSKA"],
  ["tests/test-files/matroska/kiss-snippet.mkv", "MATROSKA", "MATROSKA"],
  ["tests/test-files/matroska/kiss-snippet.webm", "MATROSKA", "MATROSKA"],
  ["tests/test-files/mp3/bitrate-mode/abr-lame.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/bitrate-mode/cbr-lame.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/bitrate-mode/no-xing.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/bitrate-mode/vbr-lame.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/bitrate-mode/vbri.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/chapters-id3.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/kiss-snippet.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/large-1_2MiB.mp3", "MP3", "MP3"],
  ["tests/test-files/mp3/tags-only.mp3", "MP3", "MP3"],
  ["tests/test-files/mp4/ac3.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/chapters-both.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/chapters-qt.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/eac3.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/flac.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/genre-gnre-after.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/genre-gnre-before.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/genre-gnre-omit.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/genre-gnre-only.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/kiss-snippet.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/kiss-snippet.mp4", "MP4", "MP4"],
  ["tests/test-files/mp4/opus.m4a", "MP4", "MP4"],
  ["tests/test-files/mp4/synth-multi-mdat.mp4", "MP4", "MP4"],
  ["tests/test-files/oga/kiss-snippet-flac.oga", "OggFLAC", "OggFLAC"],
  ["tests/test-files/oga/kiss-snippet.oga", "OGG", "OGG"],
  ["tests/test-files/ogg/kiss-snippet.ogg", "OGG", "OGG"],
  ["tests/test-files/opus/kiss-snippet-gain.opus", "OPUS", "OPUS"],
  ["tests/test-files/opus/kiss-snippet.opus", "OPUS", "OPUS"],
  ["tests/test-files/speex/kiss-snippet.spx", "SPEEX", "SPEEX"],
  ["tests/test-files/tta/kiss-snippet.tta", "TTA", "TTA"],
  ["tests/test-files/wav/bext-ixml.wav", "WAV", "WAV"],
  ["tests/test-files/wav/kiss-snippet.wav", "WAV", "WAV"],
  ["tests/test-files/wav/synth-multi-data.wav", "WAV", "WAV"],
  ["tests/test-files/wav/synth-plain.wav", "WAV", "WAV"],
  ["tests/test-files/wav/synth-tags-before-data.wav", "WAV", "WAV"],
  ["tests/test-files/wma/kiss-snippet.wma", "ASF", "ASF"],
  ["tests/test-files/wma/wma-lowercase-attr.wma", "ASF", "ASF"],
  ["tests/test-files/wv/kiss-snippet.wv", "WV", "WV"],
];

/**
 * Rows where the path form accepts and the buffer form refuses, measured: the
 * parse reads a property out of upstream's deliberately corrupt bytes (an SV4
 * or SV5 MPC header, junk carrying a frame header, an XM with its tag stripped),
 * so TagLib can read *something* and the path form keeps answering exactly as it
 * did before this change. The buffer form's magic rules cannot place those
 * bytes — the reachability gap taglib-uat8 covers — and refusing them here would
 * mean refusing files the parse did read.
 *
 * Pinned as a set, not as a count: widening it is the defect this test is here
 * to catch.
 */
const PATH_ACCEPTS_WHILE_BUFFER_REFUSES: string[] = [
  "lib/taglib/tests/data/garbage.mp3",
  "lib/taglib/tests/data/stripped.xm",
  "lib/taglib/tests/data/sv4_header.mpc",
  "lib/taglib/tests/data/sv5_header.mpc",
];

describe("corpus: a path and a buffer reach the verdict their bytes earn", () => {
  const CORPORA: Array<[string, Array<[string, string, string]>]> = [
    ["tests/test-files", OWN_CORPUS],
    ["lib/taglib/tests/data", UPSTREAM_CORPUS],
  ];

  for (const [corpus, rows] of CORPORA) {
    it(`[wasi] ${corpus}, ${rows.length} fixtures, both forms`, async () => {
      for (const [path, expectedPath, expectedBuffer] of rows) {
        assertEquals(
          await openVerdict("wasi", path),
          expectedPath,
          `path: ${path}`,
        );
        assertEquals(
          await openVerdict("wasi", Deno.readFileSync(path)),
          expectedBuffer,
          `buffer: ${path}`,
        );
      }
    });
  }

  it("[wasi] a path never accepts what the buffer form refuses, bar the pinned rows", () => {
    const asymmetric = [...OWN_CORPUS, ...UPSTREAM_CORPUS]
      .filter(([, pathVerdict, bufferVerdict]) =>
        bufferVerdict.startsWith("throw:") && !pathVerdict.startsWith("throw:")
      )
      .map(([path]) => path)
      .sort();
    assertEquals(asymmetric, [...PATH_ACCEPTS_WHILE_BUFFER_REFUSES].sort());
  });

  it("[emscripten] tests/test-files, both forms", async () => {
    for (const [path, expectedPath, expectedBuffer] of OWN_CORPUS_EMSCRIPTEN) {
      assertEquals(
        await openVerdict("emscripten", path),
        expectedPath,
        `path: ${path}`,
      );
      assertEquals(
        await openVerdict("emscripten", Deno.readFileSync(path)),
        expectedBuffer,
        `buffer: ${path}`,
      );
    }
  });
});

/**
 * Heads too short for any detector. The contract's rule is the bytes, so a few
 * bytes must be refused by path exactly when the same bytes are refused as a
 * buffer — and the format name is not part of the claim here: an eight-byte
 * file's *name* still selects the file class, which is TagLib's own resolution
 * and not something this contract touches.
 */
const TINY_HEADS: Array<[string, number[], string, string]> = [
  [
    "flac-marker-10",
    [0x66, 0x4c, 0x61, 0x43, 0, 0, 0, 0, 0, 0],
    "flac",
    "throw:INVALID_FORMAT",
  ],
  [
    "flac-marker-11",
    [0x66, 0x4c, 0x61, 0x43, 0, 0, 0, 0, 0, 0, 0],
    "flac",
    "throw:INVALID_FORMAT",
  ],
  [
    "riff-wave-12",
    [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45],
    "wav",
    "WAV",
  ],
  [
    "oggs-12",
    [0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0, 0, 0, 0, 0],
    "ogg",
    "throw:INVALID_FORMAT",
  ],
  [
    "mpeg-sync-8",
    [0xff, 0xfb, 0x90, 0x00, 0, 0, 0, 0],
    "mp3",
    "throw:INVALID_FORMAT",
  ],
  ["tta-8", [0x54, 0x54, 0x41, 0x31, 0, 0, 0, 0], "tta", "TTA"],
  [
    "dsd-8",
    [0x44, 0x53, 0x44, 0x20, 0, 0, 0, 0],
    "dsf",
    "throw:INVALID_FORMAT",
  ],
  ["ape-8", [0x4d, 0x41, 0x43, 0x20, 0, 0, 0, 0], "ape", "APE"],
  ["wvpk-8", [0x77, 0x76, 0x70, 0x6b, 0, 0, 0, 0], "wv", "WV"],
  ["two-bytes", [0xff, 0xfb], "mp3", "throw:INVALID_FORMAT"],
];

describe("degenerate heads", () => {
  it("[wasi] a file of a few bytes answers what the same bytes answer as a buffer", async () => {
    for (const [name, bytes, ext, expected] of TINY_HEADS) {
      const path = `${TEMP_DIR}/${name}.${ext}`;
      await Deno.writeFile(path, Uint8Array.from(bytes));
      assertEquals(await openVerdict("wasi", path), expected, `path: ${name}`);
      assertEquals(
        await openVerdict("wasi", Uint8Array.from(bytes)),
        expected,
        `buffer: ${name}`,
      );
    }
  });
});

/**
 * A path no preopen covers — the shape of a Windows drive letter the host did
 * not map. The host cannot reach it at all, so it fails as a file operation,
 * like a path that is not there; a path *inside* a preopen is still refused for
 * its content. Built through the loader and adapter rather than the default
 * backend, because only a custom preopen map can produce this namespace.
 */
describe("a path outside every preopen", () => {
  it(
    "[wasi] fails as a file operation, like a path that is not there",
    { ignore: !HAS_WASI },
    async () => {
      const { loadWasiHost } = await import(
        "../src/runtime/wasi-host-loader.ts"
      );
      const { WasiToTagLibAdapter } = await import(
        "../src/runtime/wasi-adapter/adapter.ts"
      );
      using wasi = await loadWasiHost({
        wasmPath: resolve("dist/wasi/taglib-wasi.wasm"),
        preopens: { "/mapped": TEMP_DIR },
      });
      const adapter = new WasiToTagLibAdapter(wasi);
      (adapter as { isWasi?: boolean }).isWasi = true;
      const instance = new TagLib(adapter as unknown as WasmModule);

      await assertRejects(
        () => instance.open("/outside/nothing.mp3"),
        FileOperationError,
        "outside the WASI preopens",
      );
      await assertRejects(
        () => instance.open("/mapped/junk.mp3"),
        InvalidFormatError,
        "corrupted or in an unsupported format",
      );
    },
  );
});

/**
 * Zero bytes are refused whatever the extension asks for: the parsers that claim
 * a property for an empty file (MPC does) are the reason this is a size test
 * rather than a content test. Every extension the corpora carry, on both
 * backends.
 */
const FORMAT_EXTENSIONS = [
  "mp3",
  "mp2",
  "aac",
  "m4a",
  "m4b",
  "mp4",
  "flac",
  "wav",
  "aif",
  "aiff",
  "aifc",
  "ogg",
  "oga",
  "opus",
  "spx",
  "wma",
  "asf",
  "ape",
  "wv",
  "tta",
  "mpc",
  "shn",
  "mka",
  "mkv",
  "webm",
  "mod",
  "s3m",
  "it",
  "xm",
  "dsf",
  "dff",
];

describe("zero bytes, extension sweep", () => {
  for (const backend of BACKENDS) {
    it(`[${backend.id}] refuses a zero-byte file for every extension`, async () => {
      backend.enable();
      for (const ext of FORMAT_EXTENSIONS) {
        const path = `${TEMP_DIR}/sweep-empty.${ext}`;
        await Deno.writeFile(path, new Uint8Array(0));
        assertEquals(
          await outcome(() => readMediaChecksum(path)),
          "throw:INVALID_FORMAT",
          `${backend.id}: empty .${ext} by path`,
        );
      }
    });
  }
});
