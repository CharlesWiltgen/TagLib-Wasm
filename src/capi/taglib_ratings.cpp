#include "taglib_ratings.h"

#include <tfile.h>
#include <tstring.h>
#include <tstringlist.h>
#include <mpack/mpack.h>

#include <mpeg/mpegfile.h>
#include <mpeg/id3v2/id3v2tag.h>
#include <mpeg/id3v2/frames/popularimeterframe.h>
#include <flac/flacfile.h>
#include <ogg/xiphcomment.h>
#include <ogg/vorbis/vorbisfile.h>
#include <ogg/opus/opusfile.h>
#include <mp4/mp4file.h>
#include <mp4/mp4tag.h>
#include <mp4/mp4item.h>

#include <cstring>
#include <cstdlib>
#include <cstdio>

static constexpr uint32_t MAX_RATING_ENTRIES = 16;

struct RatingEntry {
    double rating;   // 0.0-1.0 normalized
    char email[256];
    uint32_t counter;
};

static uint32_t collect_ratings(TagLib::File* file,
                                RatingEntry* entries, uint32_t max_entries)
{
    uint32_t count = 0;

    if (auto* f = dynamic_cast<TagLib::MPEG::File*>(file)) {
        if (f->hasID3v2Tag()) {
            TagLib::ID3v2::Tag* tag = f->ID3v2Tag();
            const auto& frames = tag->frameList("POPM");
            for (const auto& frame : frames) {
                if (count >= max_entries) break;
                auto* popm =
                    dynamic_cast<TagLib::ID3v2::PopularimeterFrame*>(frame);
                if (!popm) continue;
                entries[count].rating = popm->rating() / 255.0;
                std::string email = popm->email().to8Bit(true);
                strncpy(entries[count].email, email.c_str(), sizeof(entries[count].email) - 1);
                entries[count].email[sizeof(entries[count].email) - 1] = '\0';
                entries[count].counter = popm->counter();
                count++;
            }
        }
        return count;
    }

    // FLAC, OGG Vorbis, Opus all use XiphComment RATING field
    TagLib::Ogg::XiphComment* xiph = nullptr;

    if (auto* f = dynamic_cast<TagLib::FLAC::File*>(file)) {
        xiph = f->xiphComment();
    } else if (auto* f = dynamic_cast<TagLib::Ogg::Vorbis::File*>(file)) {
        xiph = f->tag();
    } else if (auto* f = dynamic_cast<TagLib::Ogg::Opus::File*>(file)) {
        xiph = f->tag();
    }

    if (xiph && xiph->contains("RATING")) {
        const auto& values = xiph->fieldListMap()["RATING"];
        for (const auto& val : values) {
            if (count >= max_entries) break;
            std::string s = val.to8Bit(true);
            double r = s.empty() ? 0.0 : std::strtod(s.c_str(), nullptr);
            if (r > 1.0) r = r / 100.0;  // handle 0-100 percentages
            if (r < 0.0) r = 0.0;
            if (r > 1.0) r = 1.0;
            entries[count].rating = r;
            entries[count].email[0] = '\0';
            entries[count].counter = 0;
            count++;
        }
        return count;
    }

    if (auto* f = dynamic_cast<TagLib::MP4::File*>(file)) {
        TagLib::MP4::Tag* tag = f->tag();
        if (tag && tag->contains("----:com.apple.iTunes:RATING")) {
            TagLib::MP4::Item item = tag->item("----:com.apple.iTunes:RATING");
            if (item.isValid() && count < max_entries) {
                double r = 0.0;
                if (item.type() == TagLib::MP4::Item::Type::Int) {
                    int v = item.toInt();
                    r = (v > 100) ? v / 255.0 : v / 100.0;
                } else if (item.type() == TagLib::MP4::Item::Type::StringList) {
                    TagLib::StringList sl = item.toStringList();
                    if (!sl.isEmpty()) {
                        r = std::strtod(sl.front().to8Bit(true).c_str(), nullptr);
                        if (r > 1.0) r = r / 100.0;
                    }
                }
                if (r < 0.0) r = 0.0;
                if (r > 1.0) r = 1.0;
                entries[count].rating = r;
                entries[count].email[0] = '\0';
                entries[count].counter = 0;
                count++;
            }
        }
        return count;
    }

    return count;
}

uint32_t count_ratings(TagLib::File* file) {
    RatingEntry entries[MAX_RATING_ENTRIES];
    return collect_ratings(file, entries, MAX_RATING_ENTRIES);
}

void encode_ratings(mpack_writer_t* writer, TagLib::File* file) {
    RatingEntry entries[MAX_RATING_ENTRIES];
    uint32_t count = collect_ratings(file, entries, MAX_RATING_ENTRIES);
    if (count == 0) return;

    mpack_write_cstr(writer, "ratings");
    mpack_start_array(writer, count);

    for (uint32_t i = 0; i < count; i++) {
        mpack_start_map(writer, 3);

        mpack_write_cstr(writer, "rating");
        mpack_write_double(writer, entries[i].rating);

        mpack_write_cstr(writer, "email");
        mpack_write_cstr(writer, entries[i].email);

        mpack_write_cstr(writer, "counter");
        mpack_write_uint(writer, entries[i].counter);

        mpack_finish_map(writer);
    }

    mpack_finish_array(writer);
}

static void apply_ratings_to_file(TagLib::File* file,
                                  const RatingEntry* entries, uint32_t count)
{
    if (auto* f = dynamic_cast<TagLib::MPEG::File*>(file)) {
        TagLib::ID3v2::Tag* tag = f->ID3v2Tag(true);
        tag->removeFrames("POPM");
        for (uint32_t i = 0; i < count; i++) {
            auto* popm = new TagLib::ID3v2::PopularimeterFrame();
            int popmRating = static_cast<int>(entries[i].rating * 255.0 + 0.5);
            if (popmRating < 0) popmRating = 0;
            if (popmRating > 255) popmRating = 255;
            popm->setRating(popmRating);
            if (entries[i].email[0] != '\0') {
                popm->setEmail(TagLib::String(entries[i].email, TagLib::String::UTF8));
            }
            popm->setCounter(entries[i].counter);
            tag->addFrame(popm);
        }
        return;
    }

    TagLib::Ogg::XiphComment* xiph = nullptr;
    if (auto* f = dynamic_cast<TagLib::FLAC::File*>(file)) {
        xiph = f->xiphComment(true);
    } else if (auto* f = dynamic_cast<TagLib::Ogg::Vorbis::File*>(file)) {
        xiph = f->tag();
    } else if (auto* f = dynamic_cast<TagLib::Ogg::Opus::File*>(file)) {
        xiph = f->tag();
    }

    if (xiph) {
        xiph->removeFields("RATING");
        for (uint32_t i = 0; i < count; i++) {
            char buf[32];
            snprintf(buf, sizeof(buf), "%.6g", entries[i].rating);
            xiph->addField("RATING",
                TagLib::String(buf, TagLib::String::UTF8), false);
        }
        return;
    }

    if (auto* f = dynamic_cast<TagLib::MP4::File*>(file)) {
        TagLib::MP4::Tag* tag = f->tag();
        if (!tag) return;
        tag->removeItem("----:com.apple.iTunes:RATING");
        // MP4 freeform atoms support only a single rating value
        if (count > 0) {
            char buf[32];
            snprintf(buf, sizeof(buf), "%.6g", entries[0].rating);
            TagLib::StringList sl;
            sl.append(TagLib::String(buf, TagLib::String::UTF8));
            tag->setItem("----:com.apple.iTunes:RATING", TagLib::MP4::Item(sl));
        }
    }
}

tl_error_code apply_ratings_from_msgpack(
    TagLib::File* file, const uint8_t* data, size_t len)
{
    mpack_reader_t reader;
    mpack_reader_init_data(&reader, reinterpret_cast<const char*>(data), len);

    uint32_t map_count = mpack_expect_map(&reader);
    if (mpack_reader_error(&reader) != mpack_ok) {
        mpack_reader_destroy(&reader);
        return TL_ERROR_PARSE_FAILED;
    }

    bool found = false;
    for (uint32_t i = 0; i < map_count; i++) {
        uint32_t klen = mpack_expect_str(&reader);
        if (mpack_reader_error(&reader) != mpack_ok) break;

        char key[256];
        if (klen >= sizeof(key)) {
            mpack_reader_destroy(&reader);
            return TL_ERROR_PARSE_FAILED;
        }
        mpack_read_bytes(&reader, key, klen);
        mpack_done_str(&reader);
        key[klen] = '\0';

        if (strcmp(key, "ratings") == 0) {
            found = true;
            mpack_tag_t tag = mpack_peek_tag(&reader);
            if (tag.type != mpack_type_array) {
                mpack_discard(&reader);
                continue;
            }

            uint32_t arr_count = mpack_expect_array(&reader);
            RatingEntry entries[MAX_RATING_ENTRIES];
            uint32_t parsed = 0;

            for (uint32_t j = 0; j < arr_count; j++) {
                uint32_t fields = mpack_expect_map(&reader);
                if (mpack_reader_error(&reader) != mpack_ok) break;

                RatingEntry entry = {0.0, "", 0};

                for (uint32_t k = 0; k < fields; k++) {
                    uint32_t fklen = mpack_expect_str(&reader);
                    if (mpack_reader_error(&reader) != mpack_ok) break;
                    char fkey[64];
                    if (fklen >= sizeof(fkey)) {
                        mpack_reader_destroy(&reader);
                        return TL_ERROR_PARSE_FAILED;
                    }
                    mpack_read_bytes(&reader, fkey, fklen);
                    mpack_done_str(&reader);
                    fkey[fklen] = '\0';

                    if (strcmp(fkey, "rating") == 0) {
                        mpack_tag_t vtag = mpack_peek_tag(&reader);
                        if (vtag.type == mpack_type_double) {
                            entry.rating = mpack_expect_double(&reader);
                        } else if (vtag.type == mpack_type_float) {
                            entry.rating = static_cast<double>(mpack_expect_float(&reader));
                        } else if (vtag.type == mpack_type_uint) {
                            entry.rating = static_cast<double>(mpack_expect_u64(&reader)) / 255.0;
                        } else if (vtag.type == mpack_type_int) {
                            entry.rating = static_cast<double>(mpack_expect_i64(&reader)) / 255.0;
                        } else {
                            mpack_discard(&reader);
                        }
                    } else if (strcmp(fkey, "email") == 0) {
                        uint32_t vlen = mpack_expect_str(&reader);
                        if (mpack_reader_error(&reader) != mpack_ok) break;
                        if (vlen < sizeof(entry.email)) {
                            mpack_read_bytes(&reader, entry.email, vlen);
                            entry.email[vlen] = '\0';
                        } else {
                            mpack_skip_bytes(&reader, vlen);
                            entry.email[0] = '\0';
                        }
                        mpack_done_str(&reader);
                    } else if (strcmp(fkey, "counter") == 0) {
                        entry.counter = static_cast<uint32_t>(mpack_expect_u64(&reader));
                    } else {
                        mpack_discard(&reader);
                    }
                }
                mpack_done_map(&reader);

                if (parsed < MAX_RATING_ENTRIES) {
                    entries[parsed++] = entry;
                }
            }
            mpack_done_array(&reader);

            apply_ratings_to_file(file, entries, parsed);
        } else {
            mpack_discard(&reader);
        }
    }

    mpack_done_map(&reader);
    mpack_error_t error = mpack_reader_destroy(&reader);

    if (!found) return TL_SUCCESS;
    return (error == mpack_ok) ? TL_SUCCESS : TL_ERROR_PARSE_FAILED;
}
