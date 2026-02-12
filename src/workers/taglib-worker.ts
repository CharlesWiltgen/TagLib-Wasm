/**
 * @fileoverview Web Worker implementation for TagLib operations
 *
 * This worker handles TagLib operations in a separate thread,
 * enabling parallel processing of audio files.
 */

import type { TagLib } from "../taglib.ts";
import type { Tag } from "../types.ts";
import {
  applyCoverArt,
  applyTags,
  readProperties,
  setBufferMode,
  updateTags,
} from "../simple.ts";

type WorkerSelf = {
  onmessage: ((event: MessageEvent) => void | Promise<void>) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown): void;
};

const workerSelf = self as unknown as WorkerSelf;

// Force Emscripten buffer mode in workers (WASI Wasmer SDK not yet stable)
setBufferMode(true);

// Cached TagLib instance
let taglib: TagLib | null = null;

/**
 * Initialize TagLib instance in the worker
 */
async function initializeTagLib(): Promise<void> {
  if (!taglib) {
    const { TagLib } = await import("../taglib.ts");
    taglib = await TagLib.initialize({ forceBufferMode: true });
  }
}

/**
 * Handle batch operations using Full API
 */
async function handleBatchOperations(
  file: string | Uint8Array,
  operations: Array<{ method: string; args?: any[] }>,
): Promise<any> {
  if (!taglib) await initializeTagLib();

  const audioFile = await taglib!.open(file);
  const result: any = {};

  try {
    for (const op of operations) {
      const { method, args = [] } = op;

      switch (method) {
        // Tag operations
        case "setTitle":
          audioFile.tag().setTitle(args[0]);
          break;
        case "setArtist":
          audioFile.tag().setArtist(args[0]);
          break;
        case "setAlbum":
          audioFile.tag().setAlbum(args[0]);
          break;
        case "setComment":
          audioFile.tag().setComment(args[0]);
          break;
        case "setGenre":
          audioFile.tag().setGenre(args[0]);
          break;
        case "setYear":
          audioFile.tag().setYear(args[0]);
          break;
        case "setTrack":
          audioFile.tag().setTrack(args[0]);
          break;

        // Property operations
        case "setProperty":
          audioFile.setProperty(args[0], args[1]);
          break;
        case "setProperties":
          audioFile.setProperties(args[0]);
          break;

        // Picture operations
        case "setPictures":
          audioFile.setPictures(args[0]);
          break;
        case "addPicture":
          audioFile.addPicture(args[0]);
          break;
        case "removePictures":
          audioFile.removePictures();
          break;

        // Save operation
        case "save":
          result.saved = audioFile.save();
          result.buffer = audioFile.getFileBuffer();
          break;

        // Read operations
        case "tag": {
          const tag = audioFile.tag();
          // Return plain object without functions
          result.tag = {
            title: tag.title,
            artist: tag.artist,
            album: tag.album,
            comment: tag.comment,
            genre: tag.genre,
            year: tag.year,
            track: tag.track,
          };
          break;
        }
        case "properties":
          result.properties = audioFile.properties();
          break;
        case "audioProperties":
          result.audioProperties = audioFile.audioProperties();
          break;
        case "getPictures":
          result.pictures = audioFile.getPictures();
          break;

        default:
          throw new Error(`Unknown batch operation: ${method}`);
      }
    }

    return result;
  } finally {
    audioFile.dispose();
  }
}

/**
 * Worker message handler
 */
workerSelf.onmessage = async (event: MessageEvent) => {
  try {
    const { op, ...params } = event.data;

    switch (op) {
      case "init":
        try {
          await initializeTagLib();
          workerSelf.postMessage({ type: "initialized" });
        } catch (initError) {
          console.error("Worker initialization failed:", initError);
          workerSelf.postMessage({
            type: "error",
            error: initError instanceof Error
              ? initError.message
              : String(initError),
          });
        }
        break;

      case "readTags": {
        // We need to use the taglib directly to avoid returning functions
        if (!taglib) await initializeTagLib();
        const audioFile = await taglib!.open(params.file);
        try {
          const tag = audioFile.tag();
          // Return only serializable data
          const result = {
            title: tag.title,
            artist: tag.artist,
            album: tag.album,
            comment: tag.comment,
            genre: tag.genre,
            year: tag.year,
            track: tag.track,
          };
          workerSelf.postMessage({ type: "result", result });
        } finally {
          audioFile.dispose();
        }
        break;
      }

      case "readProperties": {
        const properties = await readProperties(params.file);
        workerSelf.postMessage({ type: "result", result: properties });
        break;
      }

      case "applyTags": {
        const buffer = await applyTags(params.file, params.tags);
        workerSelf.postMessage({ type: "result", result: buffer });
        break;
      }

      case "updateTags": {
        await updateTags(params.file, params.tags);
        workerSelf.postMessage({ type: "result", result: undefined });
        break;
      }

      case "readPictures": {
        // We need to use the taglib directly to avoid returning functions
        if (!taglib) await initializeTagLib();
        const audioFile = await taglib!.open(params.file);
        try {
          const pictures = audioFile.getPictures();
          workerSelf.postMessage({ type: "result", result: pictures });
        } finally {
          audioFile.dispose();
        }
        break;
      }

      case "setCoverArt": {
        const buffer = await applyCoverArt(
          params.file,
          params.coverArt,
          params.mimeType,
        );
        workerSelf.postMessage({ type: "result", result: buffer });
        break;
      }

      case "batch": {
        const result = await handleBatchOperations(
          params.file,
          params.operations,
        );
        workerSelf.postMessage({ type: "result", result });
        break;
      }

      default:
        throw new Error(`Unknown operation: ${op}`);
    }
  } catch (error) {
    workerSelf.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Handle worker errors
workerSelf.onerror = (event) => {
  const message = event instanceof ErrorEvent ? event.message : String(event);
  workerSelf.postMessage({
    type: "error",
    error: `Worker error: ${message}`,
  });
};
