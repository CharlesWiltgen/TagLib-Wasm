import { EnvironmentError, FileOperationError } from "../errors.ts";
import { getPlatformIO } from "../runtime/platform-io.ts";

/**
 * Write data to a file across different runtimes.
 * Supports Node.js, Deno, and Bun environments.
 */
export async function writeFileData(
  path: string,
  data: Uint8Array,
): Promise<void> {
  try {
    await getPlatformIO().writeFile(path, data);
  } catch (error) {
    if (error instanceof EnvironmentError) throw error;
    throw new FileOperationError(
      "write",
      (error as Error).message,
      path,
    );
  }
}
