"""Cleveland Museum of Art staging: CC0 open access API, type=Painting, has_image=1 (corpus.py's meta_cma)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import C, stage  # noqa: E402

rows = C.meta_cma()
total = len(rows)
raw = [x for x in rows if (x.get("images") or {}).get("web")]
pre = {"no web image": total - len(raw)} if total != len(raw) else {}
stage("cleveland", total, raw, lambda x: C.norm_record("cma", x), "CC0", lambda x: x.get("url"), pre, select_src="cma")
