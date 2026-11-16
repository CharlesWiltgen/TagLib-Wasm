/**
 * @fileoverview IOStream backed by std::vector<char> instead of ByteVector.
 *
 * ByteVectorStream::readBlock() uses ByteVector::mid(), which creates
 * copy-on-write slices. Metadata blocks parsed during file loading hold those
 * shared references, so when save() calls insert() -> truncate() -> resize() ->
 * detach(), the stream must deep-copy the entire file buffer.
 *
 * VectorStream::readBlock() constructs ByteVectors from raw pointers instead,
 * producing independent copies of only the small metadata blocks. Extracted
 * from build/taglib_embind.cpp so both backends use the same stream
 * (taglib-d3c).
 */
#pragma once

#include <algorithm>
#include <cstring>
#include <vector>

#include <taglib.h>
#include <tbytevector.h>
#include <tfile.h>
#include <tiostream.h>

namespace taglib_wasm {

class VectorStream : public TagLib::IOStream {
public:
    VectorStream(const char* data, unsigned int length)
        : buf_(data, data + length), position_(0) {}

    VectorStream(std::vector<char>&& data)
        : buf_(std::move(data)), position_(0) {}

    TagLib::FileName name() const override { return ""; }

    TagLib::ByteVector readBlock(size_t length) override {
        if (length == 0 || position_ < 0 ||
            position_ >= static_cast<TagLib::offset_t>(buf_.size()))
            return TagLib::ByteVector();

        size_t avail = buf_.size() - static_cast<size_t>(position_);
        size_t toRead = std::min(length, avail);
        TagLib::ByteVector v(buf_.data() + position_,
                             static_cast<unsigned int>(toRead));
        position_ += static_cast<TagLib::offset_t>(toRead);
        return v;
    }

    void writeBlock(const TagLib::ByteVector& data) override {
        if (position_ < 0)
            return;
        size_t end = static_cast<size_t>(position_) + data.size();
        if (end > buf_.size())
            buf_.resize(end);
        std::memcpy(buf_.data() + position_, data.data(), data.size());
        position_ += data.size();
    }

    void insert(const TagLib::ByteVector& data,
                TagLib::offset_t start = 0, size_t replace = 0) override {
        long long sizeDiff = static_cast<long long>(data.size()) -
                             static_cast<long long>(replace);
        if (sizeDiff < 0) {
            removeBlock(start + data.size(),
                        static_cast<size_t>(-sizeDiff));
        } else if (sizeDiff > 0) {
            size_t oldSize = buf_.size();
            buf_.resize(oldSize + static_cast<size_t>(sizeDiff));
            size_t readPos = static_cast<size_t>(start) + replace;
            size_t writePos = static_cast<size_t>(start) + data.size();
            if (readPos < oldSize) {
                std::memmove(buf_.data() + writePos, buf_.data() + readPos,
                             oldSize - readPos);
            }
        }
        seek(start);
        writeBlock(data);
    }

    void removeBlock(TagLib::offset_t start = 0, size_t length = 0) override {
        size_t readPos = static_cast<size_t>(start) + length;
        size_t writePos = static_cast<size_t>(start);
        if (readPos < buf_.size()) {
            size_t toMove = buf_.size() - readPos;
            std::memmove(buf_.data() + writePos, buf_.data() + readPos, toMove);
            writePos += toMove;
        }
        position_ = static_cast<TagLib::offset_t>(writePos);
        buf_.resize(writePos);
    }

    bool readOnly() const override { return false; }
    bool isOpen() const override { return true; }

    void seek(TagLib::offset_t offset, Position p = Beginning) override {
        switch (p) {
        case Beginning: position_ = offset; break;
        case Current:   position_ += offset; break;
        case End:       position_ = static_cast<TagLib::offset_t>(buf_.size()) + offset; break;
        }
    }

    void clear() override {}

    TagLib::offset_t tell() const override { return position_; }
    TagLib::offset_t length() override {
        return static_cast<TagLib::offset_t>(buf_.size());
    }

    void truncate(TagLib::offset_t length) override {
        buf_.resize(static_cast<size_t>(length));
    }

    const char* bufData() const { return buf_.data(); }
    size_t bufSize() const { return buf_.size(); }

private:
    std::vector<char> buf_;
    TagLib::offset_t position_;
};

} // namespace taglib_wasm
