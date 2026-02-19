/**
 * @fileoverview Length-prefixed MessagePack IPC protocol
 *
 * Provides send/receive over streams using LE uint32 length-prefixed framing.
 * Used by WasmtimeSidecar for subprocess communication.
 */

import { decode, encode } from "@msgpack/msgpack";
import { SidecarError } from "../errors.ts";

/**
 * Mutable read buffer for accumulating stream data between reads.
 * Must be passed by the caller to preserve state across calls.
 */
export type ReadBuffer = { data: Uint8Array };

/**
 * Create a fresh ReadBuffer
 */
export function createReadBuffer(): ReadBuffer {
  return { data: new Uint8Array(0) };
}

/**
 * Send a length-prefixed MessagePack message to a writable stream.
 *
 * Wire format: [LE uint32 payload length][MessagePack payload]
 */
export async function sendRequest(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  request: unknown,
): Promise<void> {
  const payload = encode(request);
  const lengthPrefix = new Uint8Array(4);
  const view = new DataView(
    lengthPrefix.buffer,
    lengthPrefix.byteOffset,
    lengthPrefix.byteLength,
  );
  view.setUint32(0, payload.length, true);

  await writer.write(lengthPrefix);
  await writer.write(payload);
}

/**
 * Receive a length-prefixed MessagePack message from a readable stream.
 *
 * Reads the LE uint32 length prefix, then reads that many bytes of payload.
 */
export async function receiveResponse<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buffer: ReadBuffer,
): Promise<T> {
  const lengthBytes = await readExact(reader, buffer, 4);
  const view = new DataView(
    lengthBytes.buffer,
    lengthBytes.byteOffset,
    lengthBytes.byteLength,
  );
  const payloadLength = view.getUint32(0, true);

  const payload = await readExact(reader, buffer, payloadLength);

  return decode(payload) as T;
}

/**
 * Read exactly `n` bytes from a stream reader, buffering partial reads.
 */
export async function readExact(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buffer: ReadBuffer,
  n: number,
): Promise<Uint8Array> {
  while (buffer.data.length < n) {
    const result = await reader.read();

    if (result.done) {
      throw new SidecarError("Sidecar process ended unexpectedly.");
    }

    const newData = new Uint8Array(buffer.data.length + result.value.length);
    newData.set(buffer.data);
    newData.set(result.value, buffer.data.length);
    buffer.data = newData;
  }

  const extracted = buffer.data.slice(0, n);
  buffer.data = buffer.data.slice(n);
  return extracted;
}
