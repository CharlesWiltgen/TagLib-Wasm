#include "taglib_chapters.h"

#include <tfile.h>
#include <tstring.h>
#include <tbytevector.h>
#include <mpack/mpack.h>

#include <mpeg/mpegfile.h>
#include <mpeg/id3v2/id3v2tag.h>
#include <mpeg/id3v2/frames/chapterframe.h>
#include <mpeg/id3v2/frames/textidentificationframe.h>
#include <mp4/mp4file.h>
#include <mp4/mp4chapter.h>

#include <cstring>
#include <cstdlib>
#include <string>
#include <vector>

static TagLib::ID3v2::Tag* get_id3v2_tag(TagLib::File* file) {
    auto* mpeg = dynamic_cast<TagLib::MPEG::File*>(file);
    if (!mpeg) return nullptr;
    return mpeg->ID3v2Tag();
}

namespace {

struct Mp4Chapters {
    TagLib::MP4::ChapterList list;
    const char* source;
};

// QuickTime track wins; Nero chpl is the fallback. Empty list => no chapters.
Mp4Chapters pick_mp4_chapters(TagLib::MP4::File* mp4) {
    TagLib::MP4::ChapterList qt = mp4->qtChapters();
    if (!qt.isEmpty()) return {qt, "quicktime"};
    TagLib::MP4::ChapterList nero = mp4->neroChapters();
    if (!nero.isEmpty()) return {nero, "nero"};
    return {TagLib::MP4::ChapterList(), ""};
}

void write_str_field(mpack_writer_t* w, const char* key, const TagLib::String& v) {
    std::string utf8 = v.to8Bit(true);
    mpack_write_cstr(w, key);
    mpack_write_str(w, utf8.c_str(), static_cast<uint32_t>(utf8.size()));
}

uint32_t count_id3_chapters(TagLib::ID3v2::Tag* tag) {
    uint32_t count = 0;
    for (const auto* frame : tag->frameList("CHAP"))
        if (dynamic_cast<const TagLib::ID3v2::ChapterFrame*>(frame)) count++;
    return count;
}

void encode_id3_chapters(mpack_writer_t* writer, TagLib::ID3v2::Tag* tag) {
    auto chaps = tag->frameList("CHAP");
    uint32_t valid = count_id3_chapters(tag);
    if (valid == 0) return;

    mpack_write_cstr(writer, "chapters");
    mpack_start_array(writer, valid);
    for (const auto* frame : chaps) {
        auto* chap = dynamic_cast<const TagLib::ID3v2::ChapterFrame*>(frame);
        if (!chap) continue;

        TagLib::String title;
        auto embedded = chap->embeddedFrameList("TIT2");
        if (!embedded.isEmpty()) {
            auto* tit2 = dynamic_cast<const TagLib::ID3v2::TextIdentificationFrame*>(
                embedded.front());
            if (tit2) title = tit2->toString();
        }

        uint32_t fields = title.isEmpty() ? 4 : 5; // id, startTimeMs, endTimeMs, source[, title]
        mpack_start_map(writer, fields);
        TagLib::ByteVector eid = chap->elementID();
        mpack_write_cstr(writer, "id");
        mpack_write_str(writer, eid.data(), static_cast<uint32_t>(eid.size()));
        mpack_write_cstr(writer, "startTimeMs");
        mpack_write_uint(writer, chap->startTime());
        mpack_write_cstr(writer, "endTimeMs");
        mpack_write_uint(writer, chap->endTime());
        mpack_write_cstr(writer, "source");
        mpack_write_cstr(writer, "id3");
        if (!title.isEmpty()) write_str_field(writer, "title", title);
        mpack_finish_map(writer);
    }
    mpack_finish_array(writer);
}

void encode_mp4_chapters(mpack_writer_t* writer, TagLib::MP4::File* mp4) {
    Mp4Chapters picked = pick_mp4_chapters(mp4);
    if (picked.list.isEmpty()) return;

    mpack_write_cstr(writer, "chapters");
    mpack_start_array(writer, static_cast<uint32_t>(picked.list.size()));
    for (const auto& ch : picked.list) {
        const TagLib::String t = ch.title();
        uint32_t fields = t.isEmpty() ? 2 : 3; // startTimeMs, source[, title]
        mpack_start_map(writer, fields);
        mpack_write_cstr(writer, "startTimeMs");
        mpack_write_uint(writer, static_cast<uint64_t>(ch.startTime() < 0 ? 0 : ch.startTime()));
        mpack_write_cstr(writer, "source");
        mpack_write_cstr(writer, picked.source);
        if (!t.isEmpty()) write_str_field(writer, "title", t);
        mpack_finish_map(writer);
    }
    mpack_finish_array(writer);
}

struct ChapterEntry {
    std::string id;
    unsigned int startTimeMs = 0;
    unsigned int endTimeMs = 0;
    TagLib::String title;
};

enum class Mp4Style { QuickTime, Nero, Both };

Mp4Style parse_mp4_style(const char* s) {
    if (s && strcmp(s, "nero") == 0) return Mp4Style::Nero;
    if (s && strcmp(s, "both") == 0) return Mp4Style::Both;
    return Mp4Style::QuickTime;
}

char* read_owned_str(mpack_reader_t* reader, uint32_t* out_len) {
    uint32_t vlen = mpack_expect_str(reader);
    char* buf = static_cast<char*>(malloc(vlen + 1));
    if (!buf) return nullptr;
    mpack_read_bytes(reader, buf, vlen);
    mpack_done_str(reader);
    buf[vlen] = '\0';
    if (out_len) *out_len = vlen;
    return buf;
}

bool read_chapter_entry(mpack_reader_t* reader, ChapterEntry* entry) {
    uint32_t entry_fields = mpack_expect_map(reader);
    if (mpack_reader_error(reader) != mpack_ok) return false;
    for (uint32_t k = 0; k < entry_fields; k++) {
        uint32_t fklen = mpack_expect_str(reader);
        if (mpack_reader_error(reader) != mpack_ok) return false;
        char fkey[64];
        if (fklen >= sizeof(fkey)) return false;
        mpack_read_bytes(reader, fkey, fklen);
        mpack_done_str(reader);
        fkey[fklen] = '\0';

        if (strcmp(fkey, "id") == 0) {
            uint32_t vlen = 0;
            char* v = read_owned_str(reader, &vlen);
            if (!v) return false;
            entry->id.assign(v, vlen);
            free(v);
        } else if (strcmp(fkey, "startTimeMs") == 0) {
            entry->startTimeMs = static_cast<unsigned int>(mpack_expect_u64(reader));
        } else if (strcmp(fkey, "endTimeMs") == 0) {
            entry->endTimeMs = static_cast<unsigned int>(mpack_expect_u64(reader));
        } else if (strcmp(fkey, "title") == 0) {
            char* v = read_owned_str(reader, nullptr);
            if (!v) return false;
            entry->title = TagLib::String(v, TagLib::String::UTF8);
            free(v);
        } else {
            mpack_discard(reader);
        }
    }
    mpack_done_map(reader);
    return mpack_reader_error(reader) == mpack_ok;
}

void write_id3_chapters(TagLib::ID3v2::Tag* tag, const std::vector<ChapterEntry>& entries) {
    tag->removeFrames("CHAP");
    uint32_t j = 0;
    for (const auto& e : entries) {
        TagLib::ByteVector elementId = e.id.empty()
            ? TagLib::ByteVector(("chap" + std::to_string(j)).c_str())
            : TagLib::ByteVector(e.id.c_str(), static_cast<unsigned int>(e.id.size()));
        TagLib::ID3v2::FrameList embedded;
        if (!e.title.isEmpty()) {
            auto* tit2 = new TagLib::ID3v2::TextIdentificationFrame("TIT2");
            tit2->setText(e.title);
            embedded.append(tit2);
        }
        tag->addFrame(new TagLib::ID3v2::ChapterFrame(
            elementId, e.startTimeMs, e.endTimeMs, 0xFFFFFFFF, 0xFFFFFFFF, embedded));
        j++;
    }
}

void write_mp4_chapters(TagLib::MP4::File* mp4,
                        const std::vector<ChapterEntry>& entries, Mp4Style style) {
    TagLib::MP4::ChapterList list;
    for (const auto& e : entries)
        list.append(TagLib::MP4::Chapter(e.title, static_cast<long long>(e.startTimeMs)));

    const bool wantQt = (style == Mp4Style::QuickTime || style == Mp4Style::Both);
    const bool wantNero = (style == Mp4Style::Nero || style == Mp4Style::Both);

    mp4->setQtChapters(wantQt ? list : TagLib::MP4::ChapterList());

    if (!wantNero) {
        mp4->setNeroChapters(TagLib::MP4::ChapterList());
    } else if (list.size() > 255) {
        TagLib::MP4::ChapterList capped;
        for (unsigned int i = 0; i < 255; ++i) capped.append(list[i]);
        mp4->setNeroChapters(capped);
    } else {
        mp4->setNeroChapters(list);
    }
}

} // namespace

uint32_t count_chapters(TagLib::File* file) {
    if (auto* tag = get_id3v2_tag(file)) return count_id3_chapters(tag);
    if (auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file))
        return static_cast<uint32_t>(pick_mp4_chapters(mp4).list.size());
    return 0;
}

void encode_chapters(mpack_writer_t* writer, TagLib::File* file) {
    if (auto* tag = get_id3v2_tag(file)) { encode_id3_chapters(writer, tag); return; }
    if (auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file)) encode_mp4_chapters(writer, mp4);
}

tl_error_code apply_chapters_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len)
{
    auto* id3 = get_id3v2_tag(file);
    auto* mp4 = dynamic_cast<TagLib::MP4::File*>(file);
    if (!id3 && !mp4) return TL_SUCCESS; // Other formats: silently skip.

    mpack_reader_t reader;
    mpack_reader_init_data(&reader, reinterpret_cast<const char*>(data), len);
    uint32_t map_count = mpack_expect_map(&reader);
    if (mpack_reader_error(&reader) != mpack_ok) {
        mpack_reader_destroy(&reader);
        return TL_ERROR_PARSE_FAILED;
    }

    bool found = false;
    Mp4Style style = Mp4Style::QuickTime;
    std::vector<ChapterEntry> entries;
    for (uint32_t i = 0; i < map_count; i++) {
        uint32_t klen = mpack_expect_str(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) break;
        char key[256];
        if (klen >= sizeof(key)) { mpack_reader_destroy(&reader); return TL_ERROR_PARSE_FAILED; }
        mpack_read_bytes(&reader, key, klen);
        mpack_done_str(&reader);
        key[klen] = '\0';

        if (strcmp(key, "_mp4ChapterStyle") == 0) {
            char sbuf[16];
            uint32_t slen = mpack_expect_str_buf(&reader, sbuf, sizeof(sbuf) - 1);
            sbuf[slen < sizeof(sbuf) ? slen : sizeof(sbuf) - 1] = '\0';
            style = parse_mp4_style(sbuf);
        } else if (strcmp(key, "chapters") == 0) {
            if (mpack_peek_tag(&reader).type != mpack_type_array) { mpack_discard(&reader); continue; }
            found = true;
            uint32_t arr_count = mpack_expect_array(&reader);
            for (uint32_t j = 0; j < arr_count; j++) {
                ChapterEntry e;
                if (!read_chapter_entry(&reader, &e)) break;
                entries.push_back(std::move(e));
            }
            mpack_done_array(&reader);
        } else {
            mpack_discard(&reader);
        }
    }
    mpack_done_map(&reader);
    mpack_error_t error = mpack_reader_destroy(&reader);
    if (!found) return TL_SUCCESS;
    if (error != mpack_ok) return TL_ERROR_PARSE_FAILED;

    if (id3) write_id3_chapters(id3, entries);
    else if (mp4) write_mp4_chapters(mp4, entries, style);
    return TL_SUCCESS;
}
