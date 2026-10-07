"""Source adapters for tools/corpus.py, one module per museum (met, nga, rijks, smk).

Each module defines:
  INFO                 name, api, license, gap (seconds between requests), workers (threads sharing that gap)
  meta(C, resume)      fetch and cache the museum's public-domain paintings; writes research/_raw/<src>/meta.json
                       through C.write_meta and returns its rows (each row has an "id")
  group_key(x)         album / manuscript group for corpus.select()
  image_urls(x)        the image URLs to try, in order, for the ~400 px analysis copy
  norm(C, x)           -> dict(id, src, t, a, y, span, co, mv, img), the corpus row before the palette is added
`C` is the tools/corpus.py module itself (fetch, clean_artist, country_of, ...), passed in to avoid a circular import.
"""
