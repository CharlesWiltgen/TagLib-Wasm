#!/bin/bash
set -e

echo "🔧 Building TagLib WASM..."

# Check if Emscripten is installed
if ! command -v emcc &> /dev/null; then
  echo "❌ Emscripten not found. Please install Emscripten SDK first:"
  echo "   https://emscripten.org/docs/getting_started/downloads.html"
  exit 1
fi

# Build directory
BUILD_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$BUILD_DIR")"
TAGLIB_DIR="$PROJECT_ROOT/lib/taglib"
OUTPUT_DIR="$BUILD_DIR"

# Create CMake build directory
CMAKE_BUILD_DIR="$BUILD_DIR/cmake-build"
mkdir -p "$CMAKE_BUILD_DIR"
cd "$CMAKE_BUILD_DIR"

echo "📦 Configuring TagLib with Emscripten..."

# Configure TagLib with CMake for Emscripten
emcmake cmake "$TAGLIB_DIR" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DBUILD_TESTING=OFF \
  -DBUILD_EXAMPLES=OFF \
  -DWITH_ASF=ON \
  -DWITH_MP4=ON \
  -DWITH_ZLIB=OFF \
  -DCMAKE_INSTALL_PREFIX="$CMAKE_BUILD_DIR/install"

echo "🏗️  Building TagLib..."
emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo "📋 Installing TagLib..."
emmake make install

echo "🌐 Creating WASM bindings..."

# Create C++ wrapper for JavaScript bindings
cat > "$BUILD_DIR/taglib_wasm.cpp" << 'EOF'
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <taglib/fileref.h>
#include <taglib/tag.h>
#include <taglib/audioproperties.h>
#include <taglib/tpropertymap.h>
#include <taglib/tbytevector.h>
#include <taglib/tbytevectorstream.h>
#include <taglib/mpegfile.h>
#include <taglib/mp4file.h>
#include <taglib/mp4tag.h>
#include <taglib/mp4item.h>
#include <taglib/flacfile.h>
#include <taglib/vorbisfile.h>
#include <taglib/opusfile.h>
#include <taglib/wavfile.h>
#include <taglib/aifffile.h>
#include <vector>
#include <memory>
#include <map>
#include <string>
#include <sstream>

// Global storage for file objects and streams to prevent memory issues
static std::map<int, std::unique_ptr<TagLib::FileRef>> g_files;
static std::map<int, std::unique_ptr<TagLib::ByteVectorStream>> g_streams;
static int g_next_id = 1;

// Helper function to detect file format from buffer
std::string detectFileFormat(const char* data, int size) {
    if (size < 12) return "unknown";
    
    // MP3 - Look for ID3 header or MPEG sync
    if (size >= 3 && (memcmp(data, "ID3", 3) == 0 || 
        (size >= 2 && (unsigned char)data[0] == 0xFF && ((unsigned char)data[1] & 0xE0) == 0xE0))) {
        return "mp3";
    }
    
    // MP4/M4A - Look for ftyp box
    if (size >= 12 && memcmp(data + 4, "ftyp", 4) == 0) {
        return "mp4";
    }
    
    // FLAC - Look for fLaC signature
    if (size >= 4 && memcmp(data, "fLaC", 4) == 0) {
        return "flac";
    }
    
    // OGG - Look for OggS signature
    if (size >= 4 && memcmp(data, "OggS", 4) == 0) {
        // Could be Vorbis, Opus, or FLAC in OGG container
        return "ogg";
    }
    
    // WAV - Look for RIFF header
    if (size >= 12 && memcmp(data, "RIFF", 4) == 0 && memcmp(data + 8, "WAVE", 4) == 0) {
        return "wav";
    }
    
    // AIFF - Look for FORM header
    if (size >= 12 && memcmp(data, "FORM", 4) == 0 && memcmp(data + 8, "AIFF", 4) == 0) {
        return "aiff";
    }
    
    return "unknown";
}

extern "C" {

// File operations
int taglib_file_new_from_buffer(const char* data, int size) {
    if (!data || size <= 0) {
        return 0; // Invalid input
    }
    
    try {
        // Create ByteVector from the buffer (copy the data)
        TagLib::ByteVector buffer(data, size);
        
        // Create a ByteVectorStream
        auto stream = std::make_unique<TagLib::ByteVectorStream>(buffer);
        
        // Set the stream to read-only mode
        stream->seek(0, TagLib::IOStream::Beginning);
        
        // Create FileRef from the stream
        auto fileRef = std::make_unique<TagLib::FileRef>(stream.get());
        
        // Check if the file was successfully created and is valid
        if (fileRef->isNull() || !fileRef->file()) {
            // If FileRef failed, try to detect the format and create the appropriate file type
            stream->seek(0, TagLib::IOStream::Beginning);
            
            // Try specific file types based on format detection
            std::string format = detectFileFormat(data, size);
            
            TagLib::File* specificFile = nullptr;
            if (format == "mp3") {
                specificFile = new TagLib::MPEG::File(stream.get());
            } else if (format == "flac") {
                specificFile = new TagLib::FLAC::File(stream.get());
            } else if (format == "ogg") {
                specificFile = new TagLib::Ogg::Vorbis::File(stream.get());
            } else if (format == "mp4") {
                specificFile = new TagLib::MP4::File(stream.get());
            } else if (format == "wav") {
                specificFile = new TagLib::RIFF::WAV::File(stream.get());
            } else if (format == "aiff") {
                specificFile = new TagLib::RIFF::AIFF::File(stream.get());
            }
            
            if (specificFile && specificFile->isValid()) {
                // Create a new FileRef wrapping the specific file
                fileRef = std::make_unique<TagLib::FileRef>(specificFile);
            } else {
                if (specificFile) delete specificFile;
                return 0; // Failed to create valid file
            }
        }
        
        // Final validation
        if (fileRef->isNull() || !fileRef->file() || !fileRef->file()->isValid()) {
            return 0; // Failed to create valid file
        }
        
        // Store both the stream and file reference
        int id = g_next_id++;
        g_streams[id] = std::move(stream);
        g_files[id] = std::move(fileRef);
        
        return id;
    } catch (...) {
        return 0; // Error occurred
    }
}

void taglib_file_delete(int fileId) {
    auto fileIt = g_files.find(fileId);
    auto streamIt = g_streams.find(fileId);
    
    if (fileIt != g_files.end()) {
        g_files.erase(fileIt);
    }
    if (streamIt != g_streams.end()) {
        g_streams.erase(streamIt);
    }
}

int taglib_file_save(int fileId) {
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second) {
        return 0;
    }
    return it->second->save() ? 1 : 0;
}

int taglib_file_is_valid(int fileId) {
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second) {
        return 0;
    }
    return !it->second->isNull() ? 1 : 0;
}

// Get file format as string
const char* taglib_file_format(int fileId) {
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second) {
        return nullptr;
    }
    
    static std::string format;
    TagLib::File* file = it->second->file();
    if (!file) {
        format = "unknown";
        return format.c_str();
    }
    
    // Determine format based on file type
    if (dynamic_cast<TagLib::MPEG::File*>(file)) {
        format = "MP3";
    } else if (dynamic_cast<TagLib::MP4::File*>(file)) {
        format = "MP4";
    } else if (dynamic_cast<TagLib::FLAC::File*>(file)) {
        format = "FLAC";
    } else if (dynamic_cast<TagLib::Ogg::Vorbis::File*>(file)) {
        format = "OGG";
    } else if (dynamic_cast<TagLib::Ogg::Opus::File*>(file)) {
        format = "OPUS";
    } else if (dynamic_cast<TagLib::RIFF::WAV::File*>(file)) {
        format = "WAV";
    } else if (dynamic_cast<TagLib::RIFF::AIFF::File*>(file)) {
        format = "AIFF";
    } else {
        format = "UNKNOWN";
    }
    
    return format.c_str();
}

// Tag operations
TagLib::Tag* taglib_file_tag(int fileId) {
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second) {
        return nullptr;
    }
    return it->second->tag();
}

const char* taglib_tag_title(TagLib::Tag* tag) {
    if (!tag) return nullptr;
    static std::string title;
    title = tag->title().to8Bit(true);
    return title.c_str();
}

const char* taglib_tag_artist(TagLib::Tag* tag) {
    if (!tag) return nullptr;
    static std::string artist;
    artist = tag->artist().to8Bit(true);
    return artist.c_str();
}

const char* taglib_tag_album(TagLib::Tag* tag) {
    if (!tag) return nullptr;
    static std::string album;
    album = tag->album().to8Bit(true);
    return album.c_str();
}

const char* taglib_tag_comment(TagLib::Tag* tag) {
    if (!tag) return nullptr;
    static std::string comment;
    comment = tag->comment().to8Bit(true);
    return comment.c_str();
}

const char* taglib_tag_genre(TagLib::Tag* tag) {
    if (!tag) return nullptr;
    static std::string genre;
    genre = tag->genre().to8Bit(true);
    return genre.c_str();
}

unsigned int taglib_tag_year(TagLib::Tag* tag) {
    return tag ? tag->year() : 0;
}

unsigned int taglib_tag_track(TagLib::Tag* tag) {
    return tag ? tag->track() : 0;
}

void taglib_tag_set_title(TagLib::Tag* tag, const char* title) {
    if (tag && title) {
        tag->setTitle(TagLib::String(title, TagLib::String::UTF8));
    }
}

void taglib_tag_set_artist(TagLib::Tag* tag, const char* artist) {
    if (tag && artist) {
        tag->setArtist(TagLib::String(artist, TagLib::String::UTF8));
    }
}

void taglib_tag_set_album(TagLib::Tag* tag, const char* album) {
    if (tag && album) {
        tag->setAlbum(TagLib::String(album, TagLib::String::UTF8));
    }
}

void taglib_tag_set_comment(TagLib::Tag* tag, const char* comment) {
    if (tag && comment) {
        tag->setComment(TagLib::String(comment, TagLib::String::UTF8));
    }
}

void taglib_tag_set_genre(TagLib::Tag* tag, const char* genre) {
    if (tag && genre) {
        tag->setGenre(TagLib::String(genre, TagLib::String::UTF8));
    }
}

void taglib_tag_set_year(TagLib::Tag* tag, unsigned int year) {
    if (tag) {
        tag->setYear(year);
    }
}

void taglib_tag_set_track(TagLib::Tag* tag, unsigned int track) {
    if (tag) {
        tag->setTrack(track);
    }
}

// Audio properties
TagLib::AudioProperties* taglib_file_audioproperties(int fileId) {
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second) {
        return nullptr;
    }
    return it->second->audioProperties();
}

int taglib_audioproperties_length(TagLib::AudioProperties* props) {
    return props ? props->lengthInSeconds() : 0;
}

int taglib_audioproperties_bitrate(TagLib::AudioProperties* props) {
    return props ? props->bitrate() : 0;
}

int taglib_audioproperties_samplerate(TagLib::AudioProperties* props) {
    return props ? props->sampleRate() : 0;
}

int taglib_audioproperties_channels(TagLib::AudioProperties* props) {
    return props ? props->channels() : 0;
}

// PropertyMap operations
const char* taglib_file_properties_json(int fileId) {
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second || !it->second->file()) {
        return nullptr;
    }
    
    static std::string json;
    std::stringstream ss;
    ss << "{";
    
    TagLib::PropertyMap properties = it->second->file()->properties();
    bool first = true;
    
    for (const auto& prop : properties) {
        if (!first) ss << ",";
        first = false;
        
        ss << "\"" << prop.first.to8Bit(true) << "\":[";
        bool firstValue = true;
        for (const auto& value : prop.second) {
            if (!firstValue) ss << ",";
            firstValue = false;
            ss << "\"" << value.to8Bit(true) << "\"";
        }
        ss << "]";
    }
    
    ss << "}";
    json = ss.str();
    return json.c_str();
}

int taglib_file_set_properties_json(int fileId, const char* jsonStr) {
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second || !it->second->file() || !jsonStr) {
        return 0;
    }
    
    // For this simple implementation, we'll expect a simplified JSON format
    // Real implementation would use a proper JSON parser
    TagLib::PropertyMap properties;
    
    // This is a simplified parser - in production you'd use a real JSON library
    std::string json(jsonStr);
    // Skip the outer braces
    if (json.length() > 2 && json[0] == '{' && json[json.length()-1] == '}') {
        json = json.substr(1, json.length()-2);
    }
    
    // Basic parsing - assumes well-formed input
    size_t pos = 0;
    while (pos < json.length()) {
        // Find key
        size_t keyStart = json.find('"', pos);
        if (keyStart == std::string::npos) break;
        size_t keyEnd = json.find('"', keyStart + 1);
        if (keyEnd == std::string::npos) break;
        
        std::string key = json.substr(keyStart + 1, keyEnd - keyStart - 1);
        
        // Find array start
        size_t arrayStart = json.find('[', keyEnd);
        if (arrayStart == std::string::npos) break;
        size_t arrayEnd = json.find(']', arrayStart);
        if (arrayEnd == std::string::npos) break;
        
        // Parse values
        TagLib::StringList values;
        size_t valuePos = arrayStart + 1;
        while (valuePos < arrayEnd) {
            size_t valueStart = json.find('"', valuePos);
            if (valueStart >= arrayEnd) break;
            size_t valueEnd = json.find('"', valueStart + 1);
            if (valueEnd >= arrayEnd) break;
            
            std::string value = json.substr(valueStart + 1, valueEnd - valueStart - 1);
            values.append(TagLib::String(value, TagLib::String::UTF8));
            valuePos = valueEnd + 1;
        }
        
        if (!values.isEmpty()) {
            properties[TagLib::String(key, TagLib::String::UTF8)] = values;
        }
        
        pos = arrayEnd + 1;
        // Skip comma if present
        if (pos < json.length() && json[pos] == ',') pos++;
    }
    
    it->second->file()->setProperties(properties);
    return 1;
}

const char* taglib_file_get_property(int fileId, const char* key) {
    if (!key) return nullptr;
    
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second || !it->second->file()) {
        return nullptr;
    }
    
    static std::string value;
    TagLib::PropertyMap properties = it->second->file()->properties();
    TagLib::String tagKey(key, TagLib::String::UTF8);
    
    if (properties.contains(tagKey) && !properties[tagKey].isEmpty()) {
        value = properties[tagKey].front().to8Bit(true);
        return value.c_str();
    }
    
    return nullptr;
}

int taglib_file_set_property(int fileId, const char* key, const char* value) {
    if (!key || !value) return 0;
    
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second || !it->second->file()) {
        return 0;
    }
    
    TagLib::PropertyMap properties = it->second->file()->properties();
    TagLib::StringList values;
    values.append(TagLib::String(value, TagLib::String::UTF8));
    properties[TagLib::String(key, TagLib::String::UTF8)] = values;
    it->second->file()->setProperties(properties);
    
    return 1;
}

// MP4-specific operations
int taglib_file_is_mp4(int fileId) {
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second || !it->second->file()) {
        return 0;
    }
    
    return dynamic_cast<TagLib::MP4::File*>(it->second->file()) != nullptr ? 1 : 0;
}

const char* taglib_mp4_get_item(int fileId, const char* key) {
    if (!key) return nullptr;
    
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second || !it->second->file()) {
        return nullptr;
    }
    
    TagLib::MP4::File* mp4File = dynamic_cast<TagLib::MP4::File*>(it->second->file());
    if (!mp4File || !mp4File->tag()) {
        return nullptr;
    }
    
    static std::string value;
    TagLib::MP4::Tag* tag = mp4File->tag();
    TagLib::String tagKey(key, TagLib::String::UTF8);
    
    if (tag->contains(tagKey)) {
        TagLib::MP4::Item item = tag->item(tagKey);
        if (item.isValid()) {
            if (item.type() == TagLib::MP4::Item::Type::Int) {
                value = std::to_string(item.toInt());
            } else if (item.type() == TagLib::MP4::Item::Type::StringList && !item.toStringList().isEmpty()) {
                value = item.toStringList().front().to8Bit(true);
            } else if (item.type() == TagLib::MP4::Item::Type::Bool) {
                value = item.toBool() ? "true" : "false";
            } else if (item.type() == TagLib::MP4::Item::Type::Byte) {
                value = std::to_string(item.toByte());
            }
            return value.c_str();
        }
    }
    
    return nullptr;
}

int taglib_mp4_set_item(int fileId, const char* key, const char* value) {
    if (!key || !value) return 0;
    
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second || !it->second->file()) {
        return 0;
    }
    
    TagLib::MP4::File* mp4File = dynamic_cast<TagLib::MP4::File*>(it->second->file());
    if (!mp4File || !mp4File->tag()) {
        return 0;
    }
    
    TagLib::MP4::Tag* tag = mp4File->tag();
    TagLib::String tagKey(key, TagLib::String::UTF8);
    
    // Try to parse as integer first
    char* endptr;
    long intValue = strtol(value, &endptr, 10);
    if (*endptr == '\0') {
        // It's a valid integer
        tag->setItem(tagKey, TagLib::MP4::Item(static_cast<int>(intValue)));
    } else {
        // Store as string
        tag->setItem(tagKey, TagLib::MP4::Item(TagLib::String(value, TagLib::String::UTF8)));
    }
    
    return 1;
}

int taglib_mp4_remove_item(int fileId, const char* key) {
    if (!key) return 0;
    
    auto it = g_files.find(fileId);
    if (it == g_files.end() || !it->second || !it->second->file()) {
        return 0;
    }
    
    TagLib::MP4::File* mp4File = dynamic_cast<TagLib::MP4::File*>(it->second->file());
    if (!mp4File || !mp4File->tag()) {
        return 0;
    }
    
    TagLib::MP4::Tag* tag = mp4File->tag();
    TagLib::String tagKey(key, TagLib::String::UTF8);
    
    if (tag->contains(tagKey)) {
        tag->removeItem(tagKey);
        return 1;
    }
    
    return 0;
}

} // extern "C"
EOF

echo "🔗 Compiling WASM module..."

# Compile the WASM module without minification for cross-platform compatibility
emcc "$BUILD_DIR/taglib_wasm.cpp" \
  -I"$CMAKE_BUILD_DIR/install/include" \
  -L"$CMAKE_BUILD_DIR/install/lib" \
  -ltag \
  -o "$OUTPUT_DIR/taglib.js" \
  -s WASM=1 \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall","getValue","setValue","allocate","intArrayFromString","ALLOC_NORMAL"]' \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_taglib_file_new_from_buffer","_taglib_file_delete","_taglib_file_save","_taglib_file_is_valid","_taglib_file_format","_taglib_file_tag","_taglib_tag_title","_taglib_tag_artist","_taglib_tag_album","_taglib_tag_comment","_taglib_tag_genre","_taglib_tag_year","_taglib_tag_track","_taglib_tag_set_title","_taglib_tag_set_artist","_taglib_tag_set_album","_taglib_tag_set_comment","_taglib_tag_set_genre","_taglib_tag_set_year","_taglib_tag_set_track","_taglib_file_audioproperties","_taglib_audioproperties_length","_taglib_audioproperties_bitrate","_taglib_audioproperties_samplerate","_taglib_audioproperties_channels","_taglib_file_properties_json","_taglib_file_set_properties_json","_taglib_file_get_property","_taglib_file_set_property","_taglib_file_is_mp4","_taglib_mp4_get_item","_taglib_mp4_set_item","_taglib_mp4_remove_item"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=16777216 \
  -s MAXIMUM_MEMORY=268435456 \
  -s EXPORT_NAME="TagLibWASM" \
  -s MODULARIZE=1 \
  -s ENVIRONMENT='web,node' \
  -O3

echo "✅ TagLib WASM build complete!"
echo "📁 Output files:"
echo "   - $OUTPUT_DIR/taglib.js"
echo "   - $OUTPUT_DIR/taglib.wasm"

# Clean up temporary files
rm -rf "$CMAKE_BUILD_DIR"
rm -f "$BUILD_DIR/taglib_wasm.cpp"

echo "🎉 Build finished successfully!"