# Remove `applyTagsToBuffer` Alias

**Date:** 2026-03-05
**Issue:** taglib-wasm-1zc.9
**Decision:** `applyTags` is the canonical name. `applyTagsToBuffer` is deleted for 1.0.

## Rationale

The codebase had conflicting signals: the planning doc said to deprecate `applyTags` in favor of `applyTagsToBuffer`, but the source code did the opposite. The closed issue `2jn` confirmed `applyTags` as the canonical name. For 1.0, we remove the alias entirely rather than keeping a deprecated export.

`applyTags` aligns with the `readTags`/`applyTags`/`applyTagsToFile` naming pattern.

## Changes

### Source (3 files)

1. `src/simple/tag-operations.ts` — Delete the `@deprecated` alias (lines 228-229)
2. `src/simple/index.ts` — Remove `applyTagsToBuffer` from exports
3. `index.ts` — Remove `applyTagsToBuffer` from re-exports

### Tests (7 files)

Replace all `applyTagsToBuffer` imports and usage with `applyTags`:

- `tests/taglib.test.ts`
- `tests/multi-value-tags.test.ts`
- `tests/simple-api-unit.test.ts`
- `tests/tag-operations-errors.test.ts`
- `tests/bun-integration.test.ts`
- `tests/test-utils.ts`
- `tests/error-handling.test.ts`

### Docs and examples (~10 files)

Replace all `applyTagsToBuffer` references with `applyTags`:

- `README.md`
- `LLMs.md`
- `simple.ts` (module-level JSDoc)
- `src/types/tags.ts` (JSDoc example)
- `docs/api/index.md`
- `docs/guide/quick-start.md`, `examples.md`, `installation.md`, `platform-examples.md`
- `docs/concepts/error-handling.md`
- `docs/advanced/implementation.md`
- `examples/common/simple-api.ts`
- `examples/deno-app-setup-guide.md`
- `tools/benchmarks/api-comparison.ts`

### Not changed

- The `applyTags` function signature and behavior — no changes
- `applyTagsToFile` — unrelated
- The old planning doc (`2026-02-23-1.0-release-blockers.md`) — left as historical record
