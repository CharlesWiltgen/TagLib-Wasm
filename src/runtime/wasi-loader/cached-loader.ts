/**
 * @fileoverview Cached WASI loader for reuse across multiple file operations
 *
 * @deprecated Use {@link loadWasiHost} from `../wasi-host-loader.ts` instead.
 */

import type { WasiExports, WasiLoaderConfig } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import { loadWasi } from "./loader.ts";

/**
 * Create a WASI loader instance with caching
 * Useful for applications that need to load multiple files
 * @deprecated Use {@link loadWasiHost} from `../wasi-host-loader.ts` instead.
 */
export class CachedWasiLoader {
  private instance: WasiExports | null = null;
  private config: WasiLoaderConfig;

  constructor(config: Partial<WasiLoaderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get or create the WASI instance
   */
  async getInstance(): Promise<WasiExports> {
    if (!this.instance) {
      this.instance = await loadWasi(this.config);
    }
    return this.instance;
  }

  /**
   * Clear the cached instance (useful for testing)
   */
  clearCache(): void {
    this.instance = null;
  }

  /**
   * Update configuration and clear cache
   */
  updateConfig(newConfig: Partial<WasiLoaderConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.clearCache();
  }
}
