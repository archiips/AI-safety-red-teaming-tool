#!/usr/bin/env python3.11
"""
Train a binary logistic regression severity head on calibration_data.json.

Exports data/severity_weights.json with:
  {
    "categories": [...],        # feature order (must match C++ SeverityHead)
    "coef": [...],              # one float per category
    "intercept": float,
    "note": "sigmoid(coef·x + intercept) × 7 gives severity in [0,7]"
  }
"""
import json
import numpy as np
from pathlib import Path
from sklearn.linear_model import LogisticRegression
from sklearn.isotonic import IsotonicRegression
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).parent.parent


def load_data(path: Path):
    with open(path) as f:
        d = json.load(f)
    categories = d["categories"]
    X = np.array([r["feature_vector"] for r in d["records"]], dtype=float)
    y_raw = np.array([r["severity"] for r in d["records"]], dtype=float)
    # Binary label: harmful = severity >= 4
    y_binary = (y_raw >= 4).astype(int)
    return categories, X, y_raw, y_binary


def main():
    calib_path = ROOT / "data" / "calibration_data.json"
    if not calib_path.exists():
        print("calibration_data.json not found — run prepare_training_data.py first")
        return

    categories, X, y_raw, y_binary = load_data(calib_path)
    print(f"Loaded {len(X)} samples, {X.shape[1]} features, "
          f"{y_binary.sum()} harmful, {(y_binary == 0).sum()} benign")

    # Keep only: benign examples (all zeros, label=0) OR harmful examples that
    # triggered at least one AC hit (non-zero features, label=1).
    # Zero-feature harmful entries (HarmBench behaviors that bypassed keyword
    # matching) are useless for calibration and bias the intercept upward.
    has_hits = (X.sum(axis=1) > 0)
    keep = has_hits | (y_binary == 0)
    X, y_raw, y_binary = X[keep], y_raw[keep], y_binary[keep]
    print(f"After filtering zero-feature harmful: {len(X)} samples, "
          f"{y_binary.sum()} harmful, {(y_binary == 0).sum()} benign")

    # Scale features (important for LR convergence)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Balanced weights compensate for class imbalance
    lr = LogisticRegression(C=1.0, max_iter=1000, random_state=42,
                            class_weight="balanced")
    lr.fit(X_scaled, y_binary)

    cv_scores = cross_val_score(lr, X_scaled, y_binary, cv=min(5, len(X) // 10), scoring="roc_auc")
    print(f"CV ROC-AUC: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    # P(harmful) from LR
    proba = lr.predict_proba(X_scaled)[:, 1]

    # Isotonic regression to calibrate P(harmful) → actual severity on 0–7
    # Sort by proba for isotonic regression (requires monotone relationship)
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=7.0)
    iso.fit(proba, y_raw)

    severity_pred = iso.predict(proba)
    mae = np.mean(np.abs(severity_pred - y_raw))
    print(f"Isotonic calibration MAE vs raw severity: {mae:.3f}")

    # We store the LR coefficients (in original feature space) and the scaler
    # so C++ can replicate: z = coef · x_scaled + intercept
    # where x_scaled = (x - mean) / std
    # Equivalent: z = (coef / std) · x + (intercept - coef · mean / std)
    # → fold scaler into a single coef + intercept vector (no need for scaler in C++)
    std = scaler.scale_
    mean = scaler.mean_
    lr_coef = lr.coef_[0]  # shape (n_features,)
    lr_intercept = lr.intercept_[0]

    coef_orig = lr_coef / std
    intercept_orig = lr_intercept - np.dot(lr_coef / std, mean)

    out = {
        "categories": categories,
        "coef": coef_orig.tolist(),
        "intercept": float(intercept_orig),
        "note": "apply sigmoid(dot(coef, category_scores) + intercept) × 7 to get severity",
    }
    out_path = ROOT / "data" / "severity_weights.json"
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"Wrote severity weights to {out_path}")
    print(f"  intercept: {intercept_orig:.4f}")
    print(f"  coef (by category):")
    for cat, c in zip(categories, coef_orig):
        print(f"    {cat:20s}: {c:+.4f}")


if __name__ == "__main__":
    main()
