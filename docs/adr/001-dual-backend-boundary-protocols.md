# ADR-001: Dual Wasm/JS boundary protocols (Embind imperative vs. WASI declarative)

- **Status:** Accepted (Option A) — 2026-06-03, on resolution of `taglib-g0f`
- **Date:** 2026-05-14 (proposed) · 2026-06-03 (accepted)
- **Deciders:** Charles Wiltgen (repo owner)

## Context

`taglib-wasm` ships two Wasm backends to cover the full JavaScript runtime
matrix:

- **Emscripten + Embind** — produces `build/taglib-web.wasm` for browsers,
  Workers, and bundler-served apps.
- **WASI** — produces `build/taglib-wasi.wasm` for Deno, Node.js, Cloudflare
  Workers, Bun, and any Wasmer-style host. Enables features like `deno compile`.

These backends were chosen for sound reasons: Embind is the obvious shape for
browsers (rich Emscripten glue, FS API present, no startup cost from the WASI
preview1 host); WASI is required for everything else and gives us deno-compile,
Workers, and on-disk path I/O. Keeping both is non-negotiable for the supported
runtimes.

The problem is not "two backends" — it is **two fundamentally different boundary
protocols between JS and C++**:

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
`src/runtime/wasi-adapter/file-handle.ts`. Below the interface, the semantics
diverge in ways that have already caused real bugs:

### Observed divergences

1. **Location-vs-pointer semantics.** `FLAC::File::hasID3v1Tag()` returns
   `d->ID3v1Location >= 0` — i.e. _on-disk_ state. `strip()` only nulls the
   in-memory tag pointer; the location is not cleared until `save()` runs.
   Embind initially exposed `hasID3v1Tag()` directly, so `hasId3Tags()` returned
   stale data after a pending strip on the same handle. Fixed in commit
   `184d673` by switching Embind to check `ID3v1Tag() != nullptr` (the pointer).
   WASI hit the same issue from the opposite direction: its `tagData.id3Tags` is
   a load-time snapshot that was never updated by `stripId3Tags()`. Fixed by an
   optimistic cache update.

2. **TagUnion silent propagation.** In the WASI write path, `apply_propmap`
   writes properties (title, artist, …) to `file->tag()` which is a `TagUnion`.
   The `setUnion` macro then writes to _every_ contained tag slot — including
   ID3v2 on a FLAC file. Net effect: WASI's save path silently populates an
   otherwise-empty ID3v2 tag, which then survives `FLAC::File::save()`'s
   empty-tag auto-removal. Embind does not run `apply_propmap` for a strip-only
   flow, so it sees the empty-ID3v2 path instead. Surfaced during `taglib-y91`
   test debugging — the original test passed on WASI but failed on Embind for
   non-obvious reasons.

3. **Imperative directives in declarative tag data.** WASI uses `_`-prefixed
   keys in the tag-data MessagePack to smuggle write-time ops
   (`_mp4ChapterStyle`, `_stripId3`). Each new directive must reinvent
   optimistic local-cache update, multi-call composition, and post-save
   persistence behavior. See `taglib-7gs` for a deeper analysis.

   **A third channel has since appeared, as predicted: `_mp4ItemNames`**
   (added in `v1.6.1`, `taglib-5ibr`). It differs from the first two in a way
   worth noting — it carries data in **both** directions rather than being a
   write-time directive. Foreign-`mean` MP4 atom names ride it out of C++ so
   `getMP4Item()` can resolve a name TagLib's PropertyMap cannot represent, and
   back in so a staged overwrite keeps the slot current. It is also filtered
   out of `properties()` on the way through, so the public surface never sees
   it. That is three ad-hoc channels on a boundary with no protocol for them,
   which is the cost this ADR predicted rather than a departure from it.

4. **Doubled feature implementation cost.** A single feature (`taglib-y91`)
   touched 8 files because the feature must exist twice: once as Embind binding
   (read-state + write-state methods on the C++ class), once as the WASI triple
   (`count_X / encode_X /
   apply_X_from_msgpack`). The patterns are consistent
   — every WASI feature module follows the triple — but the duplication is real
   and permanent.

### Why this matters now

The codebase has six C++ feature modules following the triple pattern and a
Mutagen-parity backlog that will add at least 4-8 more (SYLT, ETCO, raw ID3v2
frames, ID3 version save, MP4 freeform types, LAME extension, media checksum).
Each new feature pays the doubled-implementation tax and exposes new
opportunities for silent backend divergence. Pre-emptive consolidation is
cheaper than retrofitting.

## Decision drivers

In rough priority order:

1. **Cost of every new feature**, today and into the Mutagen-parity push
2. **Correctness across backends** — the population of "subtle divergence" bugs
   is provably non-zero and likely to grow
3. **Contributor onboarding cost** — the dual model is undocumented; new
   contributors will rediscover divergences by hitting test surprises
4. **Browser bundle size** — Embind's glue JS already costs ~200 KB; any change
   must not regress this
5. **WASI runtime support** — must keep deno-compile, Cloudflare Workers, Wasmer
   hosts working
6. **Public TS API stability** — `AudioFile` interface should not break
7. **Performance** — tag-read/write throughput must remain in the same order of
   magnitude on both backends

## Considered options

### A. Status quo — keep two protocols, document the divergence

Accept the dual protocol permanently. Write a definitive
`.claude/rules/dual-backend-state-model.md` (tracked in `taglib-li1`) covering
the standard workarounds (optimistic cache updates, OR-merge composition,
location-vs-pointer guards, TagUnion propagation awareness). Mandate
cross-backend parity tests for every feature (tracked in `taglib-7ek`).

- ✅ Zero migration cost
- ✅ No risk of regression
- ✅ Keeps both backends at current performance characteristics
- ❌ Every new feature continues to cost ~2× to implement
- ❌ Divergence bugs will keep appearing — we mitigate, we don't prevent
- ❌ Contributor cliff: the dual model is non-obvious and the docs+tests must be
  perfect to keep it from biting

### B. Unify on MessagePack C-API — complete Phase 2

Complete the `taglib-g0f` Phase-2 work: finish the C-API implementation the Aug
2025 refactor started, port the remaining Embind-only features (chapters, BWF,
ratings, pictures, lyrics, extended audio props, LAME — ~1,550 lines C++) to the
C-API shape, swap the browser TS loaders off Embind onto the C-API artifact.
After this, both backends use the same `tl_read_tags` / `tl_write_tags` +
MessagePack protocol, and every feature module is implemented once.

- ✅ Eliminates ~half the cross-backend tax — one C++ feature module serves both
  backends
- ✅ Removes the entire class of state-model divergence bugs
- ✅ Reduces total C++ surface (~2000 lines deleted from Embind once parity is
  reached and Embind path is retired)
- ✅ Public TS API can stay exactly the same if Embind's existing JS facade is
  preserved as a thin wrapper over the C-API artifact
- ❌ Multi-week project. Realistic estimate: 4-8 weeks of focused work
- ❌ Need to verify performance parity — MessagePack encode/decode adds per-call
  cost the Embind path doesn't pay; tag-read might be slower
- ❌ Browser bundle size may grow (msgpack lib was already needed for WASI, so
  probably small impact, but needs measurement)
- ❌ Risk: the C-API path may not yet support every Embind feature
  (chapters/BWF/ratings); porting may surface new TagLib RTTI / EH issues

### C. Retire WASI — unify on Embind

Keep only the Embind backend. Drop deno-compile, Cloudflare Workers,
Wasmer-style hosts, and the entire `src/capi/` C layer + `src/runtime/` WASI
host.

- ✅ Single boundary protocol
- ✅ Smallest maintenance surface
- ❌ **Loses the project's biggest differentiator.** Multiple users picked
  taglib-wasm specifically because it runs in Deno-compile and Cloudflare
  Workers
- ❌ Loses path-based I/O optimization (WASI reads files directly via host
  syscalls; Embind has to load the full buffer to JS first)
- ❌ Not viable

### D. Hybrid — shared C-API artifact, Embind exposes both protocols

Build a single `taglib_capi.wasm` artifact used by both backends. Embind adds a
thin wrapper that exposes both the legacy class methods (for backwards-compat
consumers) and the new MessagePack functions. Over time, internal call sites
migrate to MessagePack; the class methods become a thin compatibility shim.

- ✅ Zero TS API break — old code keeps working
- ✅ Shared C++ surface — same wins as Option B
- ✅ Migration is gradual; each Embind method can switch on its own schedule
- ❌ Highest peak complexity — for some duration both protocols are live on the
  Embind side
- ❌ Only worth it if there's a measurable Embind perf advantage worth
  preserving the class-method path for
- ❌ All Option B costs apply, plus an extended migration window

## Decision

**Accepted: Option A — keep two protocols, document the divergence.**

`taglib-g0f` closed on 2026-06-03 (commit `723acaa`) as **delete the orphan**:
the abandoned Phase-1 Emscripten C-API spike — its build script, ~2,000 lines of
dead C/C++, the `lib/msgpack` submodule, and its CI job — was removed rather
than completed into Phase 2. That forecloses Option B (and D, which existed only
to execute B without an API break): there is no longer a partial C-API artifact
to finish, and any future unification would start from scratch against the
proven WASI shim, not the spike.

The two boundary protocols therefore stay divergent **permanently and
deliberately**:

- **Embind** (`build/taglib-web.wasm`) — imperative, stateful C++ `FileHandle`;
  browsers, Workers, and bundler-served apps.
- **WASI** (`build/taglib-wasi.wasm`) — declarative MessagePack snapshot
  exchange; Deno, Node.js, Bun, Cloudflare Workers, deno-compile.

The decision drivers favor A once g0f is "delete": Option B's wins (one feature
module, no divergence class) all assumed a finishable C-API. With the spike
gone, B is a multi-week from-scratch rewrite carrying unmeasured perf and
bundle-size risk, whereas A is zero-migration and zero-regression. The
divergence is _mitigated, not eliminated_, by mandatory cross-backend parity
tests (`taglib-7ek`) and a contributor-facing state-model rule (`taglib-li1`)
that links here for rationale.

## Consequences

Option A is in force:

- The dual-protocol divergence is **load-bearing and permanent.** Every feature
  with format-specific behavior costs ~2× to implement (an Embind binding plus
  the WASI `count_X / encode_X / apply_X_from_msgpack` triple); budget
  accordingly through the Mutagen-parity backlog.
- `taglib-li1` is now **essential.** Its deliverable is a
  contributor/agent-facing state-model rule
  (`.claude/rules/dual-backend-state-model.md`) plus an `AGENTS.md` paragraph
  that links back to this ADR. This ADR records the _decision and rationale_;
  the rule records the _how-to-not-break-parity_ working guidance (optimistic
  cache updates, OR-merge composition, location-vs-pointer guards,
  TagUnion-propagation awareness).
- `taglib-7ek` (parity audit) is **essential** — a cross-backend parity test is
  required before any feature with backend-divergent behavior merges.
- `taglib-wgz` (promote `test-wasi` to a required CI gate) is the highest-value
  hardening: until it lands, WASI divergences do not block merge, which is the
  biggest hole in the "two backends in sync" promise.
- `taglib-7gs` (separate write-time directives from tag data) is worth
  completing as WASI-side hardening, now that the WASI protocol is permanent.
- The MessagePack boundary is now a permanent contract; formalizing its schema
  (see "Opportunities") is worthwhile.

Options B and D (unify on a MessagePack C-API) were **not chosen.** They are
retained under "Considered options" as the record of what was weighed; reopening
them would require a fresh C-API effort, not a continuation of the deleted
spike.

## Open questions

Live under Option A:

1. **`taglib-7gs` design.** A separate `_ops` field for write-time directives is
   cleaner than the current `_`-prefixed in-band keys. Worth doing as a
   stand-alone WASI-side improvement.

2. **Test fixture costs.** Parity tests roughly double test runtime.
   `tests/cross-backend-parity.test.ts` already exists; benchmark its CI impact
   and decide between full matrix parity and representative parity samples.

Resolved by the Option-A decision (were gated on B/D, now moot): per-call
MessagePack overhead for an Embind C-API path; TagLib RTTI/EH compatibility for
a browser C-API build; and the 1.x→2.0 JS API back-compat strategy. None apply
while Embind keeps its native protocol.

## Opportunities for improvement (orthogonal to A/B)

These are wins available regardless of which option is chosen:

- **Parity test convention.** Require every feature with format-specific
  behavior to ship at least one cross-backend test (`taglib-7ek`). Catches
  divergences early.
- **Promote `test-wasi` to a required CI gate** (`taglib-wgz`). Today WASI
  failures don't block merge — this is the single biggest hole in our "two
  backends in sync" promise.
- **Document the boundary contract.** Whether it's the dual-protocol reality
  (Option A) or the unified C-API future (Option B/D), a concrete document of
  what crosses the boundary, in which direction, and what guarantees apply,
  eliminates a large class of contributor confusion.
- **Schema for the MessagePack protocol.** Today it's implicit between
  `taglib_shim.cpp` and `src/msgpack/encoder.ts` / `decoder.ts`. A Markdown
  schema (or even a TypeScript type narrowing) would make the contract
  enforceable.

## Related

Look up these bd issues with `bd show <id>` (this project uses
[beads](https://github.com/steveasleep/beads) for local issue tracking):

- `taglib-g0f` — Resolve orphan dual-build C-API artifacts (the decision-driving
  task)
- `taglib-li1` — Document the dual-backend state model (now active; A won)
- `taglib-7gs` — Investigate separate write-time directives from tag-data
  MessagePack
- `taglib-7ek` — Audit cross-backend parity coverage for AudioFile features
- `taglib-wgz` — Promote `test-wasi` to a required CI gate
- `taglib-y91` — ID3 tag deletion from FLAC (closed; first explicit surfacing of
  the state-model divergence; see commit `184d673` for the review-driven fixes)
