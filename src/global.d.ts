/**
 * Global type declarations for cross-runtime compatibility
 */

// Declare Deno global for TypeScript when not in Deno environment
declare global {
  // @ts-expect-error: Suppress redeclaration error in Deno environment
  namespace Deno {
    type FsFile = unknown;
    type SeekMode = unknown;
    type OpenOptions = unknown;
    type ChildProcess = unknown;
    type CommandStatus = unknown;
  }

  // @ts-expect-error: Suppress duplicate identifier error in Deno
  const Deno: unknown;
}

export {};
