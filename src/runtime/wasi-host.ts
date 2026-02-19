import type { FileSystemProvider, WasiFileHandle } from "./wasi-fs-provider.ts";

export interface WasiHostConfig {
  preopens: Record<string, string>;
  fs: FileSystemProvider;
  stdout?: (data: Uint8Array) => void;
  stderr?: (data: Uint8Array) => void;
}

const WASI_ESUCCESS = 0;
const WASI_EBADF = 8;
const WASI_EINVAL = 28;
const WASI_ENOENT = 44;
const WASI_ENOTCAPABLE = 76;
const OFLAGS_CREAT = 1;
const OFLAGS_TRUNC = 8;
const RIGHTS_FD_WRITE = 1n << 6n;

type FdEntry =
  | { type: "preopen"; realPath: string; virtualPath: string }
  | { type: "file"; file: WasiFileHandle; path: string };

// deno-lint-ignore no-explicit-any
type WasiImports = Record<string, (...args: any[]) => number | void>;

export type WasiImportDisposable = WasiImports & { [Symbol.dispose](): void };

export function createWasiImports(
  memory: { buffer: ArrayBuffer },
  config: WasiHostConfig,
): WasiImportDisposable {
  const fds = new Map<number, FdEntry>();
  let nextFd = 3;

  for (const [virtualPath, realPath] of Object.entries(config.preopens)) {
    fds.set(nextFd, { type: "preopen", realPath, virtualPath });
    nextFd++;
  }

  function getMemory(): { u8: Uint8Array; dv: DataView } {
    return {
      u8: new Uint8Array(memory.buffer),
      dv: new DataView(memory.buffer),
    };
  }
  function resolvePath(
    dirFd: number,
    pathPtr: number,
    pathLen: number,
  ): string | null {
    const dir = fds.get(dirFd);
    if (dir?.type !== "preopen") return null;

    const { u8 } = getMemory();
    const relPath = new TextDecoder().decode(
      u8.slice(pathPtr, pathPtr + pathLen),
    );
    const normalized = relPath.replaceAll("\\", "/");
    const segments = normalized.split("/");
    if (segments.includes("..") || normalized.startsWith("/")) return null;

    return `${dir.realPath}/${normalized}`;
  }
  return {
    args_get: (_argv: number, _buf: number) => WASI_ESUCCESS,
    args_sizes_get: (argcPtr: number, bufSzPtr: number) => {
      const { dv } = getMemory();
      dv.setUint32(argcPtr, 0, true);
      dv.setUint32(bufSzPtr, 0, true);
      return WASI_ESUCCESS;
    },
    fd_close: (fd: number) => {
      const entry = fds.get(fd);
      if (!entry) return WASI_EBADF;
      if (entry.type === "file") {
        try {
          entry.file.close();
        } catch { /* already closed */ }
      }
      fds.delete(fd);
      return WASI_ESUCCESS;
    },
    fd_fdstat_get: (fd: number, buf: number) => {
      const entry = fds.get(fd);
      if (!entry) return WASI_EBADF;
      const { dv } = getMemory();
      const fileType = entry.type === "preopen" ? 3 : 4;
      dv.setUint8(buf, fileType);
      dv.setUint16(buf + 2, 0, true);
      dv.setBigUint64(buf + 8, 0xFFFFFFFFFFFFFFFFn, true);
      dv.setBigUint64(buf + 16, 0xFFFFFFFFFFFFFFFFn, true);
      return WASI_ESUCCESS;
    },
    fd_fdstat_set_flags: (_fd: number, _flags: number) => WASI_ESUCCESS,
    fd_filestat_set_size: (fd: number, size: bigint) => {
      const entry = fds.get(fd);
      if (entry?.type !== "file") return WASI_EBADF;
      try {
        entry.file.truncateSync(Number(size));
        return WASI_ESUCCESS;
      } catch {
        return WASI_EINVAL;
      }
    },
    fd_prestat_get: (fd: number, buf: number) => {
      const entry = fds.get(fd);
      if (entry?.type !== "preopen") return WASI_EBADF;
      const { dv } = getMemory();
      const pathBytes = new TextEncoder().encode(entry.virtualPath);
      dv.setUint32(buf, 0, true);
      dv.setUint32(buf + 4, pathBytes.length, true);
      return WASI_ESUCCESS;
    },
    fd_prestat_dir_name: (fd: number, pathPtr: number, pathLen: number) => {
      const entry = fds.get(fd);
      if (entry?.type !== "preopen") return WASI_EBADF;
      const { u8 } = getMemory();
      const pathBytes = new TextEncoder().encode(entry.virtualPath);
      u8.set(pathBytes.subarray(0, pathLen), pathPtr);
      return WASI_ESUCCESS;
    },
    fd_read: (
      fd: number,
      iovsPtr: number,
      iovsLen: number,
      nreadPtr: number,
    ) => {
      const entry = fds.get(fd);
      if (entry?.type !== "file") return WASI_EBADF;
      const { u8, dv } = getMemory();
      let totalRead = 0;
      for (let i = 0; i < iovsLen; i++) {
        const bufPtr = dv.getUint32(iovsPtr + i * 8, true);
        const bufLen = dv.getUint32(iovsPtr + i * 8 + 4, true);
        const target = u8.subarray(bufPtr, bufPtr + bufLen);
        const n = entry.file.readSync(target);
        if (n === null) break;
        totalRead += n;
        if (n < bufLen) break;
      }
      dv.setUint32(nreadPtr, totalRead, true);
      return WASI_ESUCCESS;
    },
    fd_seek: (
      fd: number,
      offset: bigint,
      whence: number,
      newoffsetPtr: number,
    ) => {
      const entry = fds.get(fd);
      if (entry?.type !== "file") return WASI_EBADF;
      try {
        const newPos = entry.file.seekSync(Number(offset), whence as 0 | 1 | 2);
        const { dv } = getMemory();
        dv.setBigInt64(newoffsetPtr, BigInt(newPos), true);
        return WASI_ESUCCESS;
      } catch {
        return WASI_EINVAL;
      }
    },
    fd_write: (
      fd: number,
      iovsPtr: number,
      iovsLen: number,
      nwrittenPtr: number,
    ) => {
      const { u8, dv } = getMemory();
      let totalWritten = 0;
      for (let i = 0; i < iovsLen; i++) {
        const bufPtr = dv.getUint32(iovsPtr + i * 8, true);
        const bufLen = dv.getUint32(iovsPtr + i * 8 + 4, true);
        const data = u8.subarray(bufPtr, bufPtr + bufLen);
        if (fd === 1) {
          config.stdout?.(data);
          totalWritten += bufLen;
        } else if (fd === 2) {
          config.stderr?.(data);
          totalWritten += bufLen;
        } else {
          const entry = fds.get(fd);
          if (entry?.type !== "file") return WASI_EBADF;
          totalWritten += entry.file.writeSync(data);
        }
      }
      dv.setUint32(nwrittenPtr, totalWritten, true);
      return WASI_ESUCCESS;
    },
    path_open: ( // NOSONAR — WASI P1 spec mandates 9 parameters
      dirFd: number,
      _dirflags: number,
      pathPtr: number,
      pathLen: number,
      oflags: number,
      _rightsBase: bigint,
      _rightsInheriting: bigint,
      _fdflags: number,
      openedFdPtr: number,
    ) => {
      const realPath = resolvePath(dirFd, pathPtr, pathLen);
      if (!realPath) return WASI_ENOTCAPABLE;
      try {
        const wantWrite = (_rightsBase & RIGHTS_FD_WRITE) !== 0n ||
          (oflags & (OFLAGS_CREAT | OFLAGS_TRUNC)) !== 0;
        const options = {
          read: true,
          write: wantWrite,
          create: (oflags & OFLAGS_CREAT) !== 0,
          truncate: (oflags & OFLAGS_TRUNC) !== 0,
        };
        const file = config.fs.openSync(realPath, options);
        const fd = nextFd++;
        fds.set(fd, { type: "file", file, path: realPath });
        const { dv } = getMemory();
        dv.setUint32(openedFdPtr, fd, true);
        return WASI_ESUCCESS;
      } catch (e) {
        if (config.fs.isNotFoundError(e)) return WASI_ENOENT;
        return WASI_EINVAL;
      }
    },

    environ_get: (_environ: number, _buf: number) => WASI_ESUCCESS,
    environ_sizes_get: (countPtr: number, bufSzPtr: number) => {
      const { dv } = getMemory();
      dv.setUint32(countPtr, 0, true);
      dv.setUint32(bufSzPtr, 0, true);
      return WASI_ESUCCESS;
    },

    clock_time_get: (_id: number, _precision: bigint, timePtr: number) => {
      const { dv } = getMemory();
      dv.setBigUint64(timePtr, BigInt(Date.now()) * 1_000_000n, true);
      return WASI_ESUCCESS;
    },
    proc_exit: (code: number) => {
      throw new Error(`WASI proc_exit called: code ${code}`);
    },
    [Symbol.dispose]: () => {
      for (const [fd, entry] of fds) {
        if (entry.type === "file") {
          try {
            entry.file.close();
          } catch { /* already closed */ }
        }
        fds.delete(fd);
      }
    },
  };
}
