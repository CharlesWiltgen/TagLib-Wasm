/**
 * @fileoverview Wasmtime sidecar process management
 *
 * Manages a long-lived Wasmtime subprocess for WASI filesystem access.
 * Uses length-prefixed MessagePack protocol for communication.
 */

import { decode, encode } from "@msgpack/msgpack";
import type { ExtendedTag } from "../types.ts";
import { decodeTagData } from "../msgpack/decoder.ts";
import { SidecarError } from "../errors.ts";

/**
 * Configuration for WasmtimeSidecar
 */
export interface SidecarConfig {
  /** Path to the WASM sidecar binary */
  wasmPath: string;
  /** Directory preopens mapping virtual paths to real paths */
  preopens: Record<string, string>;
  /** Optional path to wasmtime executable (defaults to "wasmtime") */
  wasmtimePath?: string;
}

/**
 * Sidecar protocol request types
 */
type SidecarRequest =
  | { op: "read_tags"; path: string }
  | { op: "write_tags"; path: string; tags: Uint8Array };

/**
 * Sidecar protocol response types
 */
type SidecarResponse =
  | { ok: true; tags: Uint8Array }
  | { ok: false; error: string };

/**
 * Manages a long-lived Wasmtime subprocess for direct filesystem access.
 *
 * Uses length-prefixed (LE uint32) MessagePack protocol for IPC.
 */
export class WasmtimeSidecar {
  readonly #config: SidecarConfig;
  #process: Deno.ChildProcess | null = null;
  #stdin: WritableStreamDefaultWriter<Uint8Array> | null = null;
  #stdoutReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  #readBuffer: Uint8Array = new Uint8Array(0);

  constructor(config: SidecarConfig) {
    this.#config = config;
  }

  /**
   * Start the wasmtime sidecar process
   */
  async start(): Promise<void> {
    if (this.#process) {
      throw new SidecarError("Sidecar already running: Call shutdown() first.");
    }

    const wasmtimePath = this.#config.wasmtimePath ?? "wasmtime";
    const args = this.#buildArgs();

    const command = new Deno.Command(wasmtimePath, {
      args,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    this.#process = command.spawn();
    this.#stdin = this.#process.stdin.getWriter();
    this.#stdoutReader = this.#process.stdout.getReader();

    // Start collecting stderr in background for debugging
    void this.#collectStderr();

    // Wait briefly to ensure process started
    await this.#waitForReady();
  }

  /**
   * Check if the sidecar process is running
   */
  isRunning(): boolean {
    return this.#process !== null;
  }

  /**
   * Read tags from a file path within a preopened directory
   */
  async readTags(path: string): Promise<ExtendedTag> {
    if (!this.#process) {
      throw new SidecarError("Sidecar not running: Call start() first.");
    }

    const request: SidecarRequest = { op: "read_tags", path };
    await this.#sendRequest(request);

    const response = await this.#receiveResponse();

    if (!response.ok) {
      throw new SidecarError(`Failed to read tags: ${response.error}`, {
        path,
      });
    }

    return decodeTagData(response.tags);
  }

  /**
   * Write tags to a file path within a preopened directory
   */
  async writeTags(path: string, tags: ExtendedTag): Promise<void> {
    if (!this.#process) {
      throw new SidecarError("Sidecar not running: Call start() first.");
    }

    const tagsEncoded = encode(tags);
    const request: SidecarRequest = {
      op: "write_tags",
      path,
      tags: tagsEncoded,
    };
    await this.#sendRequest(request);

    const response = await this.#receiveResponse();

    if (!response.ok) {
      throw new SidecarError(`Failed to write tags: ${response.error}`, {
        path,
      });
    }
  }

  /**
   * Shutdown the sidecar process
   */
  async shutdown(): Promise<void> {
    if (!this.#process) {
      return;
    }

    try {
      // Close stdin to signal EOF
      await this.#stdin?.close();
      this.#stdoutReader?.releaseLock();

      // Kill process if still running
      try {
        this.#process.kill("SIGTERM");
      } catch {
        // Process may have already exited
      }

      // Wait for process to exit
      await this.#process.status;
    } finally {
      this.#process = null;
      this.#stdin = null;
      this.#stdoutReader = null;
      this.#readBuffer = new Uint8Array(0);
    }
  }

  /**
   * Async dispose for RAII pattern support
   * Allows `await using sidecar = new WasmtimeSidecar(config);`
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.shutdown();
  }

  /**
   * Build wasmtime command arguments
   */
  #buildArgs(): string[] {
    const args: string[] = [];

    // Add directory preopens
    for (
      const [virtualPath, realPath] of Object.entries(this.#config.preopens)
    ) {
      args.push("--dir", `${realPath}::${virtualPath}`);
    }

    // Add the WASM path
    args.push(this.#config.wasmPath);

    return args;
  }

  /**
   * Send a length-prefixed MessagePack request
   */
  async #sendRequest(request: SidecarRequest): Promise<void> {
    if (!this.#stdin) {
      throw new SidecarError("Stdin not available.");
    }

    const payload = encode(request);
    const lengthPrefix = new Uint8Array(4);
    const view = new DataView(
      lengthPrefix.buffer,
      lengthPrefix.byteOffset,
      lengthPrefix.byteLength,
    );
    view.setUint32(0, payload.length, true); // Little-endian

    await this.#stdin.write(lengthPrefix);
    await this.#stdin.write(payload);
  }

  /**
   * Receive a length-prefixed MessagePack response
   */
  async #receiveResponse(): Promise<SidecarResponse> {
    // Read length prefix (4 bytes, LE uint32)
    const lengthBytes = await this.#readExact(4);
    const view = new DataView(
      lengthBytes.buffer,
      lengthBytes.byteOffset,
      lengthBytes.byteLength,
    );
    const payloadLength = view.getUint32(0, true);

    // Read payload
    const payload = await this.#readExact(payloadLength);

    return decode(payload) as SidecarResponse;
  }

  /**
   * Read exact number of bytes from stdout
   */
  async #readExact(n: number): Promise<Uint8Array> {
    while (this.#readBuffer.length < n) {
      const result = await this.#stdoutReader!.read();

      if (result.done) {
        throw new SidecarError("Sidecar process ended unexpectedly.");
      }

      // Append to buffer
      const newBuffer = new Uint8Array(
        this.#readBuffer.length + result.value.length,
      );
      newBuffer.set(this.#readBuffer);
      newBuffer.set(result.value, this.#readBuffer.length);
      this.#readBuffer = newBuffer;
    }

    // Extract requested bytes
    const result = this.#readBuffer.slice(0, n);
    this.#readBuffer = this.#readBuffer.slice(n);
    return result;
  }

  /**
   * Collect stderr output for debugging
   */
  async #collectStderr(): Promise<void> {
    if (!this.#process) return;

    const reader = this.#process.stderr.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        if (text.trim()) {
          console.error(`[wasmtime-sidecar] ${text}`);
        }
      }
    } catch {
      // Reader may be released when process exits
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Wait for sidecar to be ready
   */
  async #waitForReady(): Promise<void> {
    // Give process time to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if process is still running
    if (this.#process) {
      // Try to get status without blocking
      const statusPromise = this.#process.status;
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 50)
      );

      const result = await Promise.race([statusPromise, timeoutPromise]);

      // If we got a status, the process has exited
      if (result !== null) {
        const status = result as Deno.CommandStatus;
        this.#process = null;
        throw new SidecarError(
          `Sidecar process exited with code ${status.code}: Check wasmtime installation and WASM path.`,
          { exitCode: status.code },
        );
      }
    }
  }
}
