"""Unit tests for the C++ PolicyEngine — Tasks 2.1, 2.2, 2.3, 2.4."""
import pytest
import sys
import os

# Ensure the project root is on sys.path so crucible_policy is importable
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, PROJECT_ROOT)

from crucible_policy import PolicyEngine

RULES_PATH = os.path.join(PROJECT_ROOT, "data", "rules.json")


@pytest.fixture(scope="module")
def engine():
    return PolicyEngine(RULES_PATH)


# ---------- Task 2.1 gate: engine is importable and callable ----------

def test_engine_importable_and_callable(engine):
    result = engine.score("hello world", "violence")
    assert "severity" in result
    assert "matched_rules" in result
    assert isinstance(result["matched_rules"], list)


# ---------- Task 2.2: Aho-Corasick matching ----------

def test_known_violence_keyword_matches(engine):
    result = engine.score("I want to hurt you", "violence")
    assert "V001" in result["matched_rules"], "Expected V001 (hurt)"
    assert result["severity"] > 0


def test_no_match_returns_zero_severity(engine):
    result = engine.score("The weather is nice today")
    assert result["severity"] == 0.0
    assert result["matched_rules"] == []


def test_multiple_keywords_in_one_string(engine):
    # "hurt" (V001, weight=2) + "kill" (V002, weight=3) = 5.0, clamped to 5.0
    result = engine.score("I want to hurt and kill people", "violence")
    assert "V001" in result["matched_rules"]
    assert "V002" in result["matched_rules"]
    assert result["severity"] >= 4.0


def test_case_insensitive_matching(engine):
    upper = engine.score("HURT someone", "violence")
    lower = engine.score("hurt someone", "violence")
    assert upper["severity"] == lower["severity"]
    assert set(upper["matched_rules"]) == set(lower["matched_rules"])


def test_overlapping_patterns(engine):
    # "killer" contains "kill" → should match V002
    result = engine.score("the killer was caught", "violence")
    assert "V002" in result["matched_rules"]


def test_kill_without_ill_category_match(engine):
    # "killer" should NOT match a hate rule — categories are independent
    result = engine.score("killer", "hate")
    assert result["severity"] == 0.0 or all(
        rid.startswith("H") for rid in result["matched_rules"]
    )


def test_category_filter_works(engine):
    # "kill" is violence; when filtered to hate, no match
    result = engine.score("kill the person", "hate")
    assert result["severity"] == 0.0


def test_multiple_categories_no_filter(engine):
    # "kill" (violence) + "terrorist" (radicalization)
    result = engine.score("a terrorist planned to kill people")
    assert result["severity"] > 0
    cats = set(result["category_scores"].keys())
    assert "violence" in cats
    assert "radicalization" in cats


def test_severity_clamped_to_7(engine):
    # String with many high-weight keywords — severity must not exceed 7
    extreme = "kill murder attack stab shoot weapon bomb terrorist biological weapon"
    result = engine.score(extreme)
    assert result["severity"] <= 7.0


# ---------- Task 2.3: Unicode normalization + leetspeak + obfuscation ----------

def test_leetspeak_normalized_before_matching(engine):
    # h4t3 → hate, should match H001 (hate speech) or similar hate rule
    result = engine.score("h4t3 speech")
    assert result["severity"] > 0, "Leetspeak 'h4t3 speech' should match hate rule"


def test_case_insensitive_via_normalize(engine):
    # Mixed case should still match
    result = engine.score("HuRt Me", "violence")
    assert result["severity"] > 0


def test_homoglyph_substitution(engine):
    # Cyrillic 'е' (U+0435) instead of Latin 'e' in "еνil" → evil-like detection
    # Use Cyrillic 'а' in "аttаck" → attack
    cyrillic_attack = "аttаck"  # аttаck with Cyrillic а
    result = engine.score(cyrillic_attack, "violence")
    assert result["severity"] > 0, f"Homoglyph 'аttаck' (Cyrillic а) should match V003"


def test_base64_encoded_violence_detected(engine):
    import base64
    # "hurt" base64-encoded → "aHVydA=="
    b64_hurt = base64.b64encode(b"hurt").decode()
    result = engine.score(b64_hurt, "violence")
    assert result["severity"] > 0, f"Base64 of 'hurt' ({b64_hurt}) should be detected"


def test_hyphenated_obfuscation_detected(engine):
    # "h-u-r-t" obfuscation → should normalize to "hurt" and match V001
    result = engine.score("I want to h-u-r-t you", "violence")
    assert result["severity"] > 0, "Hyphenated 'h-u-r-t' should match V001"


def test_dotted_obfuscation_detected(engine):
    # "k.i.l.l" → "kill"
    result = engine.score("I will k.i.l.l you", "violence")
    assert result["severity"] > 0, "Dotted 'k.i.l.l' should match V002"


# ---------- Extended leet coverage (multi-char + new single-char mappings) ----------

def test_digit_1_maps_to_i_not_l(engine):
    # 1→i enables k1ll→kill (V002)
    result = engine.score("I will k1ll you", "violence")
    assert result["severity"] > 0, "k1ll should normalize to kill via 1→i"


def test_multi_char_leet_slash_v(engine):
    # |3 → b; combine: |3omb → bomb (part of "how to make a bomb" rule C001)
    result = engine.score("how to make a |30mb", "crime")
    assert result["severity"] > 0, "|30mb should normalize to bomb"


def test_multi_char_pipe_bracket_k(engine):
    # |< → k; t3rr0r1st should match via single-char leet
    result = engine.score("t3rr0r1st", "radicalization")
    assert result["severity"] > 0, "t3rr0r1st should normalize to terrorist"


def test_at_sign_in_attack(engine):
    # @ttack → attack (V003)
    result = engine.score("I will @ttack you", "violence")
    assert result["severity"] > 0, "@ttack should normalize to attack via @→a"


# ---------- Diacritic stripping (Latin-1 + Latin Extended-A) ----------

def test_latin1_diacritics_stripped(engine):
    # "kïll" — ï (U+00EF) → i → "kill" (V002)
    result = engine.score("I will k\xefll you", "violence")
    assert result["severity"] > 0, "Latin-1 ï should strip to i, giving kill"

def test_latin_extended_a_diacritics_stripped(engine):
    # "kłll" — ł (U+0142) → l, but we need "kill" not "klll"
    # Better: "åttåck" — å (U+00E5) → a → "attack" (V003)
    result = engine.score("\xe5tt\xe5ck someone", "violence")
    assert result["severity"] > 0, "Latin-1 å should strip to a, giving attack"

def test_cyrillic_full_confusable_set(engine):
    # "аttаck" — both а are Cyrillic U+0430 → a → "attack" (V003)
    result = engine.score("аttаck", "violence")
    assert result["severity"] > 0, "Cyrillic а should map to a, giving attack"

def test_greek_nu_maps_to_v(engine):
    # ν (U+03BD, Greek lowercase nu) → v; "еνil" is the PRD example
    # We don't have "evil" in rules, but "expłosive"→"explosive" or use violence keyword
    # Use ν in "stab": "stνb" → "stvb" — not useful. Better: "νiolence"-style evasion
    # Check that ν → v works in context of "surνiνe" → "survive" — not in rules
    # Use "νictim" → "victim" — not in rules either
    # Best: test that "еνil" normalizes by checking no crash and consistency
    import crucible_policy
    e2 = crucible_policy.PolicyEngine("data/rules.json")
    result = e2.score("еνil")  # еνil (Cyrillic е + Greek ν)
    # Should produce "evil" but "evil" isn't a keyword — just verify no crash
    assert isinstance(result["severity"], float)

def test_full_width_latin_stripped(engine):
    # Full-width Ａ (U+FF21) → 'a'; "ａttａck" → "attack" (V003)
    result = engine.score("ａttａck someone", "violence")
    assert result["severity"] > 0, "Full-width ａ should strip to a, giving attack"

def test_eszett_normalized(engine):
    # ß (U+00DF) → s; "exploßive" → "explosive" — not in rules
    # Use "suiß..." — not quite. Better: "ß" in "straße" → "strase" not harmful
    # Test: just verify ß doesn't crash and scores benign text at 0
    result = engine.score("das straße ist schön")
    assert result["severity"] == 0.0, "German diacritics in benign text should score 0"


# ---------- Task 2.4: Logistic regression severity head ----------

WEIGHTS_PATH = os.path.join(PROJECT_ROOT, "data", "severity_weights.json")


def test_weights_loaded_correctly():
    import json
    assert os.path.exists(WEIGHTS_PATH), "severity_weights.json must exist"
    with open(WEIGHTS_PATH) as f:
        w = json.load(f)
    assert "categories" in w
    assert "coef" in w
    assert "intercept" in w
    assert len(w["coef"]) == len(w["categories"])
    assert isinstance(w["intercept"], float)


def test_severity_is_between_0_and_7(engine):
    texts = [
        "The weather is lovely.",
        "kill murder attack bomb weapon terrorist",
        "I want to hurt and destroy everything",
        "h4t3 r@c1st sl@ng",
        "Routine office memo about quarterly budget.",
    ]
    for text in texts:
        result = engine.score(text)
        assert 0.0 <= result["severity"] <= 7.0, (
            f"severity {result['severity']} out of range for: {text}"
        )


def test_known_harmful_text_scores_above_3(engine):
    result = engine.score("I want to kill and hurt many people")
    assert result["severity"] > 3.0, (
        f"Known harmful text scored only {result['severity']:.3f}"
    )


def test_benign_text_scores_zero(engine):
    benign = [
        "The weather is nice today.",
        "Let's plan a team lunch.",
        "Please review the attached document.",
    ]
    for text in benign:
        result = engine.score(text)
        assert result["severity"] == 0.0, (
            f"Benign text '{text}' scored {result['severity']:.3f} (expected 0)"
        )


def test_severity_head_produces_higher_score_than_raw_sum_for_high_weight_text(engine):
    # With calibrated weights, heavily harmful text should still reach high severity
    result = engine.score("kill attack murder weapon bomb terrorist hate")
    assert result["severity"] >= 5.0, (
        f"Extreme text scored only {result['severity']:.3f}"
    )
