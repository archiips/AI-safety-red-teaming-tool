#include "severity.h"
#include <string>
#include <vector>

// ---------- Homoglyph table: Cyrillic/Greek lookalikes → Latin ----------
// Encoded as UTF-8 byte sequences for the most common substitutions.
// Each entry maps a multi-byte sequence to a single ASCII char.

static const std::vector<std::pair<std::string, char>> HOMOGLYPHS = {
    // Cyrillic
    {"\xD0\xB0", 'a'}, // а → a
    {"\xD0\x90", 'A'}, // А → A
    {"\xD0\xB5", 'e'}, // е → e
    {"\xD0\x95", 'E'}, // Е → E
    {"\xD0\xB8", 'i'}, // и → i (looks like и but maps to i)
    {"\xD0\xBE", 'o'}, // о → o
    {"\xD0\x9E", 'O'}, // О → O
    {"\xD1\x80", 'p'}, // р → p
    {"\xD1\x81", 'c'}, // с → c
    {"\xD0\xA1", 'C'}, // С → C
    {"\xD1\x83", 'y'}, // у → y
    {"\xD1\x85", 'x'}, // х → x
    // Greek
    {"\xCE\xBD", 'v'}, // ν → v
    {"\xCE\xB1", 'a'}, // α → a
    {"\xCE\xB5", 'e'}, // ε → e
    {"\xCE\xBF", 'o'}, // ο → o
    {"\xCE\xB9", 'i'}, // ι → i
    {"\xCE\xBA", 'k'}, // κ → k
    {"\xCF\x81", 'p'}, // ρ → p
    // Full-width ASCII lookalikes (common in CJK spam)
    {"\xEF\xBC\xA5", 'E'}, // Ｅ
    {"\xEF\xBC\xA9", 'I'}, // Ｉ
    {"\xEF\xBC\xAF", 'O'}, // Ｏ
};

static std::string apply_homoglyphs(const std::string& input) {
    std::string out;
    out.reserve(input.size());
    for (size_t i = 0; i < input.size(); ) {
        bool replaced = false;
        for (auto& [seq, ascii] : HOMOGLYPHS) {
            if (input.compare(i, seq.size(), seq) == 0) {
                out += ascii;
                i += seq.size();
                replaced = true;
                break;
            }
        }
        if (!replaced) {
            out += input[i++];
        }
    }
    return out;
}

// ---------- Leetspeak / symbol substitution table ----------
// Applied char-by-char on ASCII input after homoglyph pass.

static char leet_char(char c) {
    switch (c) {
        case '0': return 'o';
        case '1': return 'l';
        case '3': return 'e';
        case '4': return 'a';
        case '5': return 's';
        case '7': return 't';
        case '@': return 'a';
        case '$': return 's';
        case '!': return 'i';
        case '+': return 't';
        case '|': return 'i';
        default:  return c;
    }
}

static std::string apply_leetspeak(const std::string& input) {
    std::string out = input;
    for (char& c : out) c = leet_char(c);
    return out;
}

// ---------- Base64 decoder ----------

static const std::string B64_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static bool is_base64_char(char c) {
    return B64_CHARS.find(c) != std::string::npos || c == '=';
}

static std::string decode_base64(const std::string& encoded) {
    std::string result;
    int val = 0, valb = -8;
    for (char c : encoded) {
        if (c == '=') break;
        auto pos = B64_CHARS.find(c);
        if (pos == std::string::npos) continue;
        val = (val << 6) + static_cast<int>(pos);
        valb += 6;
        if (valb >= 0) {
            result += static_cast<char>((val >> valb) & 0xFF);
            valb -= 8;
        }
    }
    return result;
}

// Scan input for base64-looking substrings (min 8 chars) and decode them.
// Appended to the normalized text so AC can match decoded content.
static std::string extract_and_decode_base64(const std::string& input) {
    std::string decoded_parts;
    size_t i = 0;
    while (i < input.size()) {
        if (is_base64_char(input[i]) && input[i] != '=') {
            size_t j = i;
            while (j < input.size() && is_base64_char(input[j])) ++j;
            if (j - i >= 8) {
                std::string candidate = input.substr(i, j - i);
                std::string dec = decode_base64(candidate);
                // Only keep if decoded result is printable ASCII (avoids false positives)
                bool printable = true;
                for (char c : dec) {
                    if (c < 0x20 || c > 0x7e) { printable = false; break; }
                }
                if (printable && !dec.empty())
                    decoded_parts += " " + dec;
            }
            i = j;
        } else {
            ++i;
        }
    }
    return decoded_parts;
}

// ---------- Public API ----------

std::string normalize_text(const std::string& input) {
    // 1. Replace homoglyphs
    std::string text = apply_homoglyphs(input);

    // 2. Apply leetspeak substitutions
    text = apply_leetspeak(text);

    // 3. Append decoded base64 substrings (if any)
    std::string b64 = extract_and_decode_base64(input); // use original to catch raw b64
    if (!b64.empty()) text += b64;

    return text;
}
