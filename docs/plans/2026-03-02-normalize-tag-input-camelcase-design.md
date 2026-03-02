# Fix normalizeTagInput to Output camelCase Keys

## Problem

`normalizeTagInput()` in `src/utils/tag-mapping.ts` outputs mixed-case PropertyMap keys: basic fields (title, artist, etc.) use camelCase, but extended fields (albumArtist, discNumber, etc.) are translated to ALL_CAPS (ALBUMARTIST, DISCNUMBER). This violates the PropertyMap type contract, which defines keys as camelCase `PropertyKey` values.

The bug is a DX/consistency issue, not a data-loss bug. `setProperties()` calls `toTagLibKey()` on all keys before sending to C++, so ALL_CAPS keys pass through as identity — the data reaching TagLib is correct either way. But the PropertyMap surface area lies to the developer.

## Design

**Goal:** Make `normalizeTagInput` a pure value transformer that outputs consistent camelCase PropertyMap keys.

**Principle:** Key translation (camelCase to ALL_CAPS) happens in exactly one place: `setProperties`. `normalizeTagInput` only converts values (scalars to string arrays) and remaps two TagInput aliases (year to date, track to trackNumber).

### Value conversion table

| Input type     | Output                    | Example                           |
| -------------- | ------------------------- | --------------------------------- |
| `string`       | `string[]`                | `"Hello"` to `["Hello"]`          |
| `string[]`     | pass-through              | `["A","B"]` to `["A","B"]`        |
| `number`       | `string[]`                | `128` to `["128"]`                |
| `boolean`      | `string[]`                | `true` to `["1"]`                 |
| key `year`     | remapped to `date`        | Only key remap                    |
| key `track`    | remapped to `trackNumber` | Only key remap                    |
| all other keys | identity                  | `albumArtist` stays `albumArtist` |

### Changes

**1. Extended fields loop (core fix):** Remove `toTagLibKey(field)` call. Remove the `if (propKey === field) continue` guard that silently drops fields without PROPERTIES mappings. Use the input field name directly as the output key.

**2. Basic string fields loop (simplify):** Replace `TAG_FIELD_TO_PROPERTY[field]` lookup with `field` directly. For title, artist, album, comment, and genre, this lookup is identity.

**3. Dead code removal:** Remove `TAG_FIELD_TO_PROPERTY` constant (no longer used). Remove `toTagLibKey` from the import statement.

**4. Tests:** Update all `normalizeTagInput` test assertions from ALL_CAPS keys to camelCase keys.

### Pipeline after fix

```
normalizeTagInput:  value conversion + year/track alias  (camelCase in, camelCase out)
setProperties:      key translation                       (camelCase in, ALL_CAPS out)
```

### Inverse symmetry

After the fix, the two exported functions in tag-mapping.ts are clean inverses:

- `mapPropertiesToExtendedTag`: PropertyMap (camelCase, string arrays) to ExtendedTag (camelCase, typed values)
- `normalizeTagInput`: TagInput (camelCase, typed values) to PropertyMap (camelCase, string arrays)

### What doesn't change

- `setProperties` in audio-file-base.ts (still calls toTagLibKey on all keys)
- `mapPropertiesToExtendedTag` (already expects camelCase input)
- `mergeTagUpdates` (pipes normalizeTagInput output to setProperties, no key logic)
- The C++ layer (receives identical ALL_CAPS keys either way)
