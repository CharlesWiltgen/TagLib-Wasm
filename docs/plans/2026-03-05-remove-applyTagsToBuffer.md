# Remove `applyTagsToBuffer` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the `applyTagsToBuffer` alias entirely, making `applyTags` the sole export name.

**Architecture:** Mechanical find-and-replace across source, tests, docs, and examples. No logic changes.

**Tech Stack:** TypeScript, Deno

---

### Task 1: Remove the alias from source exports

**Files:**

- Modify: `src/simple/tag-operations.ts:228-229`
- Modify: `src/simple/index.ts:5`
- Modify: `index.ts:78`

**Step 1: Delete the deprecated alias**

In `src/simple/tag-operations.ts`, delete lines 228-229:

```typescript
/** @deprecated Use `applyTags` instead. */
export const applyTagsToBuffer = applyTags;
```

**Step 2: Remove from simple barrel export**

In `src/simple/index.ts`, remove `applyTagsToBuffer` from the export list (line 5).

**Step 3: Remove from root barrel export**

In `index.ts`, remove `applyTagsToBuffer` from the Simple API export block (line 78).

**Step 4: Run typecheck to see all broken references**

Run: `deno check index.ts`
Expected: Errors listing every file still importing `applyTagsToBuffer`

**Step 5: Commit**

```bash
git add src/simple/tag-operations.ts src/simple/index.ts index.ts
git commit -m "refactor!: remove applyTagsToBuffer alias"
```

---

### Task 2: Update all test files

**Files:**

- Modify: `tests/taglib.test.ts`
- Modify: `tests/multi-value-tags.test.ts`
- Modify: `tests/simple-api-unit.test.ts`
- Modify: `tests/tag-operations-errors.test.ts`
- Modify: `tests/bun-integration.test.ts`
- Modify: `tests/test-utils.ts`
- Modify: `tests/error-handling.test.ts`

**Step 1: Replace all imports and usages**

In every file above, replace `applyTagsToBuffer` with `applyTags`. This includes:

- Import statements
- `describe()` block names
- Function calls
- Comments referencing the old name

Specific `describe` renames:

- `tests/multi-value-tags.test.ts`: `"applyTagsToBuffer with TagInput"` → `"applyTags with TagInput"`
- `tests/multi-value-tags.test.ts`: `"applyTagsToBuffer with extended fields"` → `"applyTags with extended fields"`
- `tests/simple-api-unit.test.ts`: `"applyTagsToBuffer"` → `"applyTags"`
- `tests/tag-operations-errors.test.ts`: `"applyTagsToBuffer"` → `"applyTags"`
- `tests/tag-operations-errors.test.ts`: Delete the `"applyTags (renamed from applyTagsToBuffer)"` describe block entirely — it only tested that the alias worked.

**Step 2: Run tests**

Run: `deno task test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/
git commit -m "test: update all tests to use applyTags"
```

---

### Task 3: Update documentation and examples

**Files:**

- Modify: `README.md`
- Modify: `LLMs.md`
- Modify: `simple.ts`
- Modify: `src/types/tags.ts`
- Modify: `docs/api/index.md`
- Modify: `docs/guide/quick-start.md`
- Modify: `docs/guide/examples.md`
- Modify: `docs/guide/installation.md`
- Modify: `docs/guide/platform-examples.md`
- Modify: `docs/concepts/error-handling.md`
- Modify: `docs/advanced/implementation.md`
- Modify: `examples/common/simple-api.ts`
- Modify: `examples/deno-app-setup-guide.md`
- Modify: `tools/benchmarks/api-comparison.ts`

**Step 1: Global replace `applyTagsToBuffer` → `applyTags` in all files above**

Use find-and-replace. Every occurrence of `applyTagsToBuffer` becomes `applyTags`.

Special cases:

- `docs/api/index.md`: Rename the `### applyTagsToBuffer()` heading to `### applyTags()`
- `docs/advanced/implementation.md`: Update the description text mentioning function names
- `docs/guide/platform-examples.md`: The note "Use `applyTagsToBuffer` (not `applyTagsToFile`)" becomes "Use `applyTags` (not `applyTagsToFile`)"

**Step 2: Verify no stale references remain**

Run: `grep -r "applyTagsToBuffer" --include="*.ts" --include="*.md" . | grep -v node_modules | grep -v .beads | grep -v docs/plans/2026-02-23`
Expected: No output (only the old planning doc should have references)

**Step 3: Run format and lint**

Run: `deno task fmt && deno task lint`

**Step 4: Run tests one final time**

Run: `deno task test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add README.md LLMs.md simple.ts src/types/tags.ts docs/ examples/ tools/
git commit -m "docs: replace all applyTagsToBuffer references with applyTags"
```
