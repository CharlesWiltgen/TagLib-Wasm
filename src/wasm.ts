/**
 * @fileoverview WebAssembly module interface types for Emscripten
 */

/** Raw picture with numeric type as received from/sent to C++ boundary */
export interface RawPicture {
  mimeType: string;
  data: Uint8Array;
  type: number;
  description?: string;
}

// Basic Emscripten module interface
export interface EmscriptenModule {
  // Memory
  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
  wasmMemory?: WebAssembly.Memory;

  // Memory management
  _malloc(size: number): number;
  _free(ptr: number): void;
  _realloc?(ptr: number, newSize: number): number;
  allocate?(data: number[] | Uint8Array, allocator: number): number;
  ALLOC_NORMAL?: number;

  // String conversion
  ccall?(
    ident: string,
    returnType: string,
    argTypes: string[],
    args: any[],
  ): any;
  cwrap?(
    ident: string,
    returnType: string,
    argTypes: string[],
  ): (...args: any[]) => any;

  UTF8ToString?(ptr: number): string;
  stringToUTF8?(str: string, ptr: number, maxBytes: number): number;
  lengthBytesUTF8?(str: string): number;

  addFunction?(func: any): number;
  removeFunction?(funcPtr: number): void;

  // File system (if enabled)
  FS?: any;

  // Runtime
  ready?: Promise<EmscriptenModule>;
  then?(callback: (module: EmscriptenModule) => void): void;
  onRuntimeInitialized?: () => void;
}

// Embind class interfaces
export interface FileHandle {
  loadFromBuffer(data: Uint8Array): boolean;
  isValid(): boolean;
  save(): boolean;
  getFormat(): string;
  getProperties(): Record<string, string[]>;
  setProperties(props: Record<string, string[]>): void;
  getProperty(key: string): string;
  setProperty(key: string, value: string): void;
  isMP4(): boolean;
  getMP4Item(key: string): string;
  setMP4Item(key: string, value: string): void;
  removeMP4Item(key: string): void;
  getTag(): TagWrapper;
  getAudioProperties(): AudioPropertiesWrapper | null;
  getBuffer(): Uint8Array;
  getPictures(): RawPicture[];
  setPictures(pictures: RawPicture[]): void;
  addPicture(picture: RawPicture): void;
  removePictures(): void;
  getRatings(): { rating: number; email: string; counter: number }[];
  setRatings(
    ratings: { rating: number; email?: string; counter?: number }[],
  ): void;
  destroy(): void;
}

export interface TagWrapper {
  title(): string;
  artist(): string;
  album(): string;
  comment(): string;
  genre(): string;
  year(): number;
  track(): number;
  setTitle(value: string): void;
  setArtist(value: string): void;
  setAlbum(value: string): void;
  setComment(value: string): void;
  setGenre(value: string): void;
  setYear(value: number): void;
  setTrack(value: number): void;
}

export interface AudioPropertiesWrapper {
  lengthInSeconds(): number;
  lengthInMilliseconds(): number;
  bitrate(): number;
  sampleRate(): number;
  channels(): number;
  bitsPerSample(): number;
  codec(): string;
  containerFormat(): string;
  isLossless(): boolean;
}

/**
 * TagLib WebAssembly module interface.
 * Provides access to Embind classes and low-level C-style functions.
 * @internal Most users should use {@link TagLib} instead of accessing this directly.
 */
export interface TagLibModule extends Omit<EmscriptenModule, "then"> {
  /** @internal Embind FileHandle class constructor */
  FileHandle: new () => FileHandle;
  /** @internal Embind TagWrapper class constructor */
  TagWrapper: new () => TagWrapper;
  /** @internal Embind AudioPropertiesWrapper class constructor */
  AudioPropertiesWrapper: new () => AudioPropertiesWrapper;

  /** @internal Create a new file handle for audio file operations */
  createFileHandle(): FileHandle;

  /** @internal C-style function: create file from buffer */
  _taglib_file_new_from_buffer?(ptr: number, size: number): number;
  /** @internal C-style function: delete file handle */
  _taglib_file_delete?(fileId: number): void;
  /** @internal C-style function: check if file is valid */
  _taglib_file_is_valid?(fileId: number): number;
  /** @internal C-style function: get file format */
  _taglib_file_format?(fileId: number): number;
  /** @internal C-style function: get tag pointer */
  _taglib_file_tag?(fileId: number): number;
  /** @internal C-style function: get audio properties pointer */
  _taglib_file_audioproperties?(fileId: number): number;
  /** @internal C-style function: save file */
  _taglib_file_save?(fileId: number): number;

  /** @internal C-style function: get title string pointer */
  _taglib_tag_title?(tagPtr: number): number;
  /** @internal C-style function: get artist string pointer */
  _taglib_tag_artist?(tagPtr: number): number;
  /** @internal C-style function: get album string pointer */
  _taglib_tag_album?(tagPtr: number): number;
  /** @internal C-style function: get comment string pointer */
  _taglib_tag_comment?(tagPtr: number): number;
  /** @internal C-style function: get genre string pointer */
  _taglib_tag_genre?(tagPtr: number): number;
  /** @internal C-style function: get year */
  _taglib_tag_year?(tagPtr: number): number;
  /** @internal C-style function: get track number */
  _taglib_tag_track?(tagPtr: number): number;

  /** @internal C-style function: set title */
  _taglib_tag_set_title?(tagPtr: number, titlePtr: number): void;
  /** @internal C-style function: set artist */
  _taglib_tag_set_artist?(tagPtr: number, artistPtr: number): void;
  /** @internal C-style function: set album */
  _taglib_tag_set_album?(tagPtr: number, albumPtr: number): void;
  /** @internal C-style function: set comment */
  _taglib_tag_set_comment?(tagPtr: number, commentPtr: number): void;
  /** @internal C-style function: set genre */
  _taglib_tag_set_genre?(tagPtr: number, genrePtr: number): void;
  /** @internal C-style function: set year */
  _taglib_tag_set_year?(tagPtr: number, year: number): void;
  /** @internal C-style function: set track */
  _taglib_tag_set_track?(tagPtr: number, track: number): void;

  /** @internal C-style function: get audio length in seconds */
  _taglib_audioproperties_length?(propsPtr: number): number;
  /** @internal C-style function: get bitrate in kbps */
  _taglib_audioproperties_bitrate?(propsPtr: number): number;
  /** @internal C-style function: get sample rate in Hz */
  _taglib_audioproperties_samplerate?(propsPtr: number): number;
  /** @internal C-style function: get number of channels */
  _taglib_audioproperties_channels?(propsPtr: number): number;
}

export interface WasmModule extends EmscriptenModule {
  // Alias for compatibility
  FileHandle?: new () => FileHandle;
  createFileHandle?(): FileHandle;
}

// Module loading function removed for modular imports
