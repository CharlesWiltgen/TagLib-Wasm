import { BaseAudioFileImpl } from "./audio-file-base.ts";

/**
 * Adds extended metadata convenience methods to the base implementation.
 * @internal Not exported from the public API.
 */
export abstract class ExtendedAudioFileImpl extends BaseAudioFileImpl {
  getMusicBrainzTrackId(): string | undefined {
    return this.getProperty("MUSICBRAINZ_TRACKID") ?? undefined;
  }

  setMusicBrainzTrackId(id: string): void {
    this.setProperty("MUSICBRAINZ_TRACKID", id);
  }

  getMusicBrainzReleaseId(): string | undefined {
    return this.getProperty("MUSICBRAINZ_ALBUMID") ?? undefined;
  }

  setMusicBrainzReleaseId(id: string): void {
    this.setProperty("MUSICBRAINZ_ALBUMID", id);
  }

  getMusicBrainzArtistId(): string | undefined {
    return this.getProperty("MUSICBRAINZ_ARTISTID") ?? undefined;
  }

  setMusicBrainzArtistId(id: string): void {
    this.setProperty("MUSICBRAINZ_ARTISTID", id);
  }

  getAcoustIdFingerprint(): string | undefined {
    return this.getProperty("ACOUSTID_FINGERPRINT") ?? undefined;
  }

  setAcoustIdFingerprint(fingerprint: string): void {
    this.setProperty("ACOUSTID_FINGERPRINT", fingerprint);
  }

  getAcoustIdId(): string | undefined {
    return this.getProperty("ACOUSTID_ID") ?? undefined;
  }

  setAcoustIdId(id: string): void {
    this.setProperty("ACOUSTID_ID", id);
  }

  getReplayGainTrackGain(): string | undefined {
    return this.getProperty("REPLAYGAIN_TRACK_GAIN") ?? undefined;
  }

  setReplayGainTrackGain(gain: string): void {
    this.setProperty("REPLAYGAIN_TRACK_GAIN", gain);
  }

  getReplayGainTrackPeak(): string | undefined {
    return this.getProperty("REPLAYGAIN_TRACK_PEAK") ?? undefined;
  }

  setReplayGainTrackPeak(peak: string): void {
    this.setProperty("REPLAYGAIN_TRACK_PEAK", peak);
  }

  getReplayGainAlbumGain(): string | undefined {
    return this.getProperty("REPLAYGAIN_ALBUM_GAIN") ?? undefined;
  }

  setReplayGainAlbumGain(gain: string): void {
    this.setProperty("REPLAYGAIN_ALBUM_GAIN", gain);
  }

  getReplayGainAlbumPeak(): string | undefined {
    return this.getProperty("REPLAYGAIN_ALBUM_PEAK") ?? undefined;
  }

  setReplayGainAlbumPeak(peak: string): void {
    this.setProperty("REPLAYGAIN_ALBUM_PEAK", peak);
  }

  getAppleSoundCheck(): string | undefined {
    if (this.isMP4()) {
      return this.getMP4Item("iTunNORM");
    }
    return this.getProperty("ITUNESOUNDCHECK") ?? undefined;
  }

  setAppleSoundCheck(data: string): void {
    if (this.isMP4()) {
      this.setMP4Item("iTunNORM", data);
    } else {
      this.setProperty("ITUNESOUNDCHECK", data);
    }
  }
}
