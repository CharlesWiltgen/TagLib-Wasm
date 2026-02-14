/**
 * @fileoverview WASI P1 stubs and export validation for buffer-only mode
 */

import { WasmerLoadError } from "./types.ts";

/**
 * Instantiate WASI module with stub imports (no filesystem access)
 */
export async function instantiateWasi(
  wasmModule: WebAssembly.Module,
  _config: {
    env: Record<string, string>;
    args: string[];
    mount: Record<string, unknown>;
  },
): Promise<WebAssembly.Instance> {
  // WASI P1 stubs for buffer-only mode (no filesystem access).
  // Signatures must match Wasm type section exactly (i64 -> bigint in JS).
  const EBADF = 8;
  const importObject = {
    wasi_snapshot_preview1: {
      // (i32, i32, i32, i32) -> i32
      fd_write: (_fd: number, _iovs: number, _len: number, _nw: number) => 0,
      // (i32, i32, i32, i32) -> i32
      fd_read: (_fd: number, _iovs: number, _len: number, _nr: number) => EBADF,
      // (i32) -> i32
      fd_close: (_fd: number) => 0,
      // (i32, i64, i32, i32) -> i32
      fd_seek: (_fd: number, _off: bigint, _whence: number, _new: number) =>
        EBADF,
      // (i32, i32) -> i32
      fd_fdstat_get: (_fd: number, _buf: number) => EBADF,
      // (i32, i32) -> i32
      fd_fdstat_set_flags: (_fd: number, _flags: number) => EBADF,
      // (i32, i64) -> i32
      fd_filestat_set_size: (_fd: number, _size: bigint) => EBADF,
      // (i32, i32) -> i32
      fd_prestat_get: (_fd: number, _buf: number) => EBADF,
      // (i32, i32, i32) -> i32
      fd_prestat_dir_name: (_fd: number, _path: number, _len: number) => EBADF,
      // (i32, i32, i32, i32, i32, i64, i64, i32, i32) -> i32
      path_open: ( // NOSONAR — WASI P1 spec mandates 9 parameters
        _fd: number,
        _df: number,
        _p: number,
        _pl: number,
        _of: number,
        _rbBase: bigint,
        _rbInherit: bigint,
        _ff: number,
        _ofd: number,
      ) => 76, // ENOTCAPABLE
      // (i32, i32) -> i32
      args_get: (_argv: number, _buf: number) => 0,
      // (i32, i32) -> i32
      args_sizes_get: (_argc: number, _bufsz: number) => 0,
      // (i32) -> nil
      proc_exit: (_code: number) => {},
    },
    env: {},
  };

  // Instantiate the module
  const instance = await WebAssembly.instantiate(wasmModule, importObject);

  // Initialize if needed (for libraries)
  if (instance.exports._initialize) {
    (instance.exports._initialize as () => void)();
  }

  return instance;
}

/**
 * Validate required WASI exports are present
 */
export function validateWasiExports(exports: WebAssembly.Exports): void {
  const requiredExports = [
    "memory",
    "tl_malloc",
    "tl_free",
    "tl_version",
    "tl_read_tags",
    "tl_write_tags",
    "tl_get_last_error",
  ];

  for (const name of requiredExports) {
    if (!(name in exports)) {
      throw new WasmerLoadError(
        `WASI module missing required export: ${name}`,
      );
    }
  }
}
