#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <fileref.h>
#include <tag.h>
#include <audioproperties.h>
#include <tpropertymap.h>
#include <tbytevector.h>
#include <tiostream.h>
#include <mpegfile.h>
#include <mpegproperties.h>
#include <mp4file.h>
#include <mp4tag.h>
#include <mp4item.h>
#include <mp4coverart.h>
#include <mp4properties.h>
#include <flacfile.h>
#include <flacpicture.h>
#include <flacproperties.h>
#include <vorbisfile.h>
#include <vorbisproperties.h>
#include <opusfile.h>
#include <opusproperties.h>
#include <wavfile.h>
#include <wavproperties.h>
#include <aifffile.h>
#include <aiffproperties.h>
#include <wavpackfile.h>
#include <wavpackproperties.h>
#include <trueaudiofile.h>
#include <trueaudioproperties.h>
#include <asffile.h>
#include <asfproperties.h>
#include <matroskafile.h>
#include <id3v2tag.h>
#include <attachedpictureframe.h>
#include <popularimeterframe.h>
#include <xiphcomment.h>
#include <memory>
#include <string>
#include <vector>

using namespace emscripten;

// Forward declarations
class TagWrapper;
class AudioPropertiesWrapper;

// Wrapper classes for Tag and AudioProperties that ensure proper lifetime management
class TagWrapper {
private:
    TagLib::Tag* tag;
    
public:
    TagWrapper() : tag(nullptr) {}
    TagWrapper(TagLib::Tag* t) : tag(t) {}
    
    std::string title() const {
        return tag ? tag->title().toCString(true) : "";
    }
    
    std::string artist() const {
        return tag ? tag->artist().toCString(true) : "";
    }
    
    std::string album() const {
        return tag ? tag->album().toCString(true) : "";
    }
    
    std::string comment() const {
        return tag ? tag->comment().toCString(true) : "";
    }
    
    std::string genre() const {
        return tag ? tag->genre().toCString(true) : "";
    }
    
    unsigned int year() const {
        if (!tag) return 0;
        unsigned int y = tag->year();
        if (y != 0) return y;
        TagLib::PropertyMap props = tag->properties();
        auto it = props.find("DATE");
        if (it != props.end() && !it->second.isEmpty()) {
            y = it->second.front().toInt();
        }
        return y;
    }
    
    unsigned int track() const {
        return tag ? tag->track() : 0;
    }
    
    void setTitle(const std::string& value) {
        if (tag) tag->setTitle(TagLib::String(value, TagLib::String::UTF8));
    }
    
    void setArtist(const std::string& value) {
        if (tag) tag->setArtist(TagLib::String(value, TagLib::String::UTF8));
    }
    
    void setAlbum(const std::string& value) {
        if (tag) tag->setAlbum(TagLib::String(value, TagLib::String::UTF8));
    }
    
    void setComment(const std::string& value) {
        if (tag) tag->setComment(TagLib::String(value, TagLib::String::UTF8));
    }
    
    void setGenre(const std::string& value) {
        if (tag) tag->setGenre(TagLib::String(value, TagLib::String::UTF8));
    }
    
    void setYear(unsigned int value) {
        if (tag) tag->setYear(value);
    }
    
    void setTrack(unsigned int value) {
        if (tag) tag->setTrack(value);
    }
};

class AudioPropertiesWrapper {
private:
    TagLib::AudioProperties* props;
    TagLib::File* file;
    
public:
    AudioPropertiesWrapper() : props(nullptr), file(nullptr) {}
    AudioPropertiesWrapper(TagLib::AudioProperties* p, TagLib::File* f) : props(p), file(f) {}
    
    int lengthInSeconds() const {
        return props ? props->lengthInSeconds() : 0;
    }
    
    int lengthInMilliseconds() const {
        return props ? props->lengthInMilliseconds() : 0;
    }
    
    int bitrate() const {
        return props ? props->bitrate() : 0;
    }
    
    int sampleRate() const {
        return props ? props->sampleRate() : 0;
    }
    
    int channels() const {
        return props ? props->channels() : 0;
    }
    
    int bitsPerSample() const {
        if (!props) return 0;
        
        // MP4/M4A files
        if (TagLib::MP4::Properties* mp4Props = dynamic_cast<TagLib::MP4::Properties*>(props)) {
            return mp4Props->bitsPerSample();
        }
        // FLAC files
        else if (TagLib::FLAC::Properties* flacProps = dynamic_cast<TagLib::FLAC::Properties*>(props)) {
            return flacProps->bitsPerSample();
        }
        // WAV files
        else if (TagLib::RIFF::WAV::Properties* wavProps = dynamic_cast<TagLib::RIFF::WAV::Properties*>(props)) {
            return wavProps->bitsPerSample();
        }
        // AIFF files
        else if (TagLib::RIFF::AIFF::Properties* aiffProps = dynamic_cast<TagLib::RIFF::AIFF::Properties*>(props)) {
            return aiffProps->bitsPerSample();
        }
        // WavPack files
        else if (TagLib::WavPack::Properties* wvProps = dynamic_cast<TagLib::WavPack::Properties*>(props)) {
            return wvProps->bitsPerSample();
        }
        // TrueAudio files
        else if (TagLib::TrueAudio::Properties* ttaProps = dynamic_cast<TagLib::TrueAudio::Properties*>(props)) {
            return ttaProps->bitsPerSample();
        }
        // ASF/WMA files
        else if (TagLib::ASF::Properties* asfProps = dynamic_cast<TagLib::ASF::Properties*>(props)) {
            return asfProps->bitsPerSample();
        }
        // Matroska files
        else if (TagLib::Matroska::Properties* mkProps = dynamic_cast<TagLib::Matroska::Properties*>(props)) {
            return mkProps->bitsPerSample();
        }

        return 0;
    }
    
    std::string codec() const {
        if (!props || !file) return "unknown";
        
        // MP4/M4A files
        if (TagLib::MP4::Properties* mp4Props = dynamic_cast<TagLib::MP4::Properties*>(props)) {
            switch (mp4Props->codec()) {
                case TagLib::MP4::Properties::AAC:
                    return "AAC";
                case TagLib::MP4::Properties::ALAC:
                    return "ALAC";
                default:
                    return "unknown";
            }
        }
        // MP3 files
        else if (dynamic_cast<TagLib::MPEG::File*>(file)) {
            return "MP3";
        }
        // FLAC files
        else if (dynamic_cast<TagLib::FLAC::File*>(file)) {
            return "FLAC";
        }
        // OGG Vorbis files
        else if (dynamic_cast<TagLib::Ogg::Vorbis::File*>(file)) {
            return "Vorbis";
        }
        // OGG Opus files
        else if (dynamic_cast<TagLib::Ogg::Opus::File*>(file)) {
            return "Opus";
        }
        // WAV files
        else if (TagLib::RIFF::WAV::File* wavFile = dynamic_cast<TagLib::RIFF::WAV::File*>(file)) {
            // WAV can contain various codecs, but we'll report PCM for uncompressed
            if (TagLib::RIFF::WAV::Properties* wavProps = dynamic_cast<TagLib::RIFF::WAV::Properties*>(props)) {
                unsigned int format = wavProps->format();
                if (format == 1) return "PCM";
                else if (format == 3) return "IEEEFloat";
                else return "WAV";
            }
            return "WAV";
        }
        // AIFF files
        else if (dynamic_cast<TagLib::RIFF::AIFF::File*>(file)) {
            return "PCM"; // AIFF is typically uncompressed PCM
        }
        // WavPack files
        else if (dynamic_cast<TagLib::WavPack::File*>(file)) {
            return "WavPack";
        }
        // TrueAudio files
        else if (dynamic_cast<TagLib::TrueAudio::File*>(file)) {
            return "TTA";
        }
        // ASF/WMA files
        else if (dynamic_cast<TagLib::ASF::File*>(file)) {
            return "WMA";
        }
        // Matroska files - report codec name from container
        else if (auto* mkFile = dynamic_cast<TagLib::Matroska::File*>(file)) {
            auto* mkProps = dynamic_cast<TagLib::Matroska::Properties*>(mkFile->audioProperties());
            if (mkProps) {
                TagLib::String cn = mkProps->codecName();
                if (!cn.isEmpty()) {
                    std::string name = cn.to8Bit(true);
                    if (name.find("OPUS") != std::string::npos) return "Opus";
                    if (name.find("VORBIS") != std::string::npos) return "Vorbis";
                    if (name.find("FLAC") != std::string::npos) return "FLAC";
                    if (name.find("AAC") != std::string::npos) return "AAC";
                    if (name.find("MP3") != std::string::npos || name.find("MPEG") != std::string::npos) return "MP3";
                    return name;
                }
            }
            return "unknown";
        }

        return "unknown";
    }
    
    bool isLossless() const {
        std::string codecName = codec();
        
        // Lossless codecs
        if (codecName == "ALAC" ||      // Apple Lossless
            codecName == "FLAC" ||      // Free Lossless Audio Codec
            codecName == "PCM" ||       // Uncompressed PCM (WAV/AIFF)
            codecName == "IEEEFloat" || // Uncompressed floating point
            codecName == "WavPack" ||   // WavPack lossless
            codecName == "TTA") {       // TrueAudio lossless
            return true;
        }
        
        // Lossy codecs
        if (codecName == "AAC" ||       // Advanced Audio Coding
            codecName == "MP3" ||       // MPEG Layer 3
            codecName == "Vorbis" ||    // Ogg Vorbis
            codecName == "Opus") {      // Opus
            return false;
        }
        
        // Unknown codec - assume lossy
        return false;
    }
    
    std::string containerFormat() const {
        if (!file) return "unknown";
        
        // Detect container format based on file type
        if (dynamic_cast<TagLib::MPEG::File*>(file)) {
            return "MP3";
        }
        else if (dynamic_cast<TagLib::MP4::File*>(file)) {
            return "MP4"; // Includes .m4a files (ISO Base Media File Format)
        }
        else if (dynamic_cast<TagLib::FLAC::File*>(file)) {
            return "FLAC";
        }
        else if (dynamic_cast<TagLib::Ogg::Vorbis::File*>(file) ||
                 dynamic_cast<TagLib::Ogg::Opus::File*>(file)) {
            return "OGG";
        }
        else if (dynamic_cast<TagLib::RIFF::WAV::File*>(file)) {
            return "WAV";
        }
        else if (dynamic_cast<TagLib::RIFF::AIFF::File*>(file)) {
            return "AIFF";
        }
        else if (dynamic_cast<TagLib::WavPack::File*>(file)) {
            return "WavPack";
        }
        else if (dynamic_cast<TagLib::TrueAudio::File*>(file)) {
            return "TTA";
        }
        else if (dynamic_cast<TagLib::ASF::File*>(file)) {
            return "ASF";
        }
        else if (dynamic_cast<TagLib::Matroska::File*>(file)) {
            return "Matroska";
        }

        return "unknown";
    }
};

// Picture wrapper class for managing album art/cover images
class PictureWrapper {
public:
    std::string mimeType;
    val data;
    int type;
    std::string description;
    
    PictureWrapper() : type(3) {} // Default to FrontCover
    
    PictureWrapper(const std::string& mime, const val& imgData, int picType, const std::string& desc)
        : mimeType(mime), data(imgData), type(picType), description(desc) {}
};

// Custom IOStream backed by std::vector<char> instead of TagLib::ByteVector.
// This eliminates COW (copy-on-write) sharing that causes ByteVectorStream to
// deep-copy the entire file buffer during save(). ByteVectorStream::readBlock()
// uses ByteVector::mid() which creates COW-shared slices. Metadata blocks parsed
// during file loading hold these shared references, so when save() calls insert()
// → truncate() → resize() → detach(), the stream must copy the whole buffer.
// VectorStream's readBlock() constructs ByteVectors from raw pointers, producing
// independent copies (only of the small metadata blocks, not the whole file).
class VectorStream : public TagLib::IOStream {
public:
    VectorStream(const char *data, unsigned int length)
        : buf_(data, data + length), position_(0) {}

    VectorStream(std::vector<char> &&data)
        : buf_(std::move(data)), position_(0) {}

    TagLib::FileName name() const override { return ""; }

    TagLib::ByteVector readBlock(size_t length) override {
        if(length == 0 || position_ < 0 ||
           position_ >= static_cast<TagLib::offset_t>(buf_.size()))
            return TagLib::ByteVector();

        size_t avail = buf_.size() - static_cast<size_t>(position_);
        size_t toRead = std::min(length, avail);
        TagLib::ByteVector v(buf_.data() + position_,
                             static_cast<unsigned int>(toRead));
        position_ += static_cast<TagLib::offset_t>(toRead);
        return v;
    }

    void writeBlock(const TagLib::ByteVector &data) override {
        if(position_ < 0)
            return;
        size_t end = static_cast<size_t>(position_) + data.size();
        if(end > buf_.size())
            buf_.resize(end);
        memcpy(buf_.data() + position_, data.data(), data.size());
        position_ += data.size();
    }

    void insert(const TagLib::ByteVector &data,
                TagLib::offset_t start = 0, size_t replace = 0) override {
        long long sizeDiff = static_cast<long long>(data.size()) -
                             static_cast<long long>(replace);
        if(sizeDiff < 0) {
            removeBlock(start + data.size(),
                        static_cast<size_t>(-sizeDiff));
        } else if(sizeDiff > 0) {
            size_t oldSize = buf_.size();
            buf_.resize(oldSize + static_cast<size_t>(sizeDiff));
            size_t readPos  = static_cast<size_t>(start) + replace;
            size_t writePos = static_cast<size_t>(start) + data.size();
            if(readPos < oldSize) {
                memmove(buf_.data() + writePos, buf_.data() + readPos,
                        oldSize - readPos);
            }
        }
        seek(start);
        writeBlock(data);
    }

    void removeBlock(TagLib::offset_t start = 0, size_t length = 0) override {
        size_t readPos  = static_cast<size_t>(start) + length;
        size_t writePos = static_cast<size_t>(start);
        if(readPos < buf_.size()) {
            size_t toMove = buf_.size() - readPos;
            memmove(buf_.data() + writePos, buf_.data() + readPos, toMove);
            writePos += toMove;
        }
        position_ = static_cast<TagLib::offset_t>(writePos);
        buf_.resize(writePos);
    }

    bool readOnly() const override { return false; }
    bool isOpen() const override { return true; }

    void seek(TagLib::offset_t offset, Position p = Beginning) override {
        switch(p) {
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

    const char *bufData() const { return buf_.data(); }
    size_t bufSize() const { return buf_.size(); }

private:
    std::vector<char> buf_;
    TagLib::offset_t position_;
};

// Helper class to manage stream lifetime
class FileHandle {
private:
    std::unique_ptr<VectorStream> stream;
    std::unique_ptr<TagLib::FileRef> fileRef;
    std::unique_ptr<TagLib::File> file;
    
public:
    FileHandle() = default;
    
    bool loadFromBuffer(const val& jsBuffer) {
        try {
            unsigned int length = jsBuffer["length"].as<unsigned int>();
            if (length == 0) return false;

            // Allocate a temporary buffer and bulk-copy JS data via
            // typed_memory_view, then move it into VectorStream.
            std::vector<char> buf(length, '\0');
            val memoryView = val(emscripten::typed_memory_view(
                length, reinterpret_cast<uint8_t*>(buf.data())));
            memoryView.call<void>("set", jsBuffer);

            char header[12] = {};
            unsigned int headerLen = length < 12u ? length : 12u;
            memcpy(header, buf.data(), headerLen);

            stream = std::make_unique<VectorStream>(std::move(buf));
            stream->seek(0, TagLib::IOStream::Beginning);
            
            // Try to create FileRef first
            fileRef = std::make_unique<TagLib::FileRef>(stream.get());
            
            if (!fileRef->isNull() && fileRef->file() && fileRef->file()->isValid()) {
                return true;
            }
            
            // If FileRef failed, try specific file types based on format detection
            stream->seek(0, TagLib::IOStream::Beginning);
            std::string format = detectFormat(std::string(header, headerLen));
            
            if (format == "mp3") {
                file.reset(new TagLib::MPEG::File(stream.get()));
            } else if (format == "flac") {
                file.reset(new TagLib::FLAC::File(stream.get()));
            } else if (format == "ogg") {
                file.reset(new TagLib::Ogg::Vorbis::File(stream.get()));
            } else if (format == "mp4") {
                file.reset(new TagLib::MP4::File(stream.get()));
            } else if (format == "wav") {
                file.reset(new TagLib::RIFF::WAV::File(stream.get()));
            } else if (format == "aiff") {
                file.reset(new TagLib::RIFF::AIFF::File(stream.get()));
            } else if (format == "matroska") {
                file.reset(new TagLib::Matroska::File(stream.get()));
            }
            
            if (file && file->isValid()) {
                fileRef = std::make_unique<TagLib::FileRef>(file.get());
                return !fileRef->isNull();
            }
            
            return false;
        } catch (...) {
            return false;
        }
    }
    
    bool isValid() const {
        return fileRef && !fileRef->isNull();
    }
    
    bool save() {
        return fileRef && fileRef->save();
    }
    
    TagWrapper getTag() {
        TagLib::Tag* t = fileRef ? fileRef->tag() : nullptr;
        return TagWrapper(t);
    }
    
    AudioPropertiesWrapper getAudioProperties() {
        TagLib::AudioProperties* p = fileRef ? fileRef->audioProperties() : nullptr;
        TagLib::File* f = fileRef ? fileRef->file() : nullptr;
        return AudioPropertiesWrapper(p, f);
    }
    
    TagLib::File* getFile() {
        return fileRef ? fileRef->file() : nullptr;
    }
    
    std::string getFormat() const {
        if (!fileRef || !fileRef->file()) return "unknown";
        
        TagLib::File* f = fileRef->file();
        if (dynamic_cast<TagLib::MPEG::File*>(f)) return "MP3";
        if (dynamic_cast<TagLib::MP4::File*>(f)) return "MP4";
        if (dynamic_cast<TagLib::FLAC::File*>(f)) return "FLAC";
        if (dynamic_cast<TagLib::Ogg::Vorbis::File*>(f)) return "OGG";
        if (dynamic_cast<TagLib::Ogg::Opus::File*>(f)) return "OPUS";
        if (dynamic_cast<TagLib::RIFF::WAV::File*>(f)) return "WAV";
        if (dynamic_cast<TagLib::RIFF::AIFF::File*>(f)) return "AIFF";
        if (dynamic_cast<TagLib::WavPack::File*>(f)) return "WV";
        if (dynamic_cast<TagLib::TrueAudio::File*>(f)) return "TTA";
        if (dynamic_cast<TagLib::ASF::File*>(f)) return "ASF";
        if (dynamic_cast<TagLib::Matroska::File*>(f)) return "MATROSKA";

        return "unknown";
    }
    
    val getProperties() const {
        val obj = val::object();
        
        if (fileRef && fileRef->file()) {
            TagLib::PropertyMap properties = fileRef->file()->properties();
            
            for (const auto& prop : properties) {
                val array = val::array();
                for (const auto& value : prop.second) {
                    array.call<void>("push", std::string(value.toCString(true)));
                }
                obj.set(std::string(prop.first.toCString(true)), array);
            }
        }
        
        return obj;
    }
    
    void setProperties(const val& properties) {
        if (!fileRef || !fileRef->file()) return;
        
        TagLib::PropertyMap propMap;
        
        // Iterate over JavaScript object properties
        val keys = val::global("Object").call<val>("keys", properties);
        int length = keys["length"].as<int>();
        
        for (int i = 0; i < length; i++) {
            std::string key = keys[i].as<std::string>();
            val values = properties[key];
            
            if (values.isArray()) {
                TagLib::StringList stringList;
                int valueCount = values["length"].as<int>();
                
                for (int j = 0; j < valueCount; j++) {
                    stringList.append(TagLib::String(values[j].as<std::string>(), TagLib::String::UTF8));
                }
                
                propMap[TagLib::String(key, TagLib::String::UTF8)] = stringList;
            }
        }
        
        fileRef->file()->setProperties(propMap);
    }
    
    std::string getProperty(const std::string& key) const {
        if (!fileRef || !fileRef->file()) return "";
        
        TagLib::PropertyMap properties = fileRef->file()->properties();
        TagLib::String tagKey(key, TagLib::String::UTF8);
        
        if (properties.contains(tagKey) && !properties[tagKey].isEmpty()) {
            return std::string(properties[tagKey].front().toCString(true));
        }
        
        return "";
    }
    
    void setProperty(const std::string& key, const std::string& value) {
        if (!fileRef || !fileRef->file()) return;
        
        TagLib::PropertyMap properties = fileRef->file()->properties();
        TagLib::StringList values;
        values.append(TagLib::String(value, TagLib::String::UTF8));
        properties[TagLib::String(key, TagLib::String::UTF8)] = values;
        fileRef->file()->setProperties(properties);
    }
    
    // MP4-specific methods
    bool isMP4() const {
        return fileRef && dynamic_cast<TagLib::MP4::File*>(fileRef->file()) != nullptr;
    }
    
    std::string getMP4Item(const std::string& key) const {
        if (!fileRef || !fileRef->file()) return "";
        
        TagLib::MP4::File* mp4File = dynamic_cast<TagLib::MP4::File*>(fileRef->file());
        if (!mp4File || !mp4File->tag()) return "";
        
        TagLib::MP4::Tag* tag = mp4File->tag();
        TagLib::String tagKey(key, TagLib::String::UTF8);
        
        if (tag->contains(tagKey)) {
            TagLib::MP4::Item item = tag->item(tagKey);
            if (item.isValid()) {
                if (item.type() == TagLib::MP4::Item::Type::Int) {
                    return std::to_string(item.toInt());
                } else if (item.type() == TagLib::MP4::Item::Type::StringList && !item.toStringList().isEmpty()) {
                    return std::string(item.toStringList().front().toCString(true));
                } else if (item.type() == TagLib::MP4::Item::Type::Bool) {
                    return item.toBool() ? "true" : "false";
                } else if (item.type() == TagLib::MP4::Item::Type::Byte) {
                    return std::to_string(item.toByte());
                }
            }
        }
        
        return "";
    }
    
    void setMP4Item(const std::string& key, const std::string& value) {
        if (!fileRef || !fileRef->file()) return;
        
        TagLib::MP4::File* mp4File = dynamic_cast<TagLib::MP4::File*>(fileRef->file());
        if (!mp4File || !mp4File->tag()) return;
        
        TagLib::MP4::Tag* tag = mp4File->tag();
        TagLib::String tagKey(key, TagLib::String::UTF8);
        
        // Try to parse as integer first
        char* endptr;
        long intValue = strtol(value.c_str(), &endptr, 10);
        if (*endptr == '\0') {
            // It's a valid integer
            tag->setItem(tagKey, TagLib::MP4::Item(static_cast<int>(intValue)));
        } else {
            // Store as string
            tag->setItem(tagKey, TagLib::MP4::Item(TagLib::String(value, TagLib::String::UTF8)));
        }
    }
    
    void removeMP4Item(const std::string& key) {
        if (!fileRef || !fileRef->file()) return;
        
        TagLib::MP4::File* mp4File = dynamic_cast<TagLib::MP4::File*>(fileRef->file());
        if (!mp4File || !mp4File->tag()) return;
        
        TagLib::MP4::Tag* tag = mp4File->tag();
        TagLib::String tagKey(key, TagLib::String::UTF8);
        
        if (tag->contains(tagKey)) {
            tag->removeItem(tagKey);
        }
    }
    
private:
    std::string detectFormat(const std::string& data) const {
        if (data.size() < 12) return "unknown";
        
        const char* d = data.data();
        
        // MP3 - Look for ID3 header or MPEG sync
        if (data.size() >= 3 && (memcmp(d, "ID3", 3) == 0 || 
            (data.size() >= 2 && (unsigned char)d[0] == 0xFF && ((unsigned char)d[1] & 0xE0) == 0xE0))) {
            return "mp3";
        }
        
        // MP4/M4A - Look for ftyp box
        if (data.size() >= 12 && memcmp(d + 4, "ftyp", 4) == 0) {
            return "mp4";
        }
        
        // FLAC - Look for fLaC signature
        if (data.size() >= 4 && memcmp(d, "fLaC", 4) == 0) {
            return "flac";
        }
        
        // OGG - Look for OggS signature
        if (data.size() >= 4 && memcmp(d, "OggS", 4) == 0) {
            return "ogg";
        }
        
        // WAV - Look for RIFF header
        if (data.size() >= 12 && memcmp(d, "RIFF", 4) == 0 && memcmp(d + 8, "WAVE", 4) == 0) {
            return "wav";
        }
        
        // AIFF - Look for FORM header
        if (data.size() >= 12 && memcmp(d, "FORM", 4) == 0 && memcmp(d + 8, "AIFF", 4) == 0) {
            return "aiff";
        }

        // Matroska/WebM - EBML signature
        if (data.size() >= 4 && (unsigned char)d[0] == 0x1A && (unsigned char)d[1] == 0x45 &&
            (unsigned char)d[2] == 0xDF && (unsigned char)d[3] == 0xA3) {
            return "matroska";
        }

        return "unknown";
    }

    // Convert a TagLib::ByteVector to a JavaScript Uint8Array using a single
    // native bulk copy via typed_memory_view instead of a byte-by-byte loop.
    // typed_memory_view(n, ptr) creates a Uint8Array view backed by WASM memory;
    // passing it to new Uint8Array(...) performs a single native copy into JS.
    static val byteVectorToUint8Array(const TagLib::ByteVector& bv) {
        if (bv.isEmpty()) return val::global("Uint8Array").new_(0);
        auto view = emscripten::typed_memory_view(
            bv.size(), reinterpret_cast<const uint8_t*>(bv.data()));
        return val::global("Uint8Array").new_(view);
    }

    // Copy a JavaScript Uint8Array into a TagLib::ByteVector using a single
    // native bulk copy. convertJSArrayToNumberVector uses typed_memory_view +
    // _emval_array_to_memory_view (dst.set(src)) internally — one native call.
    // NOTE: vecFromJSArray<T> must NOT be used here; it loops byte-by-byte.
    static TagLib::ByteVector uint8ArrayToByteVector(const val& jsArray) {
        const auto vec = emscripten::convertJSArrayToNumberVector<uint8_t>(jsArray);
        if (vec.empty()) return TagLib::ByteVector();
        return TagLib::ByteVector(reinterpret_cast<const char*>(vec.data()),
                                  static_cast<unsigned int>(vec.size()));
    }

public:
    // Get the current file buffer after modifications
    val getBuffer() const {
        if (stream && stream->bufSize() > 0) {
            size_t sz = stream->bufSize();

            auto view = emscripten::typed_memory_view(
                sz, reinterpret_cast<const uint8_t*>(stream->bufData()));

            return val::global("Uint8Array").new_(view);
        }

        return val::global("Uint8Array").new_(0);
    }
    
    // Get all pictures from the audio file
    val getPictures() const {
        val pictures = val::array();
        
        if (!fileRef || !fileRef->file()) return pictures;
        
        TagLib::File* f = fileRef->file();
        
        // Handle MP3 files (ID3v2)
        if (TagLib::MPEG::File* mpegFile = dynamic_cast<TagLib::MPEG::File*>(f)) {
            if (mpegFile->hasID3v2Tag()) {
                TagLib::ID3v2::Tag* id3v2Tag = mpegFile->ID3v2Tag();
                const TagLib::ID3v2::FrameList& frameList = id3v2Tag->frameList("APIC");
                
                for (const auto& frame : frameList) {
                    if (TagLib::ID3v2::AttachedPictureFrame* pictureFrame = 
                        dynamic_cast<TagLib::ID3v2::AttachedPictureFrame*>(frame)) {
                        
                        val pictureObj = val::object();
                        pictureObj.set("mimeType", std::string(pictureFrame->mimeType().toCString(true)));
                        pictureObj.set("type", static_cast<int>(pictureFrame->type()));
                        pictureObj.set("description", std::string(pictureFrame->description().toCString(true)));
                        
                        // Convert picture data to Uint8Array (fast bulk copy)
                        TagLib::ByteVector picData = pictureFrame->picture();
                        pictureObj.set("data", byteVectorToUint8Array(picData));
                        
                        pictures.call<void>("push", pictureObj);
                    }
                }
            }
        }
        // Handle MP4/M4A files
        else if (TagLib::MP4::File* mp4File = dynamic_cast<TagLib::MP4::File*>(f)) {
            if (mp4File->tag() && mp4File->tag()->contains("covr")) {
                TagLib::MP4::Item coverItem = mp4File->tag()->item("covr");
                if (coverItem.isValid() && coverItem.type() == TagLib::MP4::Item::Type::CoverArtList) {
                    TagLib::MP4::CoverArtList coverList = coverItem.toCoverArtList();
                    
                    for (const auto& cover : coverList) {
                        val pictureObj = val::object();
                        
                        // Determine MIME type from format
                        std::string mimeType;
                        switch (cover.format()) {
                            case TagLib::MP4::CoverArt::JPEG:
                                mimeType = "image/jpeg";
                                break;
                            case TagLib::MP4::CoverArt::PNG:
                                mimeType = "image/png";
                                break;
                            case TagLib::MP4::CoverArt::BMP:
                                mimeType = "image/bmp";
                                break;
                            case TagLib::MP4::CoverArt::GIF:
                                mimeType = "image/gif";
                                break;
                            default:
                                mimeType = "image/unknown";
                        }
                        
                        pictureObj.set("mimeType", mimeType);
                        pictureObj.set("type", 3); // FrontCover for MP4
                        pictureObj.set("description", "");
                        
                        // Convert picture data to Uint8Array (fast bulk copy)
                        TagLib::ByteVector picData = cover.data();
                        pictureObj.set("data", byteVectorToUint8Array(picData));
                        
                        pictures.call<void>("push", pictureObj);
                    }
                }
            }
        }
        // Handle FLAC files
        else if (TagLib::FLAC::File* flacFile = dynamic_cast<TagLib::FLAC::File*>(f)) {
            const TagLib::List<TagLib::FLAC::Picture*>& pictureList = flacFile->pictureList();
            
            for (const auto& picture : pictureList) {
                val pictureObj = val::object();
                pictureObj.set("mimeType", std::string(picture->mimeType().toCString(true)));
                pictureObj.set("type", static_cast<int>(picture->type()));
                pictureObj.set("description", std::string(picture->description().toCString(true)));
                
                // Convert picture data to Uint8Array (fast bulk copy)
                TagLib::ByteVector picData = picture->data();
                pictureObj.set("data", byteVectorToUint8Array(picData));
                
                pictures.call<void>("push", pictureObj);
            }
        }
        // Handle Ogg Vorbis/Opus files
        else if (TagLib::Ogg::Vorbis::File* vorbisFile = dynamic_cast<TagLib::Ogg::Vorbis::File*>(f)) {
            if (vorbisFile->tag()) {
                const TagLib::List<TagLib::FLAC::Picture*>& pictureList = vorbisFile->tag()->pictureList();
                
                for (const auto& picture : pictureList) {
                    val pictureObj = val::object();
                    pictureObj.set("mimeType", std::string(picture->mimeType().toCString(true)));
                    pictureObj.set("type", static_cast<int>(picture->type()));
                    pictureObj.set("description", std::string(picture->description().toCString(true)));
                    
                    // Convert picture data to Uint8Array (fast bulk copy)
                    TagLib::ByteVector picData = picture->data();
                    pictureObj.set("data", byteVectorToUint8Array(picData));
                    
                    pictures.call<void>("push", pictureObj);
                }
            }
        }
        
        return pictures;
    }
    
    // Set pictures in the audio file (replace all existing)
    void setPictures(const val& pictures) {
        if (!fileRef || !fileRef->file() || !pictures.isArray()) return;
        
        TagLib::File* f = fileRef->file();
        int length = pictures["length"].as<int>();
        
        // Handle MP3 files (ID3v2)
        if (TagLib::MPEG::File* mpegFile = dynamic_cast<TagLib::MPEG::File*>(f)) {
            if (!mpegFile->hasID3v2Tag()) {
                mpegFile->ID3v2Tag(true); // Create ID3v2 tag if it doesn't exist
            }
            
            TagLib::ID3v2::Tag* id3v2Tag = mpegFile->ID3v2Tag();
            
            // Remove all existing APIC frames
            id3v2Tag->removeFrames("APIC");
            
            // Add new pictures
            for (int i = 0; i < length; i++) {
                val picture = pictures[i];
                
                TagLib::ID3v2::AttachedPictureFrame* frame = new TagLib::ID3v2::AttachedPictureFrame();
                
                frame->setMimeType(TagLib::String(picture["mimeType"].as<std::string>(), TagLib::String::UTF8));
                frame->setType(static_cast<TagLib::ID3v2::AttachedPictureFrame::Type>(picture["type"].as<int>()));
                frame->setDescription(TagLib::String(picture["description"].as<std::string>(), TagLib::String::UTF8));
                
                // Convert Uint8Array to ByteVector (fast bulk copy)
                frame->setPicture(uint8ArrayToByteVector(picture["data"]));
                
                id3v2Tag->addFrame(frame);
            }
        }
        // Handle MP4/M4A files
        else if (TagLib::MP4::File* mp4File = dynamic_cast<TagLib::MP4::File*>(f)) {
            if (!mp4File->tag()) return;
            
            TagLib::MP4::Tag* tag = mp4File->tag();
            TagLib::MP4::CoverArtList coverList;
            
            for (int i = 0; i < length; i++) {
                val picture = pictures[i];
                
                // Determine format from MIME type
                TagLib::MP4::CoverArt::Format format = TagLib::MP4::CoverArt::Unknown;
                std::string mimeType = picture["mimeType"].as<std::string>();
                
                if (mimeType == "image/jpeg" || mimeType == "image/jpg") {
                    format = TagLib::MP4::CoverArt::JPEG;
                } else if (mimeType == "image/png") {
                    format = TagLib::MP4::CoverArt::PNG;
                } else if (mimeType == "image/bmp") {
                    format = TagLib::MP4::CoverArt::BMP;
                } else if (mimeType == "image/gif") {
                    format = TagLib::MP4::CoverArt::GIF;
                }
                
                // Convert Uint8Array to ByteVector (fast bulk copy)
                TagLib::MP4::CoverArt coverArt(format, uint8ArrayToByteVector(picture["data"]));
                coverList.append(coverArt);
            }
            
            if (!coverList.isEmpty()) {
                tag->setItem("covr", TagLib::MP4::Item(coverList));
            } else {
                tag->removeItem("covr");
            }
        }
        // Handle FLAC files
        else if (TagLib::FLAC::File* flacFile = dynamic_cast<TagLib::FLAC::File*>(f)) {
            // Remove all existing pictures
            flacFile->removePictures();
            
            // Add new pictures
            for (int i = 0; i < length; i++) {
                val picture = pictures[i];
                
                TagLib::FLAC::Picture* flacPicture = new TagLib::FLAC::Picture();
                
                flacPicture->setMimeType(TagLib::String(picture["mimeType"].as<std::string>(), TagLib::String::UTF8));
                flacPicture->setType(static_cast<TagLib::FLAC::Picture::Type>(picture["type"].as<int>()));
                flacPicture->setDescription(TagLib::String(picture["description"].as<std::string>(), TagLib::String::UTF8));
                
                // Convert Uint8Array to ByteVector (fast bulk copy)
                flacPicture->setData(uint8ArrayToByteVector(picture["data"]));
                
                flacFile->addPicture(flacPicture);
            }
        }
        // Handle Ogg Vorbis files
        else if (TagLib::Ogg::Vorbis::File* vorbisFile = dynamic_cast<TagLib::Ogg::Vorbis::File*>(f)) {
            if (!vorbisFile->tag()) return;
            
            // Remove all existing pictures
            vorbisFile->tag()->removeAllPictures();
            
            // Add new pictures
            for (int i = 0; i < length; i++) {
                val picture = pictures[i];
                
                TagLib::FLAC::Picture* flacPicture = new TagLib::FLAC::Picture();
                
                flacPicture->setMimeType(TagLib::String(picture["mimeType"].as<std::string>(), TagLib::String::UTF8));
                flacPicture->setType(static_cast<TagLib::FLAC::Picture::Type>(picture["type"].as<int>()));
                flacPicture->setDescription(TagLib::String(picture["description"].as<std::string>(), TagLib::String::UTF8));
                
                // Convert Uint8Array to ByteVector (fast bulk copy)
                flacPicture->setData(uint8ArrayToByteVector(picture["data"]));
                
                vorbisFile->tag()->addPicture(flacPicture);
            }
        }
    }
    
    // Add a single picture to the audio file
    void addPicture(const val& picture) {
        if (!fileRef || !fileRef->file()) return;
        
        // Get existing pictures
        val existingPictures = getPictures();
        
        // Add the new picture
        existingPictures.call<void>("push", picture);
        
        // Set all pictures
        setPictures(existingPictures);
    }
    
    // Remove all pictures from the audio file
    void removePictures() {
        val emptyArray = val::array();
        setPictures(emptyArray);
    }

    // Get all ratings from the audio file
    // Returns array of {rating: number (0.0-1.0), email: string, counter: number}
    val getRatings() const {
        val ratings = val::array();

        if (!fileRef || !fileRef->file()) return ratings;

        TagLib::File* f = fileRef->file();

        // Handle MP3 files (ID3v2 POPM frames)
        if (TagLib::MPEG::File* mpegFile = dynamic_cast<TagLib::MPEG::File*>(f)) {
            if (mpegFile->hasID3v2Tag()) {
                TagLib::ID3v2::Tag* id3v2Tag = mpegFile->ID3v2Tag();
                const TagLib::ID3v2::FrameList& frameList = id3v2Tag->frameList("POPM");

                for (const auto& frame : frameList) {
                    if (TagLib::ID3v2::PopularimeterFrame* popmFrame =
                        dynamic_cast<TagLib::ID3v2::PopularimeterFrame*>(frame)) {

                        val ratingObj = val::object();
                        // Normalize rating from 0-255 to 0.0-1.0
                        ratingObj.set("rating", popmFrame->rating() / 255.0);
                        ratingObj.set("email", std::string(popmFrame->email().toCString(true)));
                        ratingObj.set("counter", static_cast<unsigned int>(popmFrame->counter()));

                        ratings.call<void>("push", ratingObj);
                    }
                }
            }
        }
        // Handle FLAC files (Vorbis RATING field)
        else if (TagLib::FLAC::File* flacFile = dynamic_cast<TagLib::FLAC::File*>(f)) {
            if (flacFile->xiphComment()) {
                TagLib::Ogg::XiphComment* xiphComment = flacFile->xiphComment();
                if (xiphComment->contains("RATING")) {
                    TagLib::StringList ratingValues = xiphComment->fieldListMap()["RATING"];
                    for (const auto& ratingStr : ratingValues) {
                        try {
                            double r = std::stod(ratingStr.toCString());
                            // Normalize to 0.0-1.0 if not already
                            if (r > 1.0) r = r / 100.0;

                            val ratingObj = val::object();
                            ratingObj.set("rating", r);
                            ratingObj.set("email", std::string(""));
                            ratingObj.set("counter", 0);

                            ratings.call<void>("push", ratingObj);
                        } catch (...) {
                            // Skip invalid rating values
                        }
                    }
                }
            }
        }
        // Handle Ogg Vorbis files (Vorbis RATING field)
        else if (TagLib::Ogg::Vorbis::File* vorbisFile = dynamic_cast<TagLib::Ogg::Vorbis::File*>(f)) {
            if (vorbisFile->tag()) {
                TagLib::Ogg::XiphComment* xiphComment = vorbisFile->tag();
                if (xiphComment->contains("RATING")) {
                    TagLib::StringList ratingValues = xiphComment->fieldListMap()["RATING"];
                    for (const auto& ratingStr : ratingValues) {
                        try {
                            double r = std::stod(ratingStr.toCString());
                            // Normalize to 0.0-1.0 if not already
                            if (r > 1.0) r = r / 100.0;

                            val ratingObj = val::object();
                            ratingObj.set("rating", r);
                            ratingObj.set("email", std::string(""));
                            ratingObj.set("counter", 0);

                            ratings.call<void>("push", ratingObj);
                        } catch (...) {
                            // Skip invalid rating values
                        }
                    }
                }
            }
        }
        // Handle Ogg Opus files (Vorbis RATING field)
        else if (TagLib::Ogg::Opus::File* opusFile = dynamic_cast<TagLib::Ogg::Opus::File*>(f)) {
            if (opusFile->tag()) {
                TagLib::Ogg::XiphComment* xiphComment = opusFile->tag();
                if (xiphComment->contains("RATING")) {
                    TagLib::StringList ratingValues = xiphComment->fieldListMap()["RATING"];
                    for (const auto& ratingStr : ratingValues) {
                        try {
                            double r = std::stod(ratingStr.toCString());
                            // Normalize to 0.0-1.0 if not already
                            if (r > 1.0) r = r / 100.0;

                            val ratingObj = val::object();
                            ratingObj.set("rating", r);
                            ratingObj.set("email", std::string(""));
                            ratingObj.set("counter", 0);

                            ratings.call<void>("push", ratingObj);
                        } catch (...) {
                            // Skip invalid rating values
                        }
                    }
                }
            }
        }
        // Handle MP4/M4A files (freeform rating atom)
        else if (TagLib::MP4::File* mp4File = dynamic_cast<TagLib::MP4::File*>(f)) {
            if (mp4File->tag()) {
                // Try various known rating atoms
                const char* ratingAtoms[] = {
                    "----:com.apple.iTunes:RATING",
                    "----:com.apple.iTunes:rating",
                    "rate"
                };

                for (const char* atomName : ratingAtoms) {
                    if (mp4File->tag()->contains(atomName)) {
                        TagLib::MP4::Item item = mp4File->tag()->item(atomName);
                        if (item.isValid()) {
                            double r = 0.0;
                            if (item.type() == TagLib::MP4::Item::Type::Int) {
                                // Integer rating (0-100 or 0-255)
                                int intVal = item.toInt();
                                r = (intVal > 100) ? intVal / 255.0 : intVal / 100.0;
                            } else if (item.type() == TagLib::MP4::Item::Type::StringList &&
                                       !item.toStringList().isEmpty()) {
                                try {
                                    r = std::stod(item.toStringList().front().toCString());
                                    if (r > 1.0) r = r / 100.0;
                                } catch (...) {}
                            }

                            val ratingObj = val::object();
                            ratingObj.set("rating", r);
                            ratingObj.set("email", std::string(""));
                            ratingObj.set("counter", 0);

                            ratings.call<void>("push", ratingObj);
                            break; // Found a rating, stop searching
                        }
                    }
                }
            }
        }

        return ratings;
    }

    // Set ratings in the audio file (replace all existing)
    void setRatings(const val& ratings) {
        if (!fileRef || !fileRef->file() || !ratings.isArray()) return;

        TagLib::File* f = fileRef->file();
        int length = ratings["length"].as<int>();

        // Handle MP3 files (ID3v2 POPM frames)
        if (TagLib::MPEG::File* mpegFile = dynamic_cast<TagLib::MPEG::File*>(f)) {
            if (!mpegFile->hasID3v2Tag()) {
                mpegFile->ID3v2Tag(true); // Create ID3v2 tag if it doesn't exist
            }

            TagLib::ID3v2::Tag* id3v2Tag = mpegFile->ID3v2Tag();

            // Remove all existing POPM frames
            id3v2Tag->removeFrames("POPM");

            // Add new POPM frames
            for (int i = 0; i < length; i++) {
                val r = ratings[i];

                auto* popmFrame = new TagLib::ID3v2::PopularimeterFrame();

                // Convert normalized 0.0-1.0 to 0-255
                double normalized = r["rating"].as<double>();
                popmFrame->setRating(static_cast<int>(normalized * 255));

                if (r.hasOwnProperty("email") && !r["email"].isNull() && !r["email"].isUndefined()) {
                    std::string email = r["email"].as<std::string>();
                    popmFrame->setEmail(TagLib::String(email, TagLib::String::UTF8));
                }

                if (r.hasOwnProperty("counter") && !r["counter"].isNull() && !r["counter"].isUndefined()) {
                    popmFrame->setCounter(r["counter"].as<unsigned int>());
                }

                id3v2Tag->addFrame(popmFrame);
            }
        }
        // Handle FLAC files (Vorbis RATING field)
        else if (TagLib::FLAC::File* flacFile = dynamic_cast<TagLib::FLAC::File*>(f)) {
            if (flacFile->xiphComment()) {
                TagLib::Ogg::XiphComment* xiphComment = flacFile->xiphComment();

                // Remove existing RATING fields
                xiphComment->removeFields("RATING");

                // Add new RATING fields (store as 0.0-1.0 string)
                for (int i = 0; i < length; i++) {
                    val r = ratings[i];
                    double normalized = r["rating"].as<double>();
                    std::string ratingStr = std::to_string(normalized);
                    xiphComment->addField("RATING", TagLib::String(ratingStr, TagLib::String::UTF8));
                }
            }
        }
        // Handle Ogg Vorbis files (Vorbis RATING field)
        else if (TagLib::Ogg::Vorbis::File* vorbisFile = dynamic_cast<TagLib::Ogg::Vorbis::File*>(f)) {
            if (vorbisFile->tag()) {
                TagLib::Ogg::XiphComment* xiphComment = vorbisFile->tag();

                // Remove existing RATING fields
                xiphComment->removeFields("RATING");

                // Add new RATING fields
                for (int i = 0; i < length; i++) {
                    val r = ratings[i];
                    double normalized = r["rating"].as<double>();
                    std::string ratingStr = std::to_string(normalized);
                    xiphComment->addField("RATING", TagLib::String(ratingStr, TagLib::String::UTF8));
                }
            }
        }
        // Handle Ogg Opus files (Vorbis RATING field)
        else if (TagLib::Ogg::Opus::File* opusFile = dynamic_cast<TagLib::Ogg::Opus::File*>(f)) {
            if (opusFile->tag()) {
                TagLib::Ogg::XiphComment* xiphComment = opusFile->tag();

                // Remove existing RATING fields
                xiphComment->removeFields("RATING");

                // Add new RATING fields
                for (int i = 0; i < length; i++) {
                    val r = ratings[i];
                    double normalized = r["rating"].as<double>();
                    std::string ratingStr = std::to_string(normalized);
                    xiphComment->addField("RATING", TagLib::String(ratingStr, TagLib::String::UTF8));
                }
            }
        }
        // Handle MP4/M4A files (freeform rating atom)
        else if (TagLib::MP4::File* mp4File = dynamic_cast<TagLib::MP4::File*>(f)) {
            if (mp4File->tag()) {
                // Remove existing rating atoms
                mp4File->tag()->removeItem("----:com.apple.iTunes:RATING");

                // Add new rating (use first one, MP4 typically has single rating)
                if (length > 0) {
                    val r = ratings[0];
                    double normalized = r["rating"].as<double>();
                    std::string ratingStr = std::to_string(normalized);

                    mp4File->tag()->setItem("----:com.apple.iTunes:RATING",
                        TagLib::MP4::Item(TagLib::StringList(TagLib::String(ratingStr, TagLib::String::UTF8))));
                }
            }
        }
    }

    // Explicitly destroy all resources
    void destroy() {
        // Reset unique_ptrs to release memory immediately
        file.reset();
        fileRef.reset();
        stream.reset();
    }
};

EMSCRIPTEN_BINDINGS(taglib) {
    // FileHandle class - main entry point
    class_<FileHandle>("FileHandle")
        .constructor<>()
        .function("loadFromBuffer", &FileHandle::loadFromBuffer)
        .function("isValid", &FileHandle::isValid)
        .function("save", &FileHandle::save)
        .function("getFormat", &FileHandle::getFormat)
        .function("getProperties", &FileHandle::getProperties)
        .function("setProperties", &FileHandle::setProperties)
        .function("getProperty", &FileHandle::getProperty)
        .function("setProperty", &FileHandle::setProperty)
        .function("isMP4", &FileHandle::isMP4)
        .function("getMP4Item", &FileHandle::getMP4Item)
        .function("setMP4Item", &FileHandle::setMP4Item)
        .function("removeMP4Item", &FileHandle::removeMP4Item)
        .function("getTag", &FileHandle::getTag)
        .function("getAudioProperties", &FileHandle::getAudioProperties)
        .function("getBuffer", &FileHandle::getBuffer)
        .function("getPictures", &FileHandle::getPictures)
        .function("setPictures", &FileHandle::setPictures)
        .function("addPicture", &FileHandle::addPicture)
        .function("removePictures", &FileHandle::removePictures)
        .function("getRatings", &FileHandle::getRatings)
        .function("setRatings", &FileHandle::setRatings)
        .function("destroy", &FileHandle::destroy);
    
    // TagWrapper class
    class_<TagWrapper>("TagWrapper")
        .constructor<>()
        .function("title", &TagWrapper::title)
        .function("artist", &TagWrapper::artist)
        .function("album", &TagWrapper::album)
        .function("comment", &TagWrapper::comment)
        .function("genre", &TagWrapper::genre)
        .function("year", &TagWrapper::year)
        .function("track", &TagWrapper::track)
        .function("setTitle", &TagWrapper::setTitle)
        .function("setArtist", &TagWrapper::setArtist)
        .function("setAlbum", &TagWrapper::setAlbum)
        .function("setComment", &TagWrapper::setComment)
        .function("setGenre", &TagWrapper::setGenre)
        .function("setYear", &TagWrapper::setYear)
        .function("setTrack", &TagWrapper::setTrack);
    
    // AudioPropertiesWrapper class
    class_<AudioPropertiesWrapper>("AudioPropertiesWrapper")
        .constructor<>()
        .function("lengthInSeconds", &AudioPropertiesWrapper::lengthInSeconds)
        .function("lengthInMilliseconds", &AudioPropertiesWrapper::lengthInMilliseconds)
        .function("bitrate", &AudioPropertiesWrapper::bitrate)
        .function("sampleRate", &AudioPropertiesWrapper::sampleRate)
        .function("channels", &AudioPropertiesWrapper::channels)
        .function("bitsPerSample", &AudioPropertiesWrapper::bitsPerSample)
        .function("codec", &AudioPropertiesWrapper::codec)
        .function("isLossless", &AudioPropertiesWrapper::isLossless)
        .function("containerFormat", &AudioPropertiesWrapper::containerFormat);
    
    // PictureWrapper class
    class_<PictureWrapper>("PictureWrapper")
        .constructor<>()
        .property("mimeType", &PictureWrapper::mimeType)
        .property("data", &PictureWrapper::data)
        .property("type", &PictureWrapper::type)
        .property("description", &PictureWrapper::description);
    
    // Register shared_ptr for FileHandle
    register_vector<std::string>("StringVector");
    
    // Helper function to create a FileHandle from buffer
    function("createFileHandle", +[]() -> FileHandle* {
        return new FileHandle();
    }, allow_raw_pointers());
}