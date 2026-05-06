// tests/capi_lame_parser.test.cpp
#include "../src/capi/formats/taglib_lame.h"
#include <cstring>
#include <iostream>

using namespace taglib_wasm;

namespace {

// MPEG-1 stereo: Xing/Info magic at offset 0x24, LAME magic at 0x9C, method byte at 0xA5.
// We use a 0x100-byte buffer zeroed out, then write magic and (optionally) LAME tag.
struct Frame {
    unsigned char data[0x100];
    size_t len;
};

Frame buildFrame(const char* magicAt0x24, bool withLame, unsigned char vbrMethodByte) {
    Frame f{};
    f.len = sizeof(f.data);
    std::memset(f.data, 0, f.len);
    if (magicAt0x24) {
        std::memcpy(f.data + 0x24, magicAt0x24, 4);
    }
    if (withLame) {
        std::memcpy(f.data + 0x9C, "LAME", 4); // 0x24 + 0x78
        f.data[0xA5] = vbrMethodByte;          // 0x24 + 0x81
    }
    return f;
}

int passed = 0;
int failed = 0;

void check(bool ok, const char* name) {
    if (ok) {
        passed++;
        std::cout << "  PASS: " << name << "\n";
    } else {
        failed++;
        std::cout << "  FAIL: " << name << "\n";
    }
}

} // namespace

int main() {
    // mpegVersion=0 (Version1), channelMode=0 (Stereo)

    {
        auto f = buildFrame("Xing", true, 0x01);
        auto info = parseLameInfo(f.data, f.len, 0, 0);
        check(info.valid && info.mode == BitrateMode::CBR,
              "Xing+LAME method=1 -> CBR");
    }
    {
        auto f = buildFrame("Xing", true, 0x02);
        auto info = parseLameInfo(f.data, f.len, 0, 0);
        check(info.valid && info.mode == BitrateMode::ABR,
              "Xing+LAME method=2 -> ABR");
    }
    {
        auto f = buildFrame("Xing", true, 0x03);
        auto info = parseLameInfo(f.data, f.len, 0, 0);
        check(info.valid && info.mode == BitrateMode::VBR,
              "Xing+LAME method=3 -> VBR");
    }
    {
        auto f = buildFrame("Xing", true, 0x08);
        auto info = parseLameInfo(f.data, f.len, 0, 0);
        check(info.valid && info.mode == BitrateMode::CBR,
              "Xing+LAME method=8 -> CBR (2-pass)");
    }
    {
        auto f = buildFrame("Xing", true, 0x09);
        auto info = parseLameInfo(f.data, f.len, 0, 0);
        check(info.valid && info.mode == BitrateMode::ABR,
              "Xing+LAME method=9 -> ABR (2-pass)");
    }
    {
        auto f = buildFrame("Xing", true, 0x00);
        auto info = parseLameInfo(f.data, f.len, 0, 0);
        check(info.valid && info.mode == BitrateMode::VBR,
              "Xing+LAME method=0 -> VBR (preliminary preserved)");
    }
    {
        // High nibble of method byte is revision; must be ignored.
        auto f = buildFrame("Xing", true, 0x21); // revision=2, method=1
        auto info = parseLameInfo(f.data, f.len, 0, 0);
        check(info.valid && info.mode == BitrateMode::CBR,
              "High nibble of method byte ignored");
    }
    {
        auto f = buildFrame("Info", false, 0);
        auto info = parseLameInfo(f.data, f.len, 0, 0);
        check(info.valid && info.mode == BitrateMode::CBR,
              "Info magic, no LAME -> CBR");
    }
    {
        auto f = buildFrame("Xing", false, 0);
        auto info = parseLameInfo(f.data, f.len, 0, 0);
        check(info.valid && info.mode == BitrateMode::VBR,
              "Xing magic, no LAME -> VBR");
    }
    {
        auto f = buildFrame("VBRI", false, 0);
        auto info = parseLameInfo(f.data, f.len, 0, 0);
        check(info.valid && info.mode == BitrateMode::VBR,
              "VBRI magic -> VBR");
    }
    {
        auto f = buildFrame(nullptr, false, 0);
        auto info = parseLameInfo(f.data, f.len, 0, 0);
        check(!info.valid, "No magic -> invalid");
    }
    {
        auto f = buildFrame("Xing", true, 0x02);
        // Truncated past LAME (0x40 < 0x9C), but past magic (0x40 >= 0x28)
        auto info = parseLameInfo(f.data, 0x40, 0, 0);
        check(info.valid && info.mode == BitrateMode::VBR,
              "Truncated past LAME -> preliminary VBR");
    }
    {
        auto f = buildFrame("Xing", true, 0x02);
        // Too short for any magic at offset 0x24
        auto info = parseLameInfo(f.data, 0x10, 0, 0);
        check(!info.valid, "Too short for magic -> invalid");
    }
    {
        // MPEG-1 mono (channelMode=3): magic at 0x15
        Frame f{};
        f.len = sizeof(f.data);
        std::memset(f.data, 0, f.len);
        std::memcpy(f.data + 0x15, "Info", 4);
        auto info = parseLameInfo(f.data, f.len, 0, 3);
        check(info.valid && info.mode == BitrateMode::CBR,
              "MPEG-1 mono Info magic at 0x15 -> CBR");
    }
    {
        // MPEG-2 stereo (mpegVersion=1, channelMode=0): magic at 0x15
        Frame f{};
        f.len = sizeof(f.data);
        std::memset(f.data, 0, f.len);
        std::memcpy(f.data + 0x15, "Xing", 4);
        auto info = parseLameInfo(f.data, f.len, 1, 0);
        check(info.valid && info.mode == BitrateMode::VBR,
              "MPEG-2 stereo Xing at 0x15 -> VBR");
    }
    {
        // modeString sanity
        check(std::strcmp(modeString(BitrateMode::CBR), "CBR") == 0, "modeString CBR");
        check(std::strcmp(modeString(BitrateMode::VBR), "VBR") == 0, "modeString VBR");
        check(std::strcmp(modeString(BitrateMode::ABR), "ABR") == 0, "modeString ABR");
        check(modeString(BitrateMode::Unknown) == nullptr, "modeString Unknown -> nullptr");
    }

    std::cout << "\n" << passed << " passed, " << failed << " failed\n";
    return failed == 0 ? 0 : 1;
}
