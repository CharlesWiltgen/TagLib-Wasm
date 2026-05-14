# ADR-0001: Dual Wasm/JS boundary protocols (Embind imperative vs. WASI declarative)

- **Status:** Proposed — decision deferred to `taglib-g0f` resolution
- **Date:** 2026-05-14
- **Deciders:** Charles Wiltgen (repo owner)

## Context

`taglib-wasm` ships two Wasm backends to cover the full JavaScript runtime
matrix:

- **Emscripten + Embind** — produces `build/taglib-web.wasm` for browsers,
  Workers, and bundler-served apps.
- **WASI** — produces `build/taglib-wasi.wasm` for Deno, Node.js,
  Cloudflare Workers, Bun, and any Wasmer-style host. Enables features
  like `deno compile`.

These backends were chosen for sound reasons: Embind is the obvious shape for
browsers (rich Emscripten glue, FS API present, no startup cost from the WASI
preview1 host); WASI is required for everything else and gives us
deno-compile, Workers, and on-disk path I/O. Keeping both is non-negotiable
for the supported runtimes.

The problem is not "two backends" — it is **two fundamentally different
boundary protocols between JS and C++**:

| Aspect           | Embind                                     | WASI                                        |
| ---------------- | ------------------------------------------ | ------------------------------------------- |
| State model      | Imperative — stateful C++ `FileHandle`     | Declarative — MessagePack snapshot exchange |
| Mutations        | Apply immediately to in-memory C++ state   | Stage into JS `tagData`; applied at save()  |
| Read             | Direct method call (`flac->hasID3v1Tag()`) | One-shot decode of `tl_read_tags` output    |
| Write            | `flac->setX()` then `fileRef->save()`      | Encode `tagData` → `tl_write_tags`          |
| Coupling         | Tight to Embind C++ class shape            | Loose; pure msgpack contract                |
| C++ feature cost | One method on `FileHandle` + binding line  | `count_X / encode_X / apply_X_from_msgpack` |

The shared `FileHandle` interface (`src/wasm.ts:69-104`) papers over the
surface. Both backends implement it: Embind via a Proxy wrapper in
`src/taglib/embind-adapter.ts`, WASI via `WasiFileHandle` in
`src/runtime/wasi-adapter/file-handle.ts`. Below the interface, the
semantics diverge in ways that have already caused real bugs:

### Observed divergences

1. **Location-vs-pointer semantics.** `FLAC::File::hasID3v1Tag()` returns
   `d->ID3v1Location >= 0` — i.e. _on-disk_ state. `strip()` only nulls the
   in-memory tag pointer; the location is not cleared until `save()` runs.
   Embind initially exposed `hasID3v1Tag()` directly, so `hasId3Tags()`
   returned stale data after a pending strip on the same handle. Fixed in
   commit `184d673` by switching Embind to check `ID3v1Tag() != nullptr`
   (the pointer). WASI hit the same issue from the opposite direction: its
   `tagData.id3Tags` is a load-time snapshot that was never updated by
   `stripId3Tags()`. Fixed by an optimistic cache update.

2. **TagUnion silent propagation.** In the WASI write path, `apply_propmap`
   writes properties (title, artist, …) to `file->tag()` which is a
   `TagUnion`. The `setUnion` macro then writes to _every_ contained tag
   slot — including ID3v2 on a FLAC file. Net effect: WASI's save path
   silently populates an otherwise-empty ID3v2 tag, which then survives
   `FLAC::File::save()`'s empty-tag auto-removal. Embind does not run
   `apply_propmap` for a strip-only flow, so it sees the empty-ID3v2 path
   instead. Surfaced during `taglib-y91` test debugging — the original
   test passed on WASI but failed on Embind for non-obvious reasons.

3. **Imperative directives in declarative tag data.** WASI uses
   `_`-prefixed keys in the tag-data MessagePack to smuggle write-time
   ops (`_mp4ChapterStyle`, `_stripId3`). Each new directive must
   reinvent optimistic local-cache update, multi-call composition, and
   post-save persistence behavior. See `taglib-7gs` for a deeper analysis.

4. **Doubled feature implementation cost.** A single feature
   (`taglib-y91`) touched 8 files because the feature must exist twice:
   once as Embind binding (read-state + write-state methods on the C++
   class), once as the WASI triple (`count_X / encode_X /
   apply_X_from_msgpack`). The patterns are consistent — every WASI
   feature module follows the triple — but the duplication is real and
   permanent.

### Why this matters now

The codebase has six C++ feature modules following the triple pattern and a
Mutagen-parity backlog that will add at least 4-8 more
(SYLT, ETCO, raw ID3v2 frames, ID3 version save, MP4 freeform types, LAME
extension, media checksum). Each new feature pays the doubled-implementation
tax and exposes new opportunities for silent backend divergence. Pre-emptive
consolidation is cheaper than retrofitting.

## Decision drivers

In rough priority order:

1. **Cost of every new feature**, today and into the Mutagen-parity push
2. **Correctness across backends** — the population of "subtle divergence"
   bugs is provably non-zero and likely to grow
3. **Contributor onboarding cost** — the dual model is undocumented;
   new contributors will rediscover divergences by hitting test surprises
4. **Browser bundle size** — Embind's glue JS already costs ~200 KB; any
   change must not regress this
5. **WASI runtime support** — must keep deno-compile, Cloudflare Workers,
   Wasmer hosts working
6. **Public TS API stability** — `AudioFile` interface should not break
7. **Performance** — tag-read/write throughput must remain in the same
   order of magnitude on both backends

## Considered options

### A. Status quo — keep two protocols, document the divergence

Accept the dual protocol permanently. Write a definitive
`.claude/rules/dual-backend-state-model.md` (tracked in `taglib-li1`)
covering the standard workarounds (optimistic cache updates, OR-merge
composition, location-vs-pointer guards, TagUnion propagation
awareness). Mandate cross-backend parity tests for every feature
(tracked in `taglib-7ek`).

- ✅ Zero migration cost
- ✅ No risk of regression
- ✅ Keeps both backends at current performance characteristics
- ❌ Every new feature continues to cost ~2× to implement
- ❌ Divergence bugs will keep appearing — we mitigate, we don't prevent
- ❌ Contributor cliff: the dual model is non-obvious and the docs+tests
  must be perfect to keep it from biting

### B. Unify on MessagePack C-API — complete Phase 2

Complete the `taglib-g0f` Phase-2 work: finish the C-API implementation
the Aug 2025 refactor started, port the remaining Embind-only features
(chapters, BWF, ratings, pictures, lyrics, extended audio props,
LAME — ~1,550 lines C++) to the C-API shape, swap the browser TS loaders
off Embind onto the C-API artifact. After this, both backends use the
same `tl_read_tags` / `tl_write_tags` + MessagePack protocol, and every
feature module is implemented once.

- ✅ Eliminates ~half the cross-backend tax — one C++ feature module
  serves both backends
- ✅ Removes the entire class of state-model divergence bugs
- ✅ Reduces total C++ surface (~2000 lines deleted from Embind once
  parity is reached and Embind path is retired)
- ✅ Public TS API can stay exactly the same if Embind's existing JS
  facade is preserved as a thin wrapper over the C-API artifact
- ❌ Multi-week project. Realistic estimate: 4-8 weeks of focused work
- ❌ Need to verify performance parity — MessagePack encode/decode adds
  per-call cost the Embind path doesn't pay; tag-read might be slower
- ❌ Browser bundle size may grow (msgpack lib was already needed for
  WASI, so probably small impact, but needs measurement)
- ❌ Risk: the C-API path may not yet support every Embind feature
  (chapters/BWF/ratings); porting may surface new TagLib RTTI / EH
  issues

### C. Retire WASI — unify on Embind

Keep only the Embind backend. Drop deno-compile, Cloudflare Workers,
Wasmer-style hosts, and the entire `src/capi/` C layer + `src/runtime/`
WASI host.

- ✅ Single boundary protocol
- ✅ Smallest maintenance surface
- ❌ **Loses the project's biggest differentiator.** Multiple users
  picked taglib-wasm specifically because it runs in Deno-compile and
  Cloudflare Workers
- ❌ Loses path-based I/O optimization (WASI reads files directly
  via host syscalls; Embind has to load the full buffer to JS first)
- ❌ Not viable

### D. Hybrid — shared C-API artifact, Embind exposes both protocols

Build a single `taglib_capi.wasm` artifact used by both backends. Embind
adds a thin wrapper that exposes both the legacy class methods (for
backwards-compat consumers) and the new MessagePack functions. Over
time, internal call sites migrate to MessagePack; the class methods
become a thin compatibility shim.

- ✅ Zero TS API break — old code keeps working
- ✅ Shared C++ surface — same wins as Option B
- ✅ Migration is gradual; each Embind method can switch on its own
  schedule
- ❌ Highest peak complexity — for some duration both protocols are
  live on the Embind side
- ❌ Only worth it if there's a measurable Embind perf advantage
  worth preserving the class-method path for
- ❌ All Option B costs apply, plus an extended migration window

## Decision

**Deferred.** This ADR is **Proposed**, not **Accepted**. The decision
is gated on `taglib-g0f`, which is a P2 task that itself needs the
"complete Phase 2 vs. delete the orphan" question answered with
concrete data:

- How many lines of C-API code are actually needed for parity?
- What's the measurable browser bundle-size delta?
- What's the measurable per-call latency delta for MessagePack vs.
  direct Embind?
- Does the existing Phase-1 C-API code work, or does it need a rewrite?

When `taglib-g0f` closes, this ADR will be updated to **Accepted: A**
(if g0f resolves as "delete the orphan and keep two protocols") or
**Accepted: B** (if g0f resolves as "complete Phase 2"). Option D
remains live as a way to execute B without breaking the public API.

## Consequences (per option)

### If A is accepted

- `taglib-li1` becomes essential and high-priority
- `taglib-7ek` (parity audit) becomes essential — every new feature
  needs a parity test before merge
- `taglib-7gs` (directive separation) is worth completing as a
  hardening of the WASI side
- New `.claude/rules/dual-backend-state-model.md` is the keystone
  contributor doc
- Doubled feature cost is permanent; budget accordingly

### If B (or D) is accepted

- `taglib-li1` is moot — write a one-paragraph "we used to have two
  protocols; we don't anymore" note instead
- `taglib-7gs` is moot — directives can be a separate top-level
  msgpack key (e.g. `_ops`) cleanly
- `taglib-7ek` still useful but reduced in urgency
- ~2000 lines of C++ deleted, ~1500 lines refactored to C-API
- Browser bundle ships `taglib_capi.wasm` + msgpack glue instead of
  `taglib-web.wasm` + Embind glue — net size needs measurement
- Some performance regression on Embind path is likely; needs
  benchmark gate before merge

## Open questions

1. **Per-call MessagePack overhead** for the Embind use case. Embind's
   class methods can do one ByteVector→Uint8Array trip and return.
   The C-API path serializes the entire result to MessagePack and
   back. For high-frequency reads (e.g. folder scanning of 10k files),
   this could matter. **Needs a benchmark before B is accepted.**

2. **TagLib RTTI/exception compatibility** in the browser C-API
   build. The WASI build uses a custom EH-enabled sysroot
   (`build/build-eh-sysroot.sh`). Emscripten's RTTI/EH story is
   different; the existing Phase-1 C-API code may need adaptation.

3. **JS API back-compat strategy.** If B is chosen, do we ship a
   1.x → 2.0 break, or layer a compatibility shim (Option D)? The
   `AudioFile` interface in `src/taglib/audio-file-interface.ts` is
   well-defined; preserving it through D is plausible.

4. **`taglib-7gs` design.** A separate `_ops` field for write-time
   directives is cleaner than `_`-prefixed keys, regardless of the
   A-vs-B outcome. Worth doing as a stand-alone improvement.

5. **Test fixture costs.** Parity tests double our test runtime.
   `tests/cross-backend-parity.test.ts` already exists; we should
   benchmark its impact on CI duration and decide whether to keep
   matrix parity or rely on representative parity samples.

## Opportunities for improvement (orthogonal to A/B)

These are wins available regardless of which option is chosen:

- **Parity test convention.** Require every feature with format-specific
  behavior to ship at least one cross-backend test (`taglib-7ek`).
  Catches divergences early.
- **Promote `test-wasi` to a required CI gate** (`taglib-wgz`). Today
  WASI failures don't block merge — this is the single biggest hole
  in our "two backends in sync" promise.
- **Document the boundary contract.** Whether it's the dual-protocol
  reality (Option A) or the unified C-API future (Option B/D), a
  concrete document of what crosses the boundary, in which direction,
  and what guarantees apply, eliminates a large class of contributor
  confusion.
- **Schema for the MessagePack protocol.** Today it's implicit between
  `taglib_shim.cpp` and `src/msgpack/encoder.ts` / `decoder.ts`. A
  Markdown schema (or even a TypeScript type narrowing) would make
  the contract enforceable.

## Related

Look up these bd issues with `bd show <id>` (this project uses
[beads](https://github.com/steveasleep/beads) for local issue tracking):

- `taglib-g0f` — Resolve orphan dual-build C-API artifacts (the
  decision-driving task)
- `taglib-li1` — Document the dual-backend state model (work item if A wins)
- `taglib-7gs` — Investigate separate write-time directives from
  tag-data MessagePack
- `taglib-7ek` — Audit cross-backend parity coverage for AudioFile
  features
- `taglib-wgz` — Promote `test-wasi` to a required CI gate
- `taglib-y91` — ID3 tag deletion from FLAC (closed; first explicit
  surfacing of the state-model divergence; see commit `184d673` for
  the review-driven fixes)
