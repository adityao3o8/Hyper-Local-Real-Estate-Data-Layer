# Eval results

Run: 2026-11-20 - 64/65 passed (+2 informational)

Network services (Nominatim, Overpass, Groq, SerpAPI) are mocked; scoring runs against the real local datasets.

## fuzzy

| Check | Expected | Actual | Result |
|---|---|---|---|
| identical strings = 100 | 100 | 100 | PASS |
| substring found inside longer string | 100 | 100 | PASS |
| spacing variant 'Indira Nagar' ~ 'Indiranagar' | >= 85 | 96 | PASS |
| unrelated localities do not match | < 85 | 10 | PASS |
| empty input = 0 | 0 | 0 | PASS |
| token-set handles word reordering | >= 85 | 100 | PASS |

## geo

| Check | Expected | Actual | Result |
|---|---|---|---|
| same point = 0 km | 0 | 0 | PASS |
| Bengaluru to Mysuru straight-line ~127 km (+-3) | 124-130 | 128.0 | PASS |

## signal

| Check | Expected | Actual | Result |
|---|---|---|---|
| 80 -> MODERATE (boundary) | MODERATE | MODERATE | PASS |
| 80.1 -> STRONG BUY | STRONG BUY | STRONG BUY | PASS |
| 60 -> MODERATE | MODERATE | MODERATE | PASS |
| 59.9 -> AVOID | AVOID | AVOID | PASS |

## score

| Check | Expected | Actual | Result |
|---|---|---|---|
| no RERA match -> rera_score is null (no invented number) | null | null | PASS |
| no RERA match -> flagged rera_data_available = false | false | false | PASS |
| no RERA match -> avg_complaints null | null | null | PASS |
| zero amenities -> amenity_score 0 | 0 | 0 | PASS |
| no RERA data -> overall = amenity score alone (0) | 0 | 0 | PASS |
| RERA data + zero amenities -> 0.45 * rera_score | 37.8 | 37.8 | PASS |
| Indiranagar: score within 0-100 | 0-100 | 49.3 | PASS |
| Indiranagar: amenities found within 3km | hospital>0 and school>0 | {"hospital":160,"school":126,"park":4,"metro":0} | PASS |
| Indiranagar: overall follows the documented blend | 49.3 | 49.3 | PASS |

## dataset

| Check | Expected | Actual | Result |
|---|---|---|---|
| pre-scored localities load | > 100 | 180 | PASS |
| all scores within 0-100 | 0 violations | 0 | PASS |
| stored score matches the documented blend (0.45/0.55, or amenity-only without RERA) | 0 violations | 0 | PASS |
| geocode failures in batch run | < 5% of localities | 10/190 (5.3%) | **FAIL** |
| amenity score does not saturate for most localities | < 50% at 100 | 8/180 at 100 | PASS |
| scores spread across the signal bands | no band > 80% of localities | 47/180 are STRONG BUY (median 64.2) | PASS |
| localities with no RERA match carry no invented RERA score | 0 violations | 0 | PASS |
| localities with no RERA match (shown as 'No data' in the UI) | informational | 130/180 (72%) | INFO |
| live RERA matching reproduces stored values (8 localities) | 0 mismatches | 0 | PASS |

## matching

| Check | Expected | Actual | Result |
|---|---|---|---|
| precision proxy for "Whitefield" | >= 90% literally contain the name | 100% of 9 | PASS |
| precision proxy for "Koramangala" | >= 90% literally contain the name | 100% of 2 | PASS |
| precision proxy for "Indiranagar" | >= 90% literally contain the name | 100% of 0 | PASS |
| precision proxy for "HSR Layout" | >= 90% literally contain the name | 100% of 0 | PASS |
| precision proxy for "Jayanagar" | >= 90% literally contain the name | 100% of 2 | PASS |
| precision proxy for "Hebbal" | >= 90% literally contain the name | 100% of 3 | PASS |
| precision proxy for "Yelahanka" | >= 90% literally contain the name | 100% of 0 | PASS |
| precision proxy for "Marathahalli" | >= 90% literally contain the name | 100% of 0 | PASS |
| RERA records that have a locality field (a property of the scraped data) | informational | 1021/9645 (11%) | INFO |
| 'Agara' does not match every '...Nagara' project | < 10 matches | 0 | PASS |
| 'Jayanagar' does not match 'Vijayanagara' projects | 0 non-Jayanagar matches | 0 | PASS |
| typo/spacing variants still match ('White Field' = 'Whitefield') | same count | 9 vs 9 | PASS |

## prices

| Check | Expected | Actual | Result |
|---|---|---|---|
| parses crore (1.2 Cr = 12,000,000) | 12000000 present | 12000000,8500000,4500000 | PASS |
| parses lakh (85 Lakh = 8,500,000) | 8500000 present | 12000000,8500000,4500000 | PASS |
| parses 'Lac' spelling (45 Lac = 4,500,000) | 4500000 present | 12000000,8500000,4500000 | PASS |
| parses per-sq-ft (7,500) | 7500 | 7500 | PASS |
| no false price from area/BHK text | 0 mentions | 0 | PASS |
| a currency-prefixed 'L' still parses (45 L = 4,500,000) | 4500000 | 4500000 | PASS |
| empty search results -> no crash, no bands | no bands | [null,null] | PASS |
| SerpAPI 500 -> error field set, does not throw | error set | SerpAPI HTTP 500 | PASS |

## report

| Check | Expected | Actual | Result |
|---|---|---|---|
| trims model output | A fine paragraph. | A fine paragraph. | PASS |
| prompt carries the score data and the no-invention rule | both present | true | PASS |
| request caps output length (max_tokens) | 400 | 400 | PASS |
| Groq error surfaces as exception | throws | true | PASS |

## route

| Check | Expected | Actual | Result |
|---|---|---|---|
| missing locality -> 422 | 422 | 422 | PASS |
| unknown place (geocode fails) -> 404 | 404 | 404 | PASS |
| happy path -> 200 | 200 | 200 | PASS |
| response has all documented fields | none missing | none missing | PASS |
| map amenities returned | > 0 | 244 | PASS |
| Groq down -> still 200 with score and map | 200 | 200 | PASS |
| Groq down -> fallback text and ai_report_available=false | flag false + message | false / The AI summary is temporarily unavailabl | PASS |
| missing GROQ key -> clear config error | 500 | 500 | PASS |
| geocode far outside Bangalore is rejected (404) | 404 | 404 | PASS |

## geocode

| Check | Expected | Actual | Result |
|---|---|---|---|
| skips an out-of-Bangalore hit and takes the next in-bounds result | 12.97 | 12.97 | PASS |
| '4th Block, 5th Block Jayanagar' resolves via simplified fallback | resolves to Jayanagar | 12.92 after 3 queries | PASS |
| nothing found anywhere -> GeocodeError | GeocodeError | true | PASS |

## parity

| Check | Expected | Actual | Result |
|---|---|---|---|
| ratio / partialRatio / tokenSetRatio equal fuzzywuzzy on 14 pairs (42 values) | 0 differences | 0 differences | PASS |

## Matching audit detail

- Whitefield: 9 matched, 9 literally contain "WHITEFIELD", 0 fuzzy-only
- Koramangala: 2 matched, 2 literally contain "KORAMANGALA", 0 fuzzy-only
- Indiranagar: 0 matched, 0 literally contain "INDIRANAGAR", 0 fuzzy-only
- HSR Layout: 0 matched, 0 literally contain "HSR", 0 fuzzy-only
- Jayanagar: 2 matched, 2 literally contain "JAYANAGAR", 0 fuzzy-only
- Hebbal: 3 matched, 3 literally contain "HEBBAL", 0 fuzzy-only
- Yelahanka: 0 matched, 0 literally contain "YELAHANKA", 0 fuzzy-only
- Marathahalli: 0 matched, 0 literally contain "MARATHAHALLI", 0 fuzzy-only
