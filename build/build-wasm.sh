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
#include <taglib/flacfile.h>
#include <taglib/vorbisfile.h>
#include <taglib/opusfile.h>
#include <taglib/wavfile.h>
#include <taglib/aifffile.h>
#include <vector>
#include <memory>
#include <map>
#include <string>

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

} // extern "C"
EOF

echo "🔗 Compiling WASM module..."

# Compile the WASM module with proper flags
emcc "$BUILD_DIR/taglib_wasm.cpp" \
  -I"$CMAKE_BUILD_DIR/install/include" \
  -L"$CMAKE_BUILD_DIR/install/lib" \
  -ltag \
  -o "$OUTPUT_DIR/taglib.js" \
  -s WASM=1 \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall","getValue","setValue","allocate","intArrayFromString","ALLOC_NORMAL"]' \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_taglib_file_new_from_buffer","_taglib_file_delete","_taglib_file_save","_taglib_file_is_valid","_taglib_file_format","_taglib_file_tag","_taglib_tag_title","_taglib_tag_artist","_taglib_tag_album","_taglib_tag_comment","_taglib_tag_genre","_taglib_tag_year","_taglib_tag_track","_taglib_tag_set_title","_taglib_tag_set_artist","_taglib_tag_set_album","_taglib_tag_set_comment","_taglib_tag_set_genre","_taglib_tag_set_year","_taglib_tag_set_track","_taglib_file_audioproperties","_taglib_audioproperties_length","_taglib_audioproperties_bitrate","_taglib_audioproperties_samplerate","_taglib_audioproperties_channels"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=16777216 \
  -s MAXIMUM_MEMORY=268435456 \
  -s EXPORT_NAME="TagLibWASM" \
  -s MODULARIZE=1 \
  -s ENVIRONMENT='web,node' \
  -O3 \
  --closure 1

echo "✅ TagLib WASM build complete!"
echo "📁 Output files:"
echo "   - $OUTPUT_DIR/taglib.js"
echo "   - $OUTPUT_DIR/taglib.wasm"

# Clean up temporary files
rm -rf "$CMAKE_BUILD_DIR"
rm -f "$BUILD_DIR/taglib_wasm.cpp"

echo "🎉 Build finished successfully!"