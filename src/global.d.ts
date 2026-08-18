/**
 * Global type declarations for cross-runtime compatibility
 */

// Declare Deno global for TypeScript when not in Deno environment
declare global {
  // @ts-expect-error: Suppress redeclaration error in Deno environment
  namespace Deno {
    // Numeric enum in current Deno (WASI whence constants): runtime value is
    // {0:"Start",1:"Current",2:"End",Start:0,Current:1,End:2}.
    type SeekMode = 0 | 1 | 2;
    type FsFile = {
      read(
        buffer: Uint8Array,
        options?: { offset?: number },
      ): Promise<number | null>;
      readSync(
        buffer: Uint8Array,
        options?: { offset?: number },
      ): number | null;
      write(data: Uint8Array): Promise<number>;
      writeSync(data: Uint8Array): number;
      seek(offset: number, whence: SeekMode): Promise<number>;
      seekSync(offset: number, whence: SeekMode): number;
      truncateSync(len?: number): void;
      close(): Promise<void>;
      stat(): Promise<{ size: number }>;
    };
    type OpenOptions = {
      read?: boolean;
      write?: boolean;
      create?: boolean;
      truncate?: boolean;
      append?: boolean;
    };
  }

  // @ts-expect-error: Suppress duplicate identifier error in Deno
  // Structural subset of the Deno namespace used by src/; in Deno the real
  // types override this stub, in Node.js tsc it keeps the build typed.
  const Deno: {
    readFile(path: string | URL): Promise<Uint8Array>;
    readFileSync(path: string | URL): Uint8Array;
    writeFile(path: string | URL, data: Uint8Array): Promise<void>;
    writeTextFile(path: string | URL, data: string): Promise<void>;
    remove(
      path: string | URL,
      options?: { recursive?: boolean },
    ): Promise<void>;
    mkdir(path: string | URL, options?: { recursive?: boolean }): Promise<void>;
    makeTempFile(
      options?: { dir?: string; prefix?: string; suffix?: string },
    ): Promise<string>;
    makeTempDir(options?: { dir?: string; prefix?: string }): Promise<string>;
    stat(
      path: string | URL,
    ): Promise<
      {
        size: number;
        isFile: boolean;
        isDirectory: boolean;
        isSymlink: boolean;
      }
    >;
    statSync(
      path: string | URL,
    ): {
      size: number;
      isFile: boolean;
      isDirectory: boolean;
      isSymlink: boolean;
    };
    readDir(
      path: string | URL,
    ): AsyncIterable<
      {
        name: string;
        isFile: boolean;
        isDirectory: boolean;
        isSymlink: boolean;
      }
    >;
    open(path: string | URL, options?: Deno.OpenOptions): Promise<Deno.FsFile>;
    openSync(path: string | URL, options?: Deno.OpenOptions): Deno.FsFile;
    cwd(): string;
    build: { os: string; arch: string };
    mainModule: string;
    SeekMode: { readonly Start: 0; readonly Current: 1; readonly End: 2 };
    errors: Record<string, typeof Error>;
  };
}

export {};
