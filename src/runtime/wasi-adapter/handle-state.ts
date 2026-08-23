/**
 * Handle state and lifecycle for the WASI FileHandle.
 *
 * The WasiFileHandle class owns destruction guarding and delegates here;
 * this module's branching logic is testable without a Wasm module (pass a
 * stub state/wasi). Extracted from file-handle.ts in the taglib-1dfc split.
 */

import type { WasiModule } from "../wasmer-sdk-loader/types.ts";
import { decodeTagData } from "../../msgpack/decoder.ts";
import { preserveEmptyValues } from "./tag-keys.ts";
import * as wasmIo from "./wasm-io.ts";

/** The mutable handle state: source bytes/path + the tag-data snapshot. */
export interface HandleState {
  wasi: WasiModule;
  fileData: Uint8Array | null;
  filePath: string | null;
  tagData: Record<string, unknown> | null;
}

export function createHandleState(wasi: WasiModule): HandleState {
  return { wasi, fileData: null, filePath: null, tagData: null };
}

/** Read + decode + normalize a buffer source into the snapshot. */
export function loadBuffer(state: HandleState, buffer: Uint8Array): void {
  state.fileData = buffer;
  state.tagData = preserveEmptyValues(
    decodeTagData(wasmIo.readTagsFromWasm(state.wasi, buffer)),
  );
}

/** Read + decode + normalize a path source into the snapshot. */
export function loadPath(state: HandleState, path: string): void {
  state.filePath = path;
  state.tagData = preserveEmptyValues(
    decodeTagData(wasmIo.readTagsFromWasmPath(state.wasi, path)),
  );
}

export function isValid(state: HandleState): boolean {
  return (state.fileData !== null && state.fileData.length > 0) ||
    (state.filePath !== null && state.tagData !== null);
}

/** Write the snapshot back; path mode writes in place, buffer mode returns
 * the new bytes (stored back into state.fileData on success). */
export function save(state: HandleState): boolean {
  if (!state.tagData) return false;

  if (state.filePath) {
    return wasmIo.writeTagsToWasmPath(
      state.wasi,
      state.filePath,
      state.tagData,
    );
  }

  if (!state.fileData) return false;
  const result = wasmIo.writeTagsToWasm(
    state.wasi,
    state.fileData,
    state.tagData,
  );
  if (result) {
    state.fileData = result;
    return true;
  }
  return false;
}

export function getBuffer(state: HandleState): Uint8Array {
  return state.fileData ?? new Uint8Array(0);
}

/** Null the source and snapshot; the class tracks the destroyed flag. */
export function destroy(state: HandleState): void {
  state.fileData = null;
  state.tagData = null;
}
