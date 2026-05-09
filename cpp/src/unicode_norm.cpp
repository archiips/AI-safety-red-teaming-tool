#include "severity.h"
#include <string>
#include <vector>
#include <cstdint>

// ---------- UTF-8 decoder ----------
// Returns the Unicode codepoint starting at input[pos] and advances pos.
// Returns 0xFFFD (replacement char) on invalid bytes.

static uint32_t decode_utf8(const std::string& s, size_t& pos) {
    unsigned char b0 = s[pos];
    if (b0 < 0x80) { ++pos; return b0; }
    if ((b0 & 0xE0) == 0xC0 && pos+1 < s.size()) {
        unsigned char b1 = s[pos+1];
        if ((b1 & 0xC0) == 0x80) {
            pos += 2;
            return ((b0 & 0x1F) << 6) | (b1 & 0x3F);
        }
    }
    if ((b0 & 0xF0) == 0xE0 && pos+2 < s.size()) {
        unsigned char b1 = s[pos+1], b2 = s[pos+2];
        if ((b1 & 0xC0) == 0x80 && (b2 & 0xC0) == 0x80) {
            pos += 3;
            return ((b0 & 0x0F) << 12) | ((b1 & 0x3F) << 6) | (b2 & 0x3F);
        }
    }
    if ((b0 & 0xF8) == 0xF0 && pos+3 < s.size()) {
        unsigned char b1 = s[pos+1], b2 = s[pos+2], b3 = s[pos+3];
        if ((b1&0xC0)==0x80 && (b2&0xC0)==0x80 && (b3&0xC0)==0x80) {
            pos += 4;
            return ((b0&0x07)<<18)|((b1&0x3F)<<12)|((b2&0x3F)<<6)|(b3&0x3F);
        }
    }
    ++pos;
    return 0xFFFD; // invalid — skip
}

// ---------- Codepoint → ASCII base letter ----------
// Returns '\0' if no mapping (caller emits the original UTF-8 bytes).
// Output is always lowercase — severity.cpp lowercases everything anyway.
//
// Coverage (300+ substitutions):
//   Latin-1 Supplement   U+00C0-U+00FF  ~62 codepoints
//   Latin Extended-A     U+0100-U+017F  128 codepoints
//   Cyrillic confusables U+0400-U+044F   36 codepoints
//   Greek confusables    U+0391-U+03C9   30 codepoints
//   Full-width Latin     U+FF21-U+FF5A   52 codepoints (formula)
// Plus multi-char leet (23) + single-char leet (22) = 353 total.

static char codepoint_to_ascii(uint32_t cp) {

    // ── Latin-1 Supplement (U+00C0–U+00FF) ──────────────────────────── ~62
    if (cp >= 0x00C0 && cp <= 0x00FF) {
        if (cp == 0x00D7 || cp == 0x00F7) return '\0'; // × ÷ — not letters
        // À Á Â Ã Ä Å Æ → a
        if (cp <= 0x00C6) return 'a';
        if (cp == 0x00C7) return 'c'; // Ç
        if (cp <= 0x00CB) return 'e'; // È É Ê Ë
        if (cp <= 0x00CF) return 'i'; // Ì Í Î Ï
        if (cp == 0x00D0) return 'd'; // Ð
        if (cp == 0x00D1) return 'n'; // Ñ
        if (cp <= 0x00D6) return 'o'; // Ò Ó Ô Õ Ö
        if (cp == 0x00D8) return 'o'; // Ø
        if (cp <= 0x00DC) return 'u'; // Ù Ú Û Ü
        if (cp == 0x00DD) return 'y'; // Ý
        if (cp == 0x00DE) return 't'; // Þ
        if (cp == 0x00DF) return 's'; // ß → s
        if (cp <= 0x00E6) return 'a'; // à á â ã ä å æ
        if (cp == 0x00E7) return 'c'; // ç
        if (cp <= 0x00EB) return 'e'; // è é ê ë
        if (cp <= 0x00EF) return 'i'; // ì í î ï
        if (cp == 0x00F0) return 'd'; // ð
        if (cp == 0x00F1) return 'n'; // ñ
        if (cp <= 0x00F6) return 'o'; // ò ó ô õ ö
        if (cp == 0x00F8) return 'o'; // ø
        if (cp <= 0x00FC) return 'u'; // ù ú û ü
        if (cp == 0x00FD) return 'y'; // ý
        if (cp == 0x00FE) return 't'; // þ
        if (cp == 0x00FF) return 'y'; // ÿ
        return '\0';
    }

    // ── Latin Extended-A (U+0100–U+017F) ────────────────────────────── 128
    // Ranges map every codepoint in the block to its base letter (lowercase).
    // severity.cpp lowercases the whole string after normalize_text() so
    // returning lowercase here is fine.
    if (cp >= 0x0100 && cp <= 0x017F) {
        if (cp <= 0x0105) return 'a'; // Āā Ăă Ąą
        if (cp <= 0x010D) return 'c'; // Ćć Ĉĉ Ċċ Čč
        if (cp <= 0x0111) return 'd'; // Ďď Đđ
        if (cp <= 0x011B) return 'e'; // Ēē Ĕĕ Ėė Ęę Ěě
        if (cp <= 0x0123) return 'g'; // Ĝĝ Ğğ Ġġ Ģģ
        if (cp <= 0x0127) return 'h'; // Ĥĥ Ħħ
        if (cp <= 0x0131) return 'i'; // Ĩĩ Īī Ĭĭ Įį İı
        if (cp <= 0x0133) return 'i'; // Ĳĳ → i (drop j component)
        if (cp <= 0x0135) return 'j'; // Ĵĵ
        if (cp <= 0x0138) return 'k'; // Ķķ ĸ
        if (cp <= 0x0142) return 'l'; // Ĺĺ Ļļ Ľľ Ŀŀ Łł
        if (cp <= 0x0148) return 'n'; // Ńń Ņņ Ňň
        if (cp <= 0x014B) return 'n'; // ŉ Ŋŋ
        if (cp <= 0x0153) return 'o'; // Ōō Ŏŏ Őő Œœ
        if (cp <= 0x0159) return 'r'; // Ŕŕ Ŗŗ Řř
        if (cp <= 0x0161) return 's'; // Śś Ŝŝ Şş Šš
        if (cp <= 0x0167) return 't'; // Ţţ Ťť Ŧŧ
        if (cp <= 0x0173) return 'u'; // Ũũ Ūū Ŭŭ Ůů Űű Ųų
        if (cp <= 0x0175) return 'w'; // Ŵŵ
        if (cp <= 0x0178) return 'y'; // Ŷŷ Ÿ
        if (cp <= 0x017E) return 'z'; // Źź Żż Žž
        if (cp == 0x017F) return 's'; // ſ long-s
        return '\0';
    }

    // ── Cyrillic visual confusables (U+0400–U+044F) ─────────────────── ~36
    switch (cp) {
        case 0x0400: case 0x0450: return 'e'; // Ѐ ѐ (È with grave)
        case 0x0401: case 0x0451: return 'e'; // Ё ё
        case 0x0404: case 0x0454: return 'e'; // Є є (Ukrainian Ye)
        case 0x0406: case 0x0456: return 'i'; // І і (Ukrainian I)
        case 0x0407: case 0x0457: return 'i'; // Ї ї
        case 0x0410: case 0x0430: return 'a'; // А а
        case 0x0412: case 0x0432: return 'b'; // В в (looks like B)
        case 0x0415: case 0x0435: return 'e'; // Е е
        case 0x0417: case 0x0437: return 'z'; // З з (looks like Z/3)
        case 0x0418: case 0x0438: return 'i'; // И и
        case 0x0419: case 0x0439: return 'i'; // Й й (short И)
        case 0x041A: case 0x043A: return 'k'; // К к
        case 0x041B: case 0x043B: return 'l'; // Л л
        case 0x041C: case 0x043C: return 'm'; // М м
        case 0x041D: case 0x043D: return 'h'; // Н н (looks like H)
        case 0x041E: case 0x043E: return 'o'; // О о
        case 0x041F: case 0x043F: return 'n'; // П п (looks like n/π)
        case 0x0420: case 0x0440: return 'p'; // Р р (looks like P)
        case 0x0421: case 0x0441: return 'c'; // С с
        case 0x0422: case 0x0442: return 't'; // Т т
        case 0x0423: case 0x0443: return 'y'; // У у
        case 0x0424: case 0x0444: return 'f'; // Ф ф
        case 0x0425: case 0x0445: return 'x'; // Х х
        case 0x042A: case 0x044A: return 'b'; // Ъ ъ (hard sign, looks like b)
        case 0x042C: case 0x044C: return 'b'; // Ь ь (soft sign, looks like b)
        case 0x042D: case 0x044D: return 'e'; // Э э (backwards E)
        case 0x042F: case 0x044F: return 'r'; // Я я (backwards R)
        default: break;
    }

    // ── Greek visual confusables (U+0391–U+03C9) ────────────────────── ~30
    switch (cp) {
        case 0x0391: case 0x03B1: return 'a'; // Α α
        case 0x0392: case 0x03B2: return 'b'; // Β β
        case 0x0395: case 0x03B5: return 'e'; // Ε ε
        case 0x0396: case 0x03B6: return 'z'; // Ζ ζ
        case 0x0397: case 0x03B7: return 'h'; // Η η (looks like H)
        case 0x0399: case 0x03B9: return 'i'; // Ι ι
        case 0x039A: case 0x03BA: return 'k'; // Κ κ
        case 0x039C: case 0x03BC: return 'm'; // Μ μ
        case 0x039D: return 'n';              // Ν (capital Nu, looks like N)
        case 0x03BD: return 'v';              // ν (lowercase nu, looks like v)
        case 0x039F: case 0x03BF: return 'o'; // Ο ο
        case 0x03A1: case 0x03C1: return 'p'; // Ρ ρ
        case 0x03A4: case 0x03C4: return 't'; // Τ τ
        case 0x03A5: case 0x03C5: return 'u'; // Υ υ
        case 0x03A7: case 0x03C7: return 'x'; // Χ χ
        case 0x03C9: return 'w';              // ω (omega, looks like w)
        default: break;
    }

    // ── Full-width Latin (U+FF21–U+FF5A) ─────────────────────────────── 52
    // Ａ-Ｚ (FF21-FF3A) and ａ-ｚ (FF41-FF5A)
    if (cp >= 0xFF21 && cp <= 0xFF3A) return (char)('a' + (cp - 0xFF21));
    if (cp >= 0xFF41 && cp <= 0xFF5A) return (char)('a' + (cp - 0xFF41));

    return '\0';
}

// Apply Unicode normalization: replace confusable codepoints with ASCII,
// pass unrecognised multi-byte sequences through unchanged.
static std::string apply_unicode_norm(const std::string& input) {
    std::string out;
    out.reserve(input.size());
    size_t i = 0;
    size_t orig_i;
    while (i < input.size()) {
        orig_i = i;
        uint32_t cp = decode_utf8(input, i);
        if (cp < 0x80) {
            out += (char)cp;
        } else {
            char asc = codepoint_to_ascii(cp);
            if (asc != '\0') {
                out += asc;
            } else {
                // No mapping — emit original bytes verbatim
                for (size_t k = orig_i; k < i; ++k) out += input[k];
            }
        }
    }
    return out;
}

// ---------- Multi-char leet substitutions (apply before single-char) ----------
// Sorted longest-first so longer patterns win over their prefixes.

static const std::vector<std::pair<std::string, std::string>> MULTI_LEET = {
    // 4-char
    {"|\\/|", "m"},
    // 3-char
    {"|/|",   "m"},
    {"|\\|",  "n"},
    {"\\/\\/","w"},
    {"|_|",   "u"},
    {"|-|",   "h"},
    {"(_)",   "u"},
    // 2-char
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
    {"]3",    "b"},
    {"!3",    "b"},
    {"|2",    "r"},
    {"/2",    "r"},
    {"33",    "e"}, // double-3 for emphasis: h33t → heet → not useful, but harmless
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

// ---------- Single-char leet substitution (22 mappings) ----------
static char leet_char(char c) {
    switch (c) {
        case '!': return 'i';
        case '$': return 's';
        case '%': return 'x';
        case '(': return 'c';
        case ')': return 'd';
        case '+': return 't';
        case '0': return 'o';
        case '1': return 'i'; // k1ll→kill, ch1ld→child, v1ct1m→victim
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

static const char* B64 =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static bool is_b64(char c) {
    for (int i = 0; i < 64; ++i) if (B64[i] == c) return true;
    return c == '=';
}

static std::string decode_base64(const std::string& enc) {
    // Build a lookup table on first call
    static int tbl[256] = {};
    static bool init = false;
    if (!init) {
        for (int i = 0; i < 256; ++i) tbl[i] = -1;
        for (int i = 0; i < 64; ++i) tbl[(unsigned char)B64[i]] = i;
        init = true;
    }
    std::string out;
    int val = 0, valb = -8;
    for (unsigned char c : enc) {
        if (c == '=') break;
        if (tbl[c] < 0) continue;
        val = (val << 6) + tbl[c];
        valb += 6;
        if (valb >= 0) { out += (char)((val >> valb) & 0xFF); valb -= 8; }
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
                for (unsigned char c : dec)
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
    // 1. Unicode confusables: Cyrillic/Greek/Latin-diacritics → ASCII base letters
    std::string text = apply_unicode_norm(input);

    // 2. Multi-char leet clusters (|3→b, \/→v, /\→a, |_|→u …) before single-char
    //    so prefixes of clusters aren't consumed first
    text = apply_multi_leet(text);

    // 3. Single-char leet (0→o, 1→i, 4→a, @→a, $→s …)
    text = apply_single_leet(text);

    // 4. Append decoded base64 found in the ORIGINAL input
    //    (use original so the leet pass hasn't broken the b64 alphabet)
    std::string b64 = extract_and_decode_base64(input);
    if (!b64.empty()) text += b64;

    return text;
}
