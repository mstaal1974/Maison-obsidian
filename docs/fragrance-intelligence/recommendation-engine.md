# Recommendation engine

The candidate stage retrieves vectorized, active fragrances and applies hard constraints such as budget and availability. The scorer compares the customer's Scentprint with each fragrance vector using cosine similarity. Contextual reranking may then incorporate season, weather, occasion, personality, collections, previous purchases and a diversity penalty.

Every response should expose its vector similarity and, in later releases, the top contributing dimensions and contextual adjustments. Previous purchases can seed preferences but must not create a popularity-only feedback loop. Layering uses its own curated compatibility evidence.

Evaluation uses held-out interactions and expert panels. Primary measures are precision@k, recall@k, coverage, intra-list diversity, calibration and cold-start performance. Model releases require a versioned dataset, thresholds, rollback plan and bias review.
