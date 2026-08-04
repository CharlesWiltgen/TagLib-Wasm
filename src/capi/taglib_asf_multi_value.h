#ifndef TAGLIB_ASF_MULTI_VALUE_H
#define TAGLIB_ASF_MULTI_VALUE_H

#include <tfile.h>
#include <asffile.h>
#include <asftag.h>

namespace taglib_wasm {

/*!
 * RAII guard compensating TagLib 2.3.1's ASF multi-value attribute rotation.
 *
 * WHY. ASF::Tag holds multi-value attributes in order, but the file render
 * (asffile.cpp:565-583) splits each attribute: the FIRST value goes into the
 * Extended Content Description Object and the REST into the Metadata Library
 * Object. The header extension parses MLO before ECDO, so parse(render(L))
 * is a LEFT ROTATION by one: [A,B,C] reads back as [B,C,A]. Because the
 * split happens at RENDER time, even a no-op save flips the read order on
 * every write (parse followed by re-render is an involution), so a
 * compensation applied only at setProperties() was not idempotent.
 *
 * The guard right-rotates every multi-value attribute immediately before
 * file->save() renders the file, and restores the original lists afterwards,
 * so parse(render(rightRotate(L))) == L. That makes both fresh writes and
 * no-op saves round-trip in the caller's order and keeps the on-disk layout
 * stable across repeated saves.
 *
 * This is NOT a reversal: a naive reversal would be wrong for three or more
 * values ([A,B,C] would read back as [A,C,B]).
 *
 * Files written by other taggers keep reading exactly as TagLib merges them
 * (MLO first whenever MLO precedes ECDO) — the guard only stabilizes OUR
 * writes and saves. GUARD: tests/multi-value-tags.test.ts asserts exact-order
 * round-trips AND no-op-save stability for wma with 2 and 3 values on both
 * backends. If a TagLib bump ever fixes the render, those tests go red and
 * this guard must be DELETED, not adjusted (taglib-ilrg).
 */
class ASFMultiValueRotationGuard {
public:
    explicit ASFMultiValueRotationGuard(TagLib::File* file) : m_file(file)
    {
        auto* asf = dynamic_cast<TagLib::ASF::File*>(file);
        if (!asf) return;
        auto* tag = static_cast<TagLib::ASF::Tag*>(asf->tag());
        if (!tag) return;
        auto& map = tag->attributeListMap();
        for (auto& [name, attrs] : map) {
            if (attrs.size() < 2) continue;
            m_saved[name] = attrs;
            TagLib::ASF::Attribute last = attrs.back();
            TagLib::ASF::AttributeList rotated;
            rotated.append(last);
            for (unsigned int i = 0; i + 1 < attrs.size(); i++)
                rotated.append(attrs[i]);
            attrs = rotated;
        }
    }

    ~ASFMultiValueRotationGuard()
    {
        auto* asf = dynamic_cast<TagLib::ASF::File*>(m_file);
        if (!asf) return;
        auto* tag = static_cast<TagLib::ASF::Tag*>(asf->tag());
        if (!tag) return;
        auto& map = tag->attributeListMap();
        for (const auto& [name, attrs] : m_saved)
            map[name] = attrs;
    }

    ASFMultiValueRotationGuard(const ASFMultiValueRotationGuard&) = delete;
    ASFMultiValueRotationGuard& operator=(const ASFMultiValueRotationGuard&) =
        delete;

private:
    TagLib::File* m_file;
    TagLib::Map<TagLib::String, TagLib::ASF::AttributeList> m_saved;
};

} // namespace taglib_wasm

#endif // TAGLIB_ASF_MULTI_VALUE_H
