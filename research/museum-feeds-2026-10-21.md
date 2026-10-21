# Museum feeds staging, 2026-10-21: blocked

Nothing was collected. The session's network policy answered HTTP 403 to CONNECT for every museum API host, so no request reached any museum.

| Museum | Host | Result | API total | Already held | New staged | Dropped |
|---|---|---|---|---|---|---|
| The Met | collectionapi.metmuseum.org | 403 from proxy | not fetched | 165 | 0 | n/a |
| Cleveland | openaccess-api.clevelandart.org | 403 from proxy | not fetched | 2,620 | 0 | n/a |
| SMK | api.smk.dk | blocked (no connection) | not fetched | 2,823 | 0 | n/a |
| Rijksmuseum | data.rijksmuseum.nl | 403 from proxy | not fetched | 4,352 | 0 | n/a |

"Already held" is the current row count in data/corpus for each source. Fix: add the four hosts under Allowed domains in the environment's Network access settings, then re-run. The existing adapters in tools/museums/ (met, smk, rijks) and the cma adapter in tools/corpus.py already hold the filter and normalization logic to reuse.
