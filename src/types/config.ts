/**
 * Configuration options for TagLib Workers initialization.
 * Allows customization of memory limits and debug settings.
 *
 * @example
 * ```typescript
 * const config: TagLibWorkersConfig = {
 *   memory: {
 *     initial: 16 * 1024 * 1024,  // 16MB
 *     maximum: 64 * 1024 * 1024   // 64MB
 *   },
 *   debug: true
 * };
 *
 * const taglib = await TagLibWorkers.initialize(wasmBinary, config);
 * ```
 */
export interface TagLibWorkersConfig {
  /** Memory allocation settings */
  memory?: {
    /** Initial memory size in bytes */
    initial?: number;
    /** Maximum memory size in bytes */
    maximum?: number;
  };
  /** Enable debug output */
  debug?: boolean;
}

/**
 * Options for opening audio files with partial loading support.
 *
 * @example
 * ```typescript
 * // Enable partial loading for large files
 * const file = await taglib.open(largeFile, {
 *   partial: true,
 *   maxHeaderSize: 2 * 1024 * 1024, // 2MB
 *   maxFooterSize: 256 * 1024        // 256KB
 * });
 * ```
 */
export interface OpenOptions {
  /**
   * Enable partial file loading for better performance with large files.
   * When enabled, only the header and footer sections are loaded initially.
   * The full file is loaded automatically when save() is called.
   *
   * @default false
   */
  partial?: boolean;

  /**
   * Maximum size of the header section to load (in bytes).
   * This should be large enough to contain all metadata at the beginning of the file.
   *
   * @default 1048576 (1MB)
   */
  maxHeaderSize?: number;

  /**
   * Maximum size of the footer section to load (in bytes).
   * This should be large enough to contain metadata at the end of the file (e.g., ID3v1 tags).
   *
   * @default 131072 (128KB)
   */
  maxFooterSize?: number;
}
