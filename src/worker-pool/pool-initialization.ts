import { WorkerError } from "../errors.ts";
import type { WorkerState } from "./types.ts";

export function createTagLibWorker(): Worker {
  try {
    return new Worker(
      new URL("../workers/taglib-worker.ts", import.meta.url),
      { type: "module" },
    );
  } catch (error) {
    throw new WorkerError(
      `Failed to create worker: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function initializeWorkers(
  size: number,
  initTimeout: number,
  debug: boolean,
): { workers: WorkerState[]; ready: Promise<void> } {
  const workers: WorkerState[] = [];
  const initPromises: Promise<void>[] = [];

  for (let i = 0; i < size; i++) {
    const workerState: WorkerState = {
      worker: createTagLibWorker(),
      busy: false,
      initialized: false,
    };
    workers.push(workerState);

    const initPromise = new Promise<void>((resolve, reject) => {
      workerState.initTimeout = setTimeout(() => {
        workerState.initTimeout = undefined;
        reject(new WorkerError("Worker initialization timed out"));
      }, initTimeout);

      const messageHandler = (e: MessageEvent) => {
        if (e.data.type === "initialized") {
          if (workerState.initTimeout) {
            clearTimeout(workerState.initTimeout);
            workerState.initTimeout = undefined;
          }
          workerState.initialized = true;
          workerState.worker.removeEventListener("message", messageHandler);
          if (debug) console.log(`Worker ${i} initialized`);
          resolve();
        } else if (e.data.type === "error") {
          if (workerState.initTimeout) {
            clearTimeout(workerState.initTimeout);
            workerState.initTimeout = undefined;
          }
          workerState.worker.removeEventListener("message", messageHandler);
          reject(new WorkerError(e.data.error));
        }
      };

      workerState.worker.addEventListener("message", messageHandler);
      workerState.worker.addEventListener("error", (event) => {
        if (workerState.initTimeout) {
          clearTimeout(workerState.initTimeout);
          workerState.initTimeout = undefined;
        }
        const message = event instanceof ErrorEvent
          ? event.message
          : String(event);
        reject(new WorkerError(`Worker error: ${message}`));
      });

      workerState.worker.postMessage({ op: "init" });
    });

    initPromises.push(initPromise);
  }

  return { workers, ready: Promise.all(initPromises).then(() => {}) };
}
