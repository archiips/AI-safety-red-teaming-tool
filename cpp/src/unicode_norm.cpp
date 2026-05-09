#include "severity.h"
#include <string>
#include <vector>

// ---------- Homoglyph table: non-ASCII lookalikes → ASCII ----------
// UTF-8 byte sequences mapped to their ASCII equivalents.
// Covers Cyrillic, Greek, and common full-width lookalikes.

static const std::vector<std::pair<std::string, char>> HOMOGLYPHS = {
    // --- Cyrillic ---
    {"\xD0\x90", 'A'}, // А
    {"\xD0\xB0", 'a'}, // а
    {"\xD0\x92", 'B'}, // В
    {"\xD0\x95", 'E'}, // Е
    {"\xD0\xB5", 'e'}, // е
    {"\xD0\x96", 'Z'}, // Ж → Z (rough)
    {"\xD0\x97", 'Z'}, // З
    {"\xD0\x98", 'I'}, // И
    {"\xD0\xB8", 'i'}, // и
    {"\xD0\x9A", 'K'}, // К
    {"\xD0\xBB", 'l'}, // л (looks like n/l)
    {"\xD0\x9C", 'M'}, // М
    {"\xD0\x9D", 'H'}, // Н
    {"\xD0\x9E", 'O'}, // О
    {"\xD0\xBE", 'o'}, // о
    {"\xD0\xA0", 'R'}, // Р
    {"\xD1\x80", 'p'}, // р
    {"\xD0\xA1", 'C'}, // С
    {"\xD1\x81", 'c'}, // с
    {"\xD0\xA2", 'T'}, // Т
    {"\xD1\x82", 't'}, // т (sometimes)
    {"\xD0\xA3", 'Y'}, // У
    {"\xD1\x83", 'y'}, // у
    {"\xD0\xA5", 'X'}, // Х
    {"\xD1\x85", 'x'}, // х
    // --- Greek ---
    {"\xCE\x91", 'A'}, // Α
    {"\xCE\xB1", 'a'}, // α
    {"\xCE\x92", 'B'}, // Β
    {"\xCE\x95", 'E'}, // Ε
    {"\xCE\xB5", 'e'}, // ε
    {"\xCE\x96", 'Z'}, // Ζ
    {"\xCE\x97", 'H'}, // Η
    {"\xCE\x99", 'I'}, // Ι
    {"\xCE\xB9", 'i'}, // ι
    {"\xCE\x9A", 'K'}, // Κ
    {"\xCE\xBA", 'k'}, // κ
    {"\xCE\x9C", 'M'}, // Μ
    {"\xCE\x9D", 'N'}, // Ν
    {"\xCE\x9F", 'O'}, // Ο
    {"\xCE\xBF", 'o'}, // ο
    {"\xCE\xA1", 'P'}, // Ρ
    {"\xCF\x81", 'p'}, // ρ
    {"\xCE\xA4", 'T'}, // Τ
    {"\xCF\x84", 't'}, // τ
    {"\xCE\xA5", 'Y'}, // Υ
    {"\xCF\x85", 'u'}, // υ
    {"\xCE\xBD", 'v'}, // ν
    {"\xCE\xA7", 'X'}, // Χ
    {"\xCF\x87", 'x'}, // χ
    // --- Full-width ASCII (common in East-Asian spam) ---
    {"\xEF\xBC\xA1", 'A'}, // Ａ
    {"\xEF\xBC\xA2", 'B'}, // Ｂ
    {"\xEF\xBC\xA3", 'C'}, // Ｃ
    {"\xEF\xBC\xA4", 'D'}, // Ｄ
    {"\xEF\xBC\xA5", 'E'}, // Ｅ
    {"\xEF\xBC\xA6", 'F'}, // Ｆ
    {"\xEF\xBC\xA7", 'G'}, // Ｇ
    {"\xEF\xBC\xA8", 'H'}, // Ｈ
    {"\xEF\xBC\xA9", 'I'}, // Ｉ
    {"\xEF\xBC\xAA", 'J'}, // Ｊ
    {"\xEF\xBC\xAB", 'K'}, // Ｋ
    {"\xEF\xBC\xAC", 'L'}, // Ｌ
    {"\xEF\xBC\xAD", 'M'}, // Ｍ
    {"\xEF\xBC\xAE", 'N'}, // Ｎ
    {"\xEF\xBC\xAF", 'O'}, // Ｏ
    {"\xEF\xBC\xB0", 'P'}, // Ｐ
    {"\xEF\xBC\xB2", 'R'}, // Ｒ
    {"\xEF\xBC\xB3", 'S'}, // Ｓ
    {"\xEF\xBC\xB4", 'T'}, // Ｔ
    {"\xEF\xBC\xB5", 'U'}, // Ｕ
    {"\xEF\xBC\xB6", 'V'}, // Ｖ
    {"\xEF\xBC\xB7", 'W'}, // Ｗ
    {"\xEF\xBC\xB8", 'X'}, // Ｘ
    {"\xEF\xBC\xB9", 'Y'}, // Ｙ
    {"\xEF\xBC\xBA", 'Z'}, // Ｚ
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
        if (!replaced) out += input[i++];
    }
    return out;
}

// ---------- Multi-char leet substitutions (apply before single-char) ----------
// Sorted longest-first so longer patterns are checked before their prefixes.

static const std::vector<std::pair<std::string, std::string>> MULTI_LEET = {
    // 3-char clusters
    {"|\\/|", "m"}, // |\/|
    {"|/|",   "m"}, // |/|
    {"|\\|",  "n"}, // |\\|
    {"|\\/",  "w"}, // alternative w
    {"\\/\\/","w"},
    {"|_|",   "u"},
    {"|-|",   "h"},
    {"(_)",   "u"},
    // 2-char clusters
    {"\\/",   "v"},
    {"/\\",   "a"},
    {"|3",    "b"},
    {"|>",    "p"},
    {"|)",    "d"},
    {"|<",    "k"},
    {"|=",    "f"},
    {"|/",    "v"},
    {"!<",    "k"},
    {"|-",    "h"},
    {"()",    "o"},
    {"]3",    "b"}, // alternative b
    {"!3",    "b"}, // alternative b
    {"|2",    "r"},
    {"/2",    "r"},
};

static std::string apply_multi_leet(const std::string& input) {
    std::string out;
    out.reserve(input.size());
    size_t i = 0;
    while (i < input.size()) {
        bool replaced = false;
        for (auto& [from, to] : MULTI_LEET) {
            if (input.compare(i, from.size(), from) == 0) {
                out += to;
                i += from.size();
                replaced = true;
                break;
            }
        }
        if (!replaced) out += input[i++];
    }
    return out;
}

// ---------- Single-char leet substitution ----------
// '1' → 'i': covers k1ll→kill, ch1ld→child, v1ct1m→victim.
// '|' → 'i': many people use pipe for i/l; 'i' is the more dangerous mapping.

static char leet_char(char c) {
    switch (c) {
        case '!': return 'i';
        case '$': return 's';
        case '%': return 'x';
        case '(': return 'c';
        case ')': return 'd';
        case '+': return 't';
        case '0': return 'o';
        case '1': return 'i'; // k1ll→kill, ch1ld→child
        case '2': return 'z';
        case '3': return 'e';
        case '4': return 'a';
        case '5': return 's';
        case '6': return 'b';
        case '7': return 't';
        case '8': return 'b'; // 8itch→bitch
        case '9': return 'g';
        case '<': return 'c';
        case '@': return 'a';
        case '[': return 'c';
        case '^': return 'a';
        case '{': return 'c';
        case '|': return 'i';
        default:  return c;
    }
}

static std::string apply_single_leet(const std::string& input) {
    std::string out = input;
    for (char& c : out) c = leet_char(c);
    return out;
}

// ---------- Base64 decoder ----------

static const std::string B64_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static bool is_b64(char c) {
    return B64_CHARS.find(c) != std::string::npos || c == '=';
}

static std::string decode_base64(const std::string& enc) {
    std::string out;
    int val = 0, valb = -8;
    for (char c : enc) {
        if (c == '=') break;
        auto pos = B64_CHARS.find(c);
        if (pos == std::string::npos) continue;
        val = (val << 6) + static_cast<int>(pos);
        valb += 6;
        if (valb >= 0) {
            out += static_cast<char>((val >> valb) & 0xFF);
            valb -= 8;
        }
    }
    return out;
}

static std::string extract_and_decode_base64(const std::string& input) {
    std::string appended;
    size_t i = 0;
    while (i < input.size()) {
        if (is_b64(input[i]) && input[i] != '=') {
            size_t j = i;
            while (j < input.size() && is_b64(input[j])) ++j;
            if (j - i >= 8) {
                std::string dec = decode_base64(input.substr(i, j - i));
                bool printable = !dec.empty();
                for (char c : dec)
                    if (c < 0x20 || c > 0x7e) { printable = false; break; }
                if (printable) appended += " " + dec;
            }
            i = j;
        } else {
            ++i;
        }
    }
    return appended;
}

// ---------- Public API ----------

std::string normalize_text(const std::string& input) {
    // Order matters:
    // 1. Homoglyphs first (converts multi-byte Unicode lookalikes to ASCII)
    std::string text = apply_homoglyphs(input);

    // 2. Multi-char leet clusters (|3 → b, \/ → v, etc.) before single-char
    //    so that a cluster isn't broken by single-char rules
    text = apply_multi_leet(text);

    // 3. Single-char leet (0→o, 1→i, 4→a, @→a, etc.)
    text = apply_single_leet(text);

    // 4. Append any base64-decoded substrings found in the ORIGINAL input
    //    (use original so leetspeak hasn't mangled the b64 alphabet)
    std::string b64 = extract_and_decode_base64(input);
    if (!b64.empty()) text += b64;

    return text;
}
