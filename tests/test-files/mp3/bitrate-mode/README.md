# Bitrate-mode test fixtures

Tiny MP3 fixtures (~5–25 KB each) for `tests/bitrate-mode.test.ts`. Four were encoded from a 1-second 440 Hz sine source; the VBRI fixture comes from the TagLib test corpus.

## Encoder versions

`LAME 64bits version 3.100 (http://lame.sf.net)`

## Source for LAME-encoded fixtures

```bash
sox -n -r 44100 -c 2 source.wav synth 1 sine 440 vol 0.1
```

## Generation

| File           | Command                                       | Expected `bitrateMode` |
| -------------- | --------------------------------------------- | ---------------------- |
| `cbr-lame.mp3` | `lame -b 128 --cbr source.wav cbr-lame.mp3`   | `"CBR"`                |
| `vbr-lame.mp3` | `lame -V 2 source.wav vbr-lame.mp3`           | `"VBR"`                |
| `abr-lame.mp3` | `lame --abr 192 source.wav abr-lame.mp3`      | `"ABR"`                |
| `vbri.mp3`     | (see VBRI provenance below)                   | `"VBR"`                |
| `no-xing.mp3`  | `lame -b 128 --cbr -t source.wav no-xing.mp3` | `undefined`            |

The `-t` flag for `no-xing.mp3` suppresses Xing/Info header insertion, so the parser cannot determine bitrate mode and reports `undefined`.

## VBRI fixture provenance

`vbri.mp3` is `lib/taglib/tests/data/rare_frames.mp3` from the TagLib test corpus (LGPL-2.1). The `lame` encoder does not produce VBRI headers; VBRI is a Fraunhofer-encoder construct. Re-distributing this fixture is consistent with the LGPL of the upstream library.

## Regenerating

To regenerate from scratch on macOS:

```bash
brew install lame sox
cd tests/test-files/mp3/bitrate-mode
sox -n -r 44100 -c 2 source.wav synth 1 sine 440 vol 0.1
lame -b 128 --cbr source.wav cbr-lame.mp3
lame -V 2 source.wav vbr-lame.mp3
lame --abr 192 source.wav abr-lame.mp3
lame -b 128 --cbr -t source.wav no-xing.mp3
cp ../../../../lib/taglib/tests/data/rare_frames.mp3 vbri.mp3
rm source.wav
```
