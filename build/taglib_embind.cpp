#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <fileref.h>
#include <tag.h>
#include <audioproperties.h>
#include <tpropertymap.h>
#include <tbytevector.h>
#include <tbytevectorstream.h>
#include <mpegfile.h>
#include <mp4file.h>
#include <mp4tag.h>
#include <mp4item.h>
#include <flacfile.h>
#include <vorbisfile.h>
#include <opusfile.h>
#include <wavfile.h>
#include <aifffile.h>
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
        return tag ? tag->title().to8Bit(true) : "";
    }
    
    std::string artist() const {
        return tag ? tag->artist().to8Bit(true) : "";
    }
    
    std::string album() const {
        return tag ? tag->album().to8Bit(true) : "";
    }
    
    std::string comment() const {
        return tag ? tag->comment().to8Bit(true) : "";
    }
    
    std::string genre() const {
        return tag ? tag->genre().to8Bit(true) : "";
    }
    
    unsigned int year() const {
        return tag ? tag->year() : 0;
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
    
public:
    AudioPropertiesWrapper() : props(nullptr) {}
    AudioPropertiesWrapper(TagLib::AudioProperties* p) : props(p) {}
    
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
};

// Helper class to manage ByteVectorStream lifetime
class FileHandle {
private:
    std::unique_ptr<TagLib::ByteVectorStream> stream;
    std::unique_ptr<TagLib::FileRef> fileRef;
    std::unique_ptr<TagLib::File> file;
    
public:
    FileHandle() = default;
    
    bool loadFromBuffer(const val& jsBuffer) {
        try {
            // Get the buffer length
            unsigned int length = jsBuffer["length"].as<unsigned int>();
            
            // Create a vector to hold the data
            std::vector<char> data(length);
            
            // Copy data from JavaScript typed array to C++ vector
            // This preserves binary data without any encoding conversions
            for (unsigned int i = 0; i < length; i++) {
                data[i] = jsBuffer[i].as<unsigned char>();
            }
            
            // Create ByteVector from the buffer
            TagLib::ByteVector buffer(data.data(), data.size());
            
            // Create a ByteVectorStream
            stream = std::make_unique<TagLib::ByteVectorStream>(buffer);
            stream->seek(0, TagLib::IOStream::Beginning);
            
            // Try to create FileRef first
            fileRef = std::make_unique<TagLib::FileRef>(stream.get());
            
            if (!fileRef->isNull() && fileRef->file() && fileRef->file()->isValid()) {
                return true;
            }
            
            // If FileRef failed, try specific file types based on format detection
            stream->seek(0, TagLib::IOStream::Beginning);
            std::string format = detectFormat(std::string(data.data(), data.size()));
            
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
        return AudioPropertiesWrapper(p);
    }
    
    TagLib::File* getFile() {
        return fileRef ? fileRef->file() : nullptr;
    }
    
    std::string getFormat() const {
        if (!fileRef || !fileRef->file()) return "UNKNOWN";
        
        TagLib::File* f = fileRef->file();
        if (dynamic_cast<TagLib::MPEG::File*>(f)) return "MP3";
        if (dynamic_cast<TagLib::MP4::File*>(f)) return "MP4";
        if (dynamic_cast<TagLib::FLAC::File*>(f)) return "FLAC";
        if (dynamic_cast<TagLib::Ogg::Vorbis::File*>(f)) return "OGG";
        if (dynamic_cast<TagLib::Ogg::Opus::File*>(f)) return "OPUS";
        if (dynamic_cast<TagLib::RIFF::WAV::File*>(f)) return "WAV";
        if (dynamic_cast<TagLib::RIFF::AIFF::File*>(f)) return "AIFF";
        
        return "UNKNOWN";
    }
    
    val getProperties() const {
        val obj = val::object();
        
        if (fileRef && fileRef->file()) {
            TagLib::PropertyMap properties = fileRef->file()->properties();
            
            for (const auto& prop : properties) {
                val array = val::array();
                for (const auto& value : prop.second) {
                    array.call<void>("push", value.to8Bit(true));
                }
                obj.set(prop.first.to8Bit(true), array);
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
            return properties[tagKey].front().to8Bit(true);
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
                    return item.toStringList().front().to8Bit(true);
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
        
        return "unknown";
    }
    
public:
    // Get the current file buffer after modifications
    val getBuffer() const {
        if (stream && stream->data()) {
            const TagLib::ByteVector* data = stream->data();
            
            // Create a JavaScript Uint8Array with the binary data
            val uint8Array = val::global("Uint8Array").new_(data->size());
            
            // Copy the data directly to preserve binary integrity
            for (size_t i = 0; i < data->size(); i++) {
                uint8Array.set(i, static_cast<unsigned char>((*data)[i]));
            }
            
            return uint8Array;
        }
        
        // Return an empty Uint8Array if no data
        return val::global("Uint8Array").new_(0);
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
        .function("channels", &AudioPropertiesWrapper::channels);
    
    // Register shared_ptr for FileHandle
    register_vector<std::string>("StringVector");
    
    // Helper function to create a FileHandle from buffer
    function("createFileHandle", +[]() -> FileHandle* {
        return new FileHandle();
    }, allow_raw_pointers());
}