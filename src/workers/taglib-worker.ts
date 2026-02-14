import type { TagLib } from "../taglib.ts";
import {
  applyCoverArt,
  applyTags,
  readProperties,
  setBufferMode,
  updateTags,
} from "../simple/index.ts";
import { handleBatchOperations } from "./batch-handler.ts";

type WorkerSelf = {
  onmessage: ((event: MessageEvent) => void | Promise<void>) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown): void;
};

const workerSelf = self as unknown as WorkerSelf;

setBufferMode(true);

let taglib: TagLib | null = null;

async function initializeTagLib(): Promise<void> {
  if (!taglib) {
    const { TagLib } = await import("../taglib.ts");
    taglib = await TagLib.initialize({ forceBufferMode: true });
  }
}

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
        if (!taglib) await initializeTagLib();
        const result = await handleBatchOperations(
          taglib!,
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
