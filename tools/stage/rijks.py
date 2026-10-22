"""Rijksmuseum staging: OAI-PMH set 261208 (paintings), public domain / CC0, with images (adapter rijks.meta)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import C, stage  # noqa: E402

A = C.ADAPTERS["rijks"]
raw = A.meta(C, resume=True)
meta = C.load_meta("rijks")
stage("rijks", meta.get("found") or len(raw), raw, lambda x: C.norm_record("rijks", x), "CC0",
      lambda x: f"https://www.rijksmuseum.nl/en/collection/{x.get('objnum')}" if x.get("objnum") else f"https://id.rijksmuseum.nl/{x['id']}")
