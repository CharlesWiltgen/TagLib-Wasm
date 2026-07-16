/**
 * @fileoverview Regression tests for GH #24 / taglib-0b5.
 *
 * `new Function("return require('node:fs')")()` evaluates in the global
 * scope, where `require` does not exist in any standard Node/Electron module
 * context (ESM or CJS) — nor in Deno, which is what lets these tests
 * reproduce the failure mode faithfully. fs acquisition must instead go
 * through `process.getBuiltinModule("node:fs")` (sync, ESM+CJS-safe,
 * invisible to bundlers; guaranteed by engines node >= 22.6.0).
 */

import { describe, it } from "@std/testing/bdd";
import {
  assertEquals,
  assertStrictEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { getNodeFsSync } from "../src/utils/node-fs.ts";
import { getPreopens } from "../src/runtime/unified-loader/module-loading.ts";
import { readFileSync } from "../src/taglib/audio-file-impl.ts";
import { FileOperationError } from "../src/errors.ts";

const g = globalThis as Record<string, unknown>;

/**
 * Run `fn` with the given globals overridden (undefined = hidden), restoring
 * their original property descriptors afterwards. Descriptor-based because
 * globalThis.Deno is writable:false, configurable:true — plain assignment
 * throws; only delete + defineProperty round-trips it faithfully.
 */
function withGlobals<T>(overrides: Record<string, unknown>, fn: () => T): T {
  const saved: Record<string, PropertyDescriptor | undefined> = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = Object.getOwnPropertyDescriptor(g, key);
    delete g[key];
    if (overrides[key] !== undefined) g[key] = overrides[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      delete g[key];
      const descriptor = saved[key];
      if (descriptor) Object.defineProperty(g, key, descriptor);
    }
  }
}

/** Run `fn` with the Deno global hidden and `process` replaced, restoring both. */
function withFakeNodeRuntime<T>(fakeProcess: unknown, fn: () => T): T {
  return withGlobals({ Deno: undefined, process: fakeProcess }, fn);
}

/** Fake `process` whose getBuiltinModule serves a fake node:fs. */
function fakeWindowsProcess(fakeFs: unknown): unknown {
  return {
    platform: "win32",
    getBuiltinModule: (id: string) => (id === "node:fs" ? fakeFs : undefined),
  };
}

/** Fake node:fs where statSync succeeds only for the given drive roots. */
function fakeFsWithDrives(existingRoots: readonly string[]): unknown {
  return {
    statSync(path: string): void {
      if (!existingRoots.includes(path)) {
        throw new Error(`ENOENT: no such drive: ${path}`);
      }
    },
    readFileSync(): Uint8Array {
      return new Uint8Array(0);
    },
  };
}

describe("getNodeFsSync", () => {
  it("acquires node:fs via process.getBuiltinModule when require is not a global", () => {
    const fakeFs = fakeFsWithDrives([]);
    withFakeNodeRuntime(fakeWindowsProcess(fakeFs), () => {
      assertStrictEquals(getNodeFsSync(), fakeFs);
    });
  });

  it("returns null when neither getBuiltinModule nor a global require exists", () => {
    withFakeNodeRuntime({ platform: "win32" }, () => {
      assertStrictEquals(getNodeFsSync(), null);
    });
  });

  it("returns null instead of throwing when getBuiltinModule itself throws", () => {
    const throwingProcess = {
      platform: "win32",
      getBuiltinModule: () => {
        throw new Error("not supported");
      },
    };
    withFakeNodeRuntime(throwingProcess, () => {
      assertStrictEquals(getNodeFsSync(), null);
    });
  });

  it("falls back to a global require when getBuiltinModule is unavailable", () => {
    const fakeFs = fakeFsWithDrives([]);
    const fakeRequire = (id: string) => (id === "node:fs" ? fakeFs : undefined);
    withGlobals(
      { Deno: undefined, process: { platform: "win32" }, require: fakeRequire },
      () => {
        assertStrictEquals(getNodeFsSync(), fakeFs);
      },
    );
  });

  it("prefers getBuiltinModule over a global require when both exist", () => {
    const builtinFs = fakeFsWithDrives([]);
    const requireFs = fakeFsWithDrives([]);
    const fakeRequire = (id: string) =>
      id === "node:fs" ? requireFs : undefined;
    withGlobals(
      {
        Deno: undefined,
        process: fakeWindowsProcess(builtinFs),
        require: fakeRequire,
      },
      () => {
        assertStrictEquals(getNodeFsSync(), builtinFs);
      },
    );
  });

  it("escalates past a getBuiltinModule result that lacks fs functions", () => {
    const junkModule = {};
    const realFs = fakeFsWithDrives([]);
    const fakeRequire = (id: string) => (id === "node:fs" ? realFs : undefined);
    withGlobals(
      {
        Deno: undefined,
        process: fakeWindowsProcess(junkModule),
        require: fakeRequire,
      },
      () => {
        assertStrictEquals(getNodeFsSync(), realFs);
      },
    );
  });

  it("returns null when every strategy yields a non-fs shape", () => {
    withFakeNodeRuntime(fakeWindowsProcess({}), () => {
      assertStrictEquals(getNodeFsSync(), null);
    });
  });
});

describe("getPreopens", () => {
  it("registers every present Windows drive in a module context without global require (GH #24)", () => {
    const drives = ["C:\\", "D:\\", "F:\\"];
    const fakeProcess = fakeWindowsProcess(fakeFsWithDrives(drives));
    withFakeNodeRuntime(fakeProcess, () => {
      assertEquals(getPreopens(), {
        "/C": "C:\\",
        "/D": "D:\\",
        "/F": "F:\\",
      });
    });
  });

  it("falls back to C: only when no drive letter stats successfully", () => {
    const fakeProcess = fakeWindowsProcess(fakeFsWithDrives([]));
    withFakeNodeRuntime(fakeProcess, () => {
      assertEquals(getPreopens(), { "/C": "C:\\" });
    });
  });

  it("maps the filesystem root on non-Windows platforms", () => {
    withFakeNodeRuntime({ platform: "darwin" }, () => {
      assertEquals(getPreopens(), { "/": "/" });
    });
  });

  it("falls back to C: only and warns when node:fs cannot be acquired on Windows", () => {
    const warnings: string[] = [];
    const savedWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    try {
      withFakeNodeRuntime({ platform: "win32" }, () => {
        assertEquals(getPreopens(), { "/C": "C:\\" });
      });
    } finally {
      console.warn = savedWarn;
    }
    assertEquals(warnings.length, 1);
    assertStringIncludes(warnings[0], "drive detection unavailable");
  });
});

describe("readFileSync", () => {
  it("reads file bytes through an acquired node:fs in a module context", () => {
    const expectedBytes = new Uint8Array([1, 2, 3]);
    const fakeFs = {
      statSync(): void {},
      readFileSync: () => expectedBytes,
    };
    withFakeNodeRuntime(fakeWindowsProcess(fakeFs), () => {
      assertEquals(readFileSync("/music/song.mp3"), expectedBytes);
    });
  });

  // Regression: taglib-0sv — an unavailable node:fs silently produced an
  // empty buffer instead of an error, feeding the getFileBuffer() data-loss
  // vector. It must throw with the path in the message.
  it("throws FileOperationError with the path when node:fs is unavailable (taglib-0sv)", () => {
    withFakeNodeRuntime({ platform: "win32" }, () => {
      assertThrows(
        () => readFileSync("/music/song.mp3"),
        FileOperationError,
        "/music/song.mp3",
      );
    });
  });
});
