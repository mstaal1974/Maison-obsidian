# Scentprint™

A Scentprint is a normalized profile in the same 16-dimensional space as a fragrance: warm, fresh, sweet, dark, woody, leather, marine, powdery, floral, fruit, green, spicy, resinous, luxury, projection and longevity. Values are bounded from 0 to 1 and carry `model_version` so scores remain reproducible.

The baseline builder maps curated weighted accords to dimensions and peak-normalizes the output. A customer profile averages explicit liked-fragrance vectors or accepts direct preference sliders. Similarity is cosine distance, not text matching. Zero vectors score zero and incomplete fragrance vectors are excluded.

Future models must be evaluated offline, versioned, explainable by contributing dimensions and monitored for coverage and drift. Scentprint™ is preference assistance—not an objective statement of quality—and customer data requires consent, retention controls and deletion support.
