/**
 * Global type declarations for cross-runtime compatibility
 */

// Declare Deno global for TypeScript when not in Deno environment
declare global {
  namespace Deno {
    type FsFile = any;
    type SeekMode = any;
    type OpenOptions = any;
    type ChildProcess = any;
    type CommandStatus = any;
  }

  // @ts-ignore: Suppress duplicate identifier error in Deno
  const Deno: any;
}

export {};
