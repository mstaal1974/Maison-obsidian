# API

FastAPI publishes interactive OpenAPI at `/docs`. `GET /brands` lists houses; `/fragrances` filters by brand/family; `/fragrance/{id}` returns the complete fragrance object; `/search` searches names, brands, family and description; `/similar` ranks vector neighbors; `/clone` and `/layering` expose relationships. `POST /recommend` accepts context plus a vector; `/scentprint` creates a profile vector.

List limits are bounded. Unknown primary resources return 404. Scores are normalized decimals, while clone/layering compatibility uses 0–100. Clients must treat nullable enrichment as incomplete knowledge, not zero. Before external release add `/v1`, OAuth2 scopes, pagination cursors, standard error envelopes, rate limits and cache headers.
