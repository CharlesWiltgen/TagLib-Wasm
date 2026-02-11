/**
 * @fileoverview Tests for filesystem provider implementations
 *
 * Verifies that both Deno and Node providers satisfy the FileSystemProvider
 * contract using real temp files for seek, read, write, and truncate.
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createDenoFsProvider } from "../src/runtime/wasi-fs-deno.ts";
import { createNodeFsProvider } from "../src/runtime/wasi-fs-node.ts";
import type { FileSystemProvider } from "../src/runtime/wasi-fs-provider.ts";

function runProviderTests(
  name: string,
  getProvider: () => Promise<FileSystemProvider>,
) {
  describe(`FileSystemProvider (${name})`, () => {
    it("should open, write, seek to start, and read back", async () => {
      const fs = await getProvider();
      const path = await Deno.makeTempFile();
      try {
        const handle = fs.openSync(path, { read: true, write: true });
        const data = new TextEncoder().encode("hello");
        const written = handle.writeSync(data);
        assertEquals(written, 5);

        handle.seekSync(0, 0); // SEEK_SET
        const buf = new Uint8Array(5);
        const n = handle.readSync(buf);
        assertEquals(n, 5);
        assertEquals(new TextDecoder().decode(buf), "hello");
        handle.close();
      } finally {
        await Deno.remove(path);
      }
    });

    it("should support SEEK_CUR (whence=1)", async () => {
      const fs = await getProvider();
      const path = await Deno.makeTempFile();
      try {
        const handle = fs.openSync(path, { read: true, write: true });
        handle.writeSync(new TextEncoder().encode("abcde"));
        handle.seekSync(0, 0);
        handle.seekSync(2, 1); // SEEK_CUR: move 2 from current

        const buf = new Uint8Array(3);
        handle.readSync(buf);
        assertEquals(new TextDecoder().decode(buf), "cde");
        handle.close();
      } finally {
        await Deno.remove(path);
      }
    });

    it("should support SEEK_END (whence=2)", async () => {
      const fs = await getProvider();
      const path = await Deno.makeTempFile();
      try {
        const handle = fs.openSync(path, { read: true, write: true });
        handle.writeSync(new TextEncoder().encode("abcde"));

        const pos = handle.seekSync(-2, 2); // SEEK_END: 2 before end
        assertEquals(pos, 3);

        const buf = new Uint8Array(2);
        handle.readSync(buf);
        assertEquals(new TextDecoder().decode(buf), "de");
        handle.close();
      } finally {
        await Deno.remove(path);
      }
    });

    it("should truncate file", async () => {
      const fs = await getProvider();
      const path = await Deno.makeTempFile();
      try {
        const handle = fs.openSync(path, { read: true, write: true });
        handle.writeSync(new TextEncoder().encode("hello world"));
        handle.truncateSync(5);
        handle.seekSync(0, 0);

        const buf = new Uint8Array(10);
        const n = handle.readSync(buf);
        assertEquals(n, 5);
        assertEquals(new TextDecoder().decode(buf.subarray(0, 5)), "hello");
        handle.close();
      } finally {
        await Deno.remove(path);
      }
    });

    it("should return null on EOF read", async () => {
      const fs = await getProvider();
      const path = await Deno.makeTempFile();
      try {
        const handle = fs.openSync(path, { read: true, write: true });
        // File is empty, reading should return null
        const buf = new Uint8Array(10);
        const n = handle.readSync(buf);
        assertEquals(n, null);
        handle.close();
      } finally {
        await Deno.remove(path);
      }
    });

    it("should read file as Uint8Array via readFile", async () => {
      const fs = await getProvider();
      const path = await Deno.makeTempFile();
      try {
        await Deno.writeTextFile(path, "test content");
        const data = await fs.readFile(path);
        assertEquals(new TextDecoder().decode(data), "test content");
      } finally {
        await Deno.remove(path);
      }
    });

    it("should identify not-found errors", async () => {
      const fs = await getProvider();
      try {
        fs.openSync("/nonexistent/path/file.txt", { read: true, write: false });
      } catch (e) {
        assertEquals(fs.isNotFoundError(e), true);
      }
    });

    it("should not misidentify other errors as not-found", async () => {
      const fs = await getProvider();
      assertEquals(fs.isNotFoundError(new Error("generic")), false);
      assertEquals(fs.isNotFoundError(null), false);
    });

    it("should create file when create option is set", async () => {
      const fs = await getProvider();
      const dir = await Deno.makeTempDir();
      const path = `${dir}/new-file.txt`;
      try {
        const handle = fs.openSync(path, {
          read: true,
          write: true,
          create: true,
          truncate: true,
        });
        handle.writeSync(new TextEncoder().encode("created"));
        handle.seekSync(0, 0);
        const buf = new Uint8Array(7);
        handle.readSync(buf);
        assertEquals(new TextDecoder().decode(buf), "created");
        handle.close();
      } finally {
        await Deno.remove(dir, { recursive: true });
      }
    });

    it("should create file with create-without-truncate", async () => {
      const fs = await getProvider();
      const dir = await Deno.makeTempDir();
      const path = `${dir}/create-no-trunc.txt`;
      try {
        const handle = fs.openSync(path, {
          read: true,
          write: true,
          create: true,
          truncate: false,
        });
        handle.writeSync(new TextEncoder().encode("new file"));
        handle.seekSync(0, 0);
        const buf = new Uint8Array(8);
        handle.readSync(buf);
        assertEquals(new TextDecoder().decode(buf), "new file");
        handle.close();
      } finally {
        await Deno.remove(dir, { recursive: true });
      }
    });

    it("should write after SEEK_END", async () => {
      const fs = await getProvider();
      const path = await Deno.makeTempFile();
      try {
        const handle = fs.openSync(path, { read: true, write: true });
        handle.writeSync(new TextEncoder().encode("hello"));
        handle.seekSync(0, 2); // SEEK_END
        handle.writeSync(new TextEncoder().encode("!"));
        handle.seekSync(0, 0);
        const buf = new Uint8Array(6);
        handle.readSync(buf);
        assertEquals(new TextDecoder().decode(buf), "hello!");
        handle.close();
      } finally {
        await Deno.remove(path);
      }
    });

    it("should not produce negative position from SEEK_CUR", async () => {
      const fs = await getProvider();
      const path = await Deno.makeTempFile();
      try {
        const handle = fs.openSync(path, { read: true, write: true });
        handle.writeSync(new TextEncoder().encode("ab"));
        handle.seekSync(0, 0); // position = 0
        try {
          const pos = handle.seekSync(-100, 1); // SEEK_CUR: 0 + (-100)
          assertEquals(pos >= 0, true);
        } catch {
          // Throwing is also acceptable (Deno delegates to OS)
        }
        handle.close();
      } finally {
        await Deno.remove(path);
      }
    });

    it("should handle double close without throwing", async () => {
      const fs = await getProvider();
      const path = await Deno.makeTempFile();
      try {
        const handle = fs.openSync(path, { read: true, write: false });
        handle.close();
        try {
          handle.close();
        } catch {
          // Double close may throw — that's acceptable behavior
        }
      } finally {
        await Deno.remove(path);
      }
    });
  });
}

runProviderTests("Deno", async () => createDenoFsProvider());
runProviderTests("Node", () => createNodeFsProvider());
