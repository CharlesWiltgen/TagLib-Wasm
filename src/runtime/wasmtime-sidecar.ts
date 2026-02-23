/**
 * @fileoverview Wasmtime sidecar process management
 *
 * Manages a long-lived Wasmtime subprocess for WASI filesystem access.
 * Uses length-prefixed MessagePack protocol for communication.
 */

import type { ExtendedTag } from "../types.ts";
import { decodeTagData } from "../msgpack/decoder.ts";
import { encodeTagData } from "../msgpack/encoder.ts";
import { SidecarError } from "../errors.ts";
import {
  createReadBuffer,
  type ReadBuffer,
  receiveResponse,
  sendRequest,
} from "./length-prefix-protocol.ts";

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
  #readBuffer: ReadBuffer = createReadBuffer();

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

    void this.#collectStderr();

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
    this.#assertRunning();

    const request: SidecarRequest = { op: "read_tags", path };
    await sendRequest(this.#stdin!, request);

    const response = await receiveResponse<SidecarResponse>(
      this.#stdoutReader!,
      this.#readBuffer,
    );

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
    this.#assertRunning();

    const tagsEncoded = encodeTagData(tags);
    const request: SidecarRequest = {
      op: "write_tags",
      path,
      tags: tagsEncoded,
    };
    await sendRequest(this.#stdin!, request);

    const response = await receiveResponse<SidecarResponse>(
      this.#stdoutReader!,
      this.#readBuffer,
    );

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
      await this.#stdin?.close();
      this.#stdoutReader?.releaseLock();

      try {
        this.#process.kill("SIGTERM");
      } catch {
        // Process may have already exited
      }

      await this.#process.status;
    } finally {
      this.#process = null;
      this.#stdin = null;
      this.#stdoutReader = null;
      this.#readBuffer = createReadBuffer();
    }
  }

  /**
   * Async dispose for RAII pattern support
   * Allows `await using sidecar = new WasmtimeSidecar(config);`
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.shutdown();
  }

  #assertRunning(): void {
    if (!this.#process) {
      throw new SidecarError("Sidecar not running: Call start() first.");
    }
  }

  #buildArgs(): string[] {
    const args: string[] = [];

    for (
      const [virtualPath, realPath] of Object.entries(this.#config.preopens)
    ) {
      args.push("--dir", `${realPath}::${virtualPath}`);
    }

    args.push(this.#config.wasmPath);

    return args;
  }

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

  async #waitForReady(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (this.#process) {
      const statusPromise = this.#process.status;
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 50)
      );

      const result = await Promise.race([statusPromise, timeoutPromise]);

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
