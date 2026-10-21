"""SMK staging: public-domain paintings with images (adapter smk.meta pages the search API, cached in scratch)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import C, stage  # noqa: E402

A = C.ADAPTERS["smk"]
raw = A.meta(C, resume=True)
meta = C.load_meta("smk")
stage("smk", meta.get("found") or len(raw), raw, lambda x: C.norm_record("smk", x), "CC0",
      lambda x: x.get("frontend_url") or f"https://open.smk.dk/artwork/image/{x['id']}")
