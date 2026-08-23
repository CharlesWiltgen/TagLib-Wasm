/** WASI-based FileHandle implementation (taglib-1dfc split). */

import type {
  FileHandle,
  RawChapter,
  RawId3v2Frame,
  RawLyrics,
  RawPicture,
} from "../../wasm.ts";
import type { BasicTagData } from "../../types/tags.ts";
import type { AudioProperties } from "../../types.ts";
import type { WasiModule } from "../wasmer-sdk-loader/types.ts";
import { WasmerExecutionError } from "../wasmer-sdk-loader/types.ts";
import {
  createHandleState,
  destroy,
  getBuffer,
  type HandleState,
  isValid,
  loadBuffer,
  loadPath,
  save,
} from "./handle-state.ts";
import * as audio from "./audio-properties.ts";
import * as props from "./property-surface.ts";
import * as mp4 from "./mp4-items.ts";
import * as fields from "./structured-fields.ts";

export class WasiFileHandle implements FileHandle {
  private readonly state: HandleState;
  private destroyed = false;

  constructor(wasiModule: WasiModule) {
    this.state = createHandleState(wasiModule);
  }

  private checkNotDestroyed(): void {
    if (this.destroyed) {
      throw new WasmerExecutionError("FileHandle has been destroyed");
    }
  }

  loadFromBuffer(buffer: Uint8Array): boolean {
    this.checkNotDestroyed();
    loadBuffer(this.state, buffer);
    return true;
  }

  loadFromPath(path: string): boolean {
    this.checkNotDestroyed();
    loadPath(this.state, path);
    return true;
  }

  isValid(): boolean {
    this.checkNotDestroyed();
    return isValid(this.state);
  }

  save(): boolean {
    this.checkNotDestroyed();
    return save(this.state);
  }

  getBuffer(): Uint8Array {
    this.checkNotDestroyed();
    return getBuffer(this.state);
  }

  getTagData(): BasicTagData {
    this.checkNotDestroyed();
    return props.getBasicTagData(this.state.tagData);
  }

  setTagData(data: Partial<BasicTagData>): void {
    this.checkNotDestroyed();
    this.state.tagData = props.setBasicTagData(this.state.tagData, data);
  }

  getAudioProperties(): AudioProperties | null {
    this.checkNotDestroyed();
    return audio.getAudioProperties(this.state.tagData);
  }

  getFormat(): string {
    this.checkNotDestroyed();
    return audio.getFormat(this.state.tagData, this.state.fileData);
  }

  isMP4(): boolean {
    this.checkNotDestroyed();
    return audio.isMP4(this.state.tagData, this.state.fileData);
  }

  getProperties(): Record<string, string[]> {
    this.checkNotDestroyed();
    return props.getProperties(this.state.tagData);
  }

  setProperties(properties: Record<string, string[]>): void {
    this.checkNotDestroyed();
    this.state.tagData = props.setProperties(this.state.tagData, properties);
  }

  getProperty(key: string): string {
    this.checkNotDestroyed();
    return props.getProperty(this.state.tagData, key);
  }

  setProperty(key: string, value: string): void {
    this.checkNotDestroyed();
    this.state.tagData = props.setProperty(this.state.tagData, key, value);
  }

  getMP4Item(key: string): string {
    this.checkNotDestroyed();
    return mp4.getMP4Item(this.state.tagData, key);
  }

  setMP4Item(key: string, value: string): void {
    this.checkNotDestroyed();
    this.state.tagData = mp4.setMP4Item(this.state.tagData, key, value);
  }

  getMp4ItemRemovals(): string[] | undefined {
    this.checkNotDestroyed();
    return mp4.getMp4ItemRemovals(this.state.tagData);
  }

  setMp4ItemRemovals(removals: string[]): void {
    this.checkNotDestroyed();
    this.state.tagData = mp4.setMp4ItemRemovals(this.state.tagData, removals);
  }

  removeMP4Item(key: string): void {
    this.checkNotDestroyed();
    this.state.tagData = mp4.removeMP4Item(this.state.tagData, key);
  }

  getPictures(): RawPicture[] {
    this.checkNotDestroyed();
    return fields.getPictures(this.state.tagData);
  }

  setPictures(pictures: RawPicture[]): void {
    this.checkNotDestroyed();
    this.state.tagData = fields.setPictures(this.state.tagData, pictures);
  }

  addPicture(picture: RawPicture): void {
    this.checkNotDestroyed();
    this.state.tagData = fields.addPicture(this.state.tagData, picture);
  }

  removePictures(): void {
    this.checkNotDestroyed();
    this.state.tagData = fields.removePictures(this.state.tagData);
  }

  getChapters(): RawChapter[] {
    this.checkNotDestroyed();
    return fields.getChapters(this.state.tagData);
  }

  setChapters(chapters: RawChapter[], mp4ChapterStyle: string): void {
    this.checkNotDestroyed();
    this.state.tagData = fields.setChapters(
      this.state.tagData,
      chapters,
      mp4ChapterStyle,
    );
  }

  getBextData(): Uint8Array | undefined {
    this.checkNotDestroyed();
    return fields.getBextData(this.state.tagData);
  }

  setBextData(data: Uint8Array | null): void {
    this.checkNotDestroyed();
    this.state.tagData = fields.setBextData(this.state.tagData, data);
  }

  getIxml(): string | undefined {
    this.checkNotDestroyed();
    return fields.getIxml(this.state.tagData);
  }

  setIxml(data: string | null): void {
    this.checkNotDestroyed();
    this.state.tagData = fields.setIxml(this.state.tagData, data);
  }

  hasId3Tags(): { v1: boolean; v2: boolean } {
    this.checkNotDestroyed();
    return fields.hasId3Tags(this.state.tagData);
  }

  stripId3Tags(opts: { v1: boolean; v2: boolean }): void {
    this.checkNotDestroyed();
    this.state.tagData = fields.stripId3Tags(this.state.tagData, opts);
  }

  getRatings(): { rating: number; email: string; counter: number }[] {
    this.checkNotDestroyed();
    return fields.getRatings(this.state.tagData);
  }

  setRatings(
    ratings: { rating: number; email?: string; counter?: number }[],
  ): void {
    this.checkNotDestroyed();
    this.state.tagData = fields.setRatings(this.state.tagData, ratings);
  }

  getLyrics(): RawLyrics[] {
    this.checkNotDestroyed();
    return fields.getLyrics(this.state.tagData);
  }

  setLyrics(lyrics: RawLyrics[]): void {
    this.checkNotDestroyed();
    this.state.tagData = fields.setLyrics(this.state.tagData, lyrics);
  }

  getId3v2Frames(id: string): RawId3v2Frame[] {
    this.checkNotDestroyed();
    return fields.getId3v2Frames(this.state, id);
  }

  setId3v2Frames(id: string, data: Uint8Array[]): void {
    this.checkNotDestroyed();
    this.state.tagData = fields.setId3v2Frames(this.state.tagData, id, data);
  }

  removeId3v2Frames(id: string): void {
    this.checkNotDestroyed();
    this.state.tagData = fields.removeId3v2Frames(this.state.tagData, id);
  }

  getStagedId3v2Frames(): Record<string, Uint8Array[]> | undefined {
    return fields.getStagedId3v2Frames(this.state.tagData);
  }

  destroy(): void {
    destroy(this.state);
    this.destroyed = true;
  }
}
