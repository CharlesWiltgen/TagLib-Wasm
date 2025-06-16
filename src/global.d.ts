/**
 * Global type declarations for cross-runtime compatibility
 */

// Declare Deno namespace when not in Deno environment
declare global {
  // eslint-disable-next-line no-var
  var Deno: {
    readFile(path: string): Promise<Uint8Array>;
    writeFile(path: string, data: Uint8Array): Promise<void>;
  } | undefined;
}

export {};