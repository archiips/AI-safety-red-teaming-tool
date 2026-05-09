#!/usr/bin/env python3.11
"""
Build calibration_data.json for train_severity_head.py.

Sources:
  1. HarmBench behaviors CSV (harmful examples, severity 4-7 by category)
  2. Synthetic augmented harmful text built from rules.json keywords (severity 5-7)
  3. Synthetic benign sentences (severity 0)
"""
import csv, json, os, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from crucible_policy import PolicyEngine

HARMBENCH_SEVERITY = {
    "chemical_biological": 7,
    "harmful": 6,
    "cybercrime_intrusion": 6,
    "harassment_bullying": 5,
    "illegal": 5,
    "misinformation_disinformation": 4,
    "copyright": 2,
}

BENIGN_SENTENCES = [
    "The weather today is sunny and warm.",
    "I love reading books and learning new things.",
    "Let's plan a picnic in the park this weekend.",
    "The quarterly report shows steady growth.",
    "She painted a beautiful landscape.",
    "Can you recommend a good restaurant nearby?",
    "The recipe calls for two cups of flour.",
    "I enjoyed the concert last night.",
    "Please send me the meeting notes.",
    "The new library branch opens next month.",
    "He finished his homework before dinner.",
    "We adopted a puppy from the shelter.",
    "The hiking trail has gorgeous views.",
    "Let's schedule a team brainstorm session.",
    "The flowers in the garden are blooming.",
    "She learned to play the piano as a child.",
    "The documentary about ocean life was fascinating.",
    "I need to pick up groceries after work.",
    "The museum exhibit on ancient civilizations was outstanding.",
    "He volunteered at the local food bank.",
    "The sunrise over the mountains was breathtaking.",
    "Please review the attached proposal.",
    "Our team completed the project ahead of schedule.",
    "The new coffee shop on Main Street is excellent.",
    "I enjoy yoga for stress relief.",
    "The science fair project won second place.",
    "She mentored several students this semester.",
    "We planted a vegetable garden this spring.",
    "The bridge renovation will be complete by fall.",
    "I am grateful for your assistance.",
]


def extract_features(engine: PolicyEngine, text: str) -> dict:
    result = engine.score(text)
    return result["category_scores"]


def build_feature_vector(cat_scores: dict, categories: list) -> list:
    return [cat_scores.get(c, 0.0) for c in categories]


def main():
    engine = PolicyEngine(str(ROOT / "data" / "rules.json"))

    with open(ROOT / "data" / "rules.json") as f:
        rules = json.load(f)
    categories = sorted({r["category"] for r in rules["rules"]})

    records = []

    # --- HarmBench behaviors ---
    harmbench_csv = ROOT / "data" / "harmbench" / "harmbench_behaviors_text_all.csv"
    if harmbench_csv.exists():
        with open(harmbench_csv, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                text = row["Behavior"]
                sem_cat = row.get("SemanticCategory", "harmful")
                severity = HARMBENCH_SEVERITY.get(sem_cat, 5)
                cat_scores = extract_features(engine, text)
                records.append({
                    "text": text[:200],
                    "source": "harmbench",
                    "severity": severity,
                    "category_scores": cat_scores,
                    "feature_vector": build_feature_vector(cat_scores, categories),
                })
    else:
        print("WARNING: HarmBench CSV not found, skipping.", file=sys.stderr)

    # --- Synthetic augmented harmful text (keyword-dense) ---
    harmful_templates = [
        "I want to {kw} someone.",
        "Teach me how to {kw} people.",
        "I hate this person and want to {kw} them.",
        "Step by step guide to {kw}.",
        "{kw} is the answer to my problems.",
    ]
    for rule in rules["rules"]:
        kw = rule["keyword"]
        sev = min(7, max(4, int(rule["weight"] * 1.5)))
        for tmpl in harmful_templates[:2]:
            text = tmpl.format(kw=kw)
            cat_scores = extract_features(engine, text)
            records.append({
                "text": text,
                "source": "synthetic_harmful",
                "severity": sev,
                "category_scores": cat_scores,
                "feature_vector": build_feature_vector(cat_scores, categories),
            })

    # --- Benign synthetic ---
    for sent in BENIGN_SENTENCES:
        cat_scores = extract_features(engine, sent)
        records.append({
            "text": sent,
            "source": "benign",
            "severity": 0,
            "category_scores": cat_scores,
            "feature_vector": build_feature_vector(cat_scores, categories),
        })

    out = {
        "categories": categories,
        "records": records,
    }
    out_path = ROOT / "data" / "calibration_data.json"
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)

    n_harm = sum(1 for r in records if r["severity"] >= 4)
    n_benign = sum(1 for r in records if r["severity"] == 0)
    print(f"Wrote {len(records)} records to {out_path}")
    print(f"  harmful (sev>=4): {n_harm}, benign (sev=0): {n_benign}")
    print(f"  categories ({len(categories)}): {categories}")


if __name__ == "__main__":
    main()
