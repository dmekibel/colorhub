"""Download Smithsonian Open Access metadata shards (S3, no key) for one unit into $STAGE_SCRATCH/si/<unit>/.
usage: python3 tools/stage/si_shards.py fsg nmafa nmai"""
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import SCR  # noqa: E402

B = "https://smithsonian-open-access.s3-us-west-2.amazonaws.com/metadata/edan"
UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"


def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=120).read()


def grab(args):
    unit, u = args
    p = SCR / "si" / unit / u.rsplit("/", 1)[1]
    if p.exists() and p.stat().st_size:
        return
    for _ in range(3):
        try:
            p.write_bytes(get(u))
            return
        except Exception as e:
            err = e
    print("fail", u, err)


for unit in sys.argv[1:]:
    (SCR / "si" / unit).mkdir(parents=True, exist_ok=True)
    urls = get(f"{B}/{unit}/index.txt").decode().split()
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(grab, [(unit, u) for u in urls]))
    print(unit, len(urls), "shards")
