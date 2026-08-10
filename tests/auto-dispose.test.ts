// Auto-dispose safety net (taglib-t4sn): a FinalizationRegistry must release
// the underlying FileHandle when an AudioFile wrapper becomes unreachable
// without an explicit dispose(). Without it, a forgotten wrapper leaks the
// native resource (Wasm C++ object on Emscripten, file buffers on WASI) — the
// exact pattern tuneup's engine worker hit in its write path.
//
// GC contract: this file requires --v8-flags=--expose-gc (wired into
// deno task test, ci.yml and sonarcloud.yml). The test fails loudly without
// the flag rather than skipping, so a config regression cannot turn this
// guard into decoration.
import { assertEquals } from "@std/assert";
import { TagLib } from "../src/taglib.ts";
import type { TagLib as TagLibType } from "../src/taglib/taglib-class.ts";
import { readFixture } from "./backend-adapter.ts";
import type { Format } from "./shared-fixtures.ts";

function forceGc(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (!gc) {
    throw new Error(
      "auto-dispose test requires --v8-flags=--expose-gc on the deno test invocation",
    );
  }
  gc();
}

/** The @internal FileHandle every AudioFile wrapper owns. */
interface DisposableHandle {
  destroyed?: boolean;
  destroy(): void;
}

async function flushMacrotask(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 0);
  await promise;
}

/**
 * Open a fixture and return ONLY the underlying FileHandle. The wrapper is a
 * local that dies when this function returns — it must be unreachable from
 * that point on, so the FinalizationRegistry entry can fire.
 */
async function openAndDrop(
  taglib: TagLibType,
  fixture: Format,
): Promise<DisposableHandle> {
  const wrapper = await taglib.open(await readFixture(fixture));
  // The test observes release state through the @internal handle.
  const wrapperWithHandle = wrapper as unknown as {
    fileHandle: DisposableHandle;
  };
  return wrapperWithHandle.fileHandle;
}

async function waitForDisposal(handle: DisposableHandle): Promise<boolean> {
  for (let i = 0; i < 10; i++) {
    forceGc();
    // FinalizationRegistry callbacks run as microtasks after a GC; a macrotask
    // boundary ensures they have been delivered.
    await flushMacrotask();
    if (handle.destroyed) return true;
  }
  return false;
}

for (const wasmType of ["wasi", "emscripten"] as const) {
  Deno.test(
    `dropped wrapper is auto-disposed by the FinalizationRegistry [${wasmType}]`,
    async () => {
      const taglib = await TagLib.initialize({ forceWasmType: wasmType });
      const handle = await openAndDrop(taglib, "mp3");
      assertEquals(handle.destroyed, false, "handle should start alive");
      const disposed = await waitForDisposal(handle);
      assertEquals(
        disposed,
        true,
        "FileHandle must be destroyed once the wrapper is unreachable",
      );
    },
  );
}

Deno.test(
  "explicit dispose() destroys the handle and destroy() is idempotent",
  async () => {
    const taglib = await TagLib.initialize();
    const wrapper = await taglib.open(await readFixture("mp3"));
    const wrapperWithHandle = wrapper as unknown as {
      fileHandle: DisposableHandle;
    };
    const handle = wrapperWithHandle.fileHandle;
    wrapper.dispose();
    assertEquals(
      handle.destroyed,
      true,
      "explicit dispose destroys the handle",
    );
    // The double-destroy path is the contract that matters: a finalizer
    // racing an explicit dispose, or the open()-failure path, may call
    // destroy() twice. Both backends must be idempotent — no throw, state
    // stays destroyed. (Unregister-then-destroy ordering is unobservable
    // through this API because of that idempotency, so this asserts the
    // invariant the ordering exists to protect.)
    wrapper.dispose();
    handle.destroy();
    assertEquals(handle.destroyed, true, "destroy() is idempotent");
  },
);
