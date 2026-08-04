#ifndef TAGLIB_ASF_PROPERTIES_H
#define TAGLIB_ASF_PROPERTIES_H

#include <tfile.h>
#include <tpropertymap.h>
#include <asffile.h>
#include <asftag.h>
#include <asfattribute.h>

namespace taglib_wasm {

/*!
 * Tag-based variant of merge_asf_unsupported_properties, for callers that
 * hold the ASF::Tag but not the File (the embind TagWrapper).
 */
inline void merge_asf_unsupported_properties_into(
    TagLib::ASF::Tag* tag, TagLib::PropertyMap& props)
{
    if (!tag) return;
    for (const auto& name : props.unsupportedData()) {
        if (!tag->contains(name)) continue;
        // A raw attribute whose name collides with a canonical property key
        // (the fixture's raw "title" attribute vs the CDO TITLE) must not
        // override it on the JS surface, where both remap to the same field
        // (taglib-984r regression on minimal writes).
        if (props.contains(name.upper())) continue;
        const auto attrs = tag->attribute(name);
        if (attrs.isEmpty()) continue;
        TagLib::StringList values;
        for (const auto& attr : attrs) values.append(attr.toString());
        props[name] = values;
    }
}

/*!
 * Report untranslated ASF attributes on read (taglib-984r).
 *
 * ASF::Tag::properties() emits translated attributes (WM/Genre -> GENRE,
 * ...) and puts everything else in the map's unsupportedData() — which never
 * crossed the wire, so a WMA carrying ReplayGain/ITUNESADVISORY/R128 read as
 * if those attributes did not exist. The ASF format itself has no constraint
 * on attribute names, so unsupported names are surfaced verbatim here, using
 * TagLib's own classification (no duplicated translation table).
 */
inline void merge_asf_unsupported_properties(
    TagLib::File* file, TagLib::PropertyMap& props)
{
    auto* asf = dynamic_cast<TagLib::ASF::File*>(file);
    if (!asf) return;
    merge_asf_unsupported_properties_into(
        static_cast<TagLib::ASF::Tag*>(asf->tag()), props);
}

/*!
 * Apply untranslated property keys to an ASF file on write (taglib-984r).
 *
 * ASF::Tag::setProperties returns keys it cannot translate as ignoredProps
 * (asftag.cpp:394) — never written, so setProperty("replayGainTrackGain",
 * ...) on a WMA silently persisted nothing. TagLib's ignored return IS the
 * classification; write those keys directly through the tag's attribute API.
 *
 * The incoming map is the COMPLETE desired state, matching how the erase
 * loop treats translated keys (absent = remove, asftag.cpp:351-370): an
 * unknown attribute present in the file but absent-or-empty in the incoming
 * map is removed. This is what makes setProperties({ key: [] }) clear an
 * unknown attribute on WASI, whose decoder drops empty arrays before
 * setProperties ever sees them.
 *
 * Call AFTER file->setProperties(), on every backend's write path.
 */
inline void apply_asf_properties(
    TagLib::File* file,
    const TagLib::PropertyMap& incoming,
    const TagLib::PropertyMap& ignored)
{
    auto* asf = dynamic_cast<TagLib::ASF::File*>(file);
    if (!asf) return;
    auto* tag = static_cast<TagLib::ASF::Tag*>(asf->tag());
    if (!tag) return;

    // Removals: unknown attributes in the file, absent or emptied in the
    // incoming map. (Translated keys are handled by TagLib's own erase loop.)
    TagLib::PropertyMap fileProps = file->properties();
        
    for (const auto& name : fileProps.unsupportedData()) {
        if (!tag->contains(name)) continue;
        const auto it = incoming.find(name);
        if (it != incoming.end() && !it->second.isEmpty()) continue;
        
        tag->removeItem(name);
    }

    // Writes: ignored (untranslated) incoming keys become real attributes.
    for (const auto& [key, values] : ignored) {
        if (values.isEmpty()) {
            tag->removeItem(key);
            continue;
        }
        TagLib::ASF::AttributeList list;
        for (const auto& value : values) {
            list.append(TagLib::ASF::Attribute(value));
        }
        tag->setAttribute(key, list);
    }
}

} // namespace taglib_wasm

#endif // TAGLIB_ASF_PROPERTIES_H
