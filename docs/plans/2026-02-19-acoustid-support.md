# ADR: AcoustID Audio Fingerprinting Support

**Status:** Proposed

## Context

taglib-wasm is a Wasm-based audio metadata library supporting MP3, FLAC, OGG,
WAV, and M4A. Users who have music files with missing or incorrect metadata need
a way to identify tracks programmatically. AcoustID — the open-source audio
identification service backed by Chromaprint fingerprinting — is the standard
solution used by tools like MusicBrainz Picard and beets.

The library already has infrastructure for AcoustID metadata:

- `ExtendedTag.acoustidFingerprint` and `acoustidId` fields
  (`src/types/tags.ts:52-55`)
- Read/write via `getAcoustIdFingerprint()` / `setAcoustIdFingerprint()`
  (`src/taglib/audio-file-extended.ts:32-45`)
- Format mappings for ID3v2 TXXX, Vorbis comments, and MP4 atoms
  (`src/constants/specialized-properties.ts:98-118`)

What's missing: fingerprint computation and service integration.

## Decision

Add AcoustID support in two components:

### Component 1: Chromaprint Wasm (Fingerprint Generation)

Compile the [Chromaprint](https://github.com/acoustid/chromaprint) C library to
WebAssembly.

**Feasibility assessment:**

- Language: C/C++ with CMake build — same toolchain as TagLib
- FFT dependency: Use bundled KissFFT (`-DFFT_LIB=kissfft`), no external FFmpeg
  needed
- Expected binary size: ~50-150KB (KissFFT is ~18KB, Chromaprint core is small)
- Existing Wasm attempts: Only unmaintained Rust wrappers exist. No C-to-Wasm
  compilation has been done — this would be a first
- Build approach: Integrate with existing WASI build pipeline
  (`build/build-wasi.sh` pattern)

**Chromaprint C API surface (5 core functions):**

```c
ChromaprintContext *chromaprint_new(int algorithm);
int chromaprint_start(ChromaprintContext *ctx, int sample_rate, int num_channels);
int chromaprint_feed(ChromaprintContext *ctx, const int16_t *data, int size);
int chromaprint_finish(ChromaprintContext *ctx);
int chromaprint_get_fingerprint(ChromaprintContext *ctx, char **fingerprint);
```

**Audio input requirements:**

- Raw PCM: 16-bit signed integers, interleaved stereo
- Any sample rate (internally resamples to 11025 Hz)
- Minimum ~12 seconds for reliable fingerprints; optimal ~120 seconds
- Fingerprints are deterministic: same audio always produces the same
  fingerprint

### Component 2: AcoustID Lookup Client

A TypeScript HTTP client for the AcoustID web service.

**API details:**

- Endpoint: `GET/POST https://api.acoustid.org/v2/lookup`
- Required params: `client` (API key), `duration` (seconds), `fingerprint`
  (base64)
- Optional: `meta` param to request `recordings`, `releases`, `tracks` metadata
- Response: JSON with matched recordings and MusicBrainz IDs
- Rate limit: 3 requests/second
- Authentication: Client API key required (free registration at acoustid.org)

**Proposed TypeScript API sketch:**

```typescript
// Fingerprint generation
function generateFingerprint(
  pcm: Int16Array,
  sampleRate: number,
  channels: number,
): string;

// AcoustID lookup
interface AcoustIdOptions {
  apiKey: string;
}
interface AcoustIdResult {
  id: string;
  score: number;
  recordings: Recording[];
}
function lookupFingerprint(
  fingerprint: string,
  duration: number,
  options: AcoustIdOptions,
): Promise<AcoustIdResult[]>;

// High-level: identify + tag (combines both)
function identifyTrack(
  pcm: Int16Array,
  sampleRate: number,
  duration: number,
  options: AcoustIdOptions,
): Promise<AcoustIdResult[]>;
```

## Open Questions

### 1. PCM Source Strategy

How should users get raw PCM audio data into Chromaprint?

| Option                                  | Pros                                                         | Cons                                                                        |
| --------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **A: User provides PCM**                | Minimal scope, focused library, small binary                 | Higher friction, user handles decoding + resampling                         |
| **B: Bundle decoders**                  | Self-contained "file to fingerprint", supports all 5 formats | +200-500KB per codec, scope creep into audio processing, maintenance burden |
| **C: Hybrid (optional decoder module)** | Best of both — core takes PCM, optional decoders available   | More complex API surface, two code paths                                    |

Recommendation: Option A aligns with "library-first, minimal dependencies"
philosophy. Document how to get PCM via Web Audio API (`decodeAudioData`) and
ffmpeg. Decoders could be a separate package later.

### 2. Packaging

Where does the AcoustID lookup client live?

| Option                                           | Pros                                                                | Cons                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **In taglib-wasm** (e.g. `taglib-wasm/acoustid`) | Single package, discoverable, can integrate with tag write workflow | Adds network dependency to a local-only library, API key management |
| **Separate package** (e.g. `@charlesw/acoustid`) | Keeps taglib-wasm purely local, clean separation of concerns        | Two packages to maintain, less integrated experience                |

### 3. License Implications

Chromaprint overall is LGPL 2.1 (due to bundled FFmpeg resampler code). However:

- The Chromaprint source code itself is MIT
- Using KissFFT backend (`-DFFT_LIB=kissfft`) avoids all FFmpeg code
- With KissFFT, the compiled binary is effectively MIT-compatible
- The Chromaprint developers plan to remove FFmpeg code and make MIT the sole
  license
- **Mitigation:** Build with `-DFFT_LIB=kissfft` and verify no LGPL code is
  linked. Document license in distribution.

### 4. Wasm Binary Strategy

Ship Chromaprint as a separate Wasm binary or combine with TagLib?

| Option                                   | Pros                                                                   | Cons                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Separate binary** (`chromaprint.wasm`) | Tree-shakeable, users who don't need fingerprinting don't pay the cost | Two Wasm modules to load and manage                           |
| **Combined binary**                      | Single module, simpler initialization                                  | Larger binary for all users, even those who don't fingerprint |

Recommendation: Separate binary. Aligns with tree-shaking philosophy and "pay
for what you use."

## Consequences

**If adopted:**

- taglib-wasm becomes a complete audio identification + tagging solution
- Users can identify unknown tracks and auto-populate tags in a single workflow
- The project gains a unique capability — no other JS/TS library offers
  Chromaprint-to-Wasm
- Build complexity increases (Chromaprint CMake + KissFFT alongside TagLib)
- Binary size increases by ~50-150KB (separate Wasm module, loaded on demand)

**If rejected:**

- Users continue providing pre-computed fingerprints (e.g. from `fpcalc` CLI)
- taglib-wasm remains focused on metadata read/write only
- Simpler maintenance, smaller scope

## References

- [Chromaprint GitHub](https://github.com/acoustid/chromaprint) — C library,
  MIT/LGPL 2.1
- [AcoustID Web Service](https://acoustid.org/webservice) — API docs
- [How Chromaprint Works](https://oxygene.sk/2011/01/how-does-chromaprint-work/)
  — Technical deep-dive
- [KissFFT](https://github.com/mborgerding/kissfft) — BSD-licensed FFT library
- Existing taglib-wasm AcoustID infrastructure: `src/types/tags.ts`,
  `src/taglib/audio-file-extended.ts`, `src/constants/specialized-properties.ts`
