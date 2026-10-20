#!/usr/bin/env python3
"""Unit tests for the vivid color measurement (tools/corpus.py palette_of / pick_pool, METHOD vivid-v2).
  python3 tools/palette_test.py
A synthetic painting: a big muted ochre ground, a mid-brown band, and two tiny vivid details (a 4% red dress and a 0.5% navy suit).
Both the six and the pool must hold the red and the navy as real pixels (not muddy means), and the output must be deterministic."""
import sys, tempfile, os
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
import corpus as C
import gallery as G


def make(path):
    rng = np.random.default_rng(3)
    a = np.zeros((200, 160, 3), np.float64)
    a[:] = (176, 160, 110)
    a[120:, :] = (110, 78, 50)
    a[30:38, 20:70] = (156, 65, 41)      # red dress ~4%
    a[60:65, 100:135] = (29, 43, 75)     # navy suit ~0.5%
    a += rng.normal(0, 2.5, a.shape)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(path, quality=95)


def near(cols_hex, target, de=7.0):
    lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for h in cols_hex]))
    t = C.rgb_to_lab(np.array([C.hex_to_rgb(target)]))
    return float(C.de2000(t, lab).min()) <= de


def main():
    d = tempfile.mkdtemp()
    p = os.path.join(d, "t.jpg")
    make(p)
    r1, r2 = C.palette_of(p), C.palette_of(p)
    assert r1 == r2, "palette_of must be deterministic"
    assert r1["m"] == C.METHOD, "every palette line carries the METHOD it was made with"
    assert abs(sum(r1["share"]) - 1) < 0.01, "shares sum to 1"
    six = [C.rgb_to_hex(c) for c in C.lab_to_rgb(np.array(r1["lab"]))]
    pool = [h for h, _ in G.extract_pool(p)]
    assert pool == [h for h, _ in G.extract_pool(p)], "extract_pool must be deterministic"
    for name, cols in (("six", six), ("pool", pool)):
        assert near(cols, "#9C4129"), f"{name} lost the red dress: {cols}"
        assert near(cols, "#1D2B4B", 9.0), f"{name} lost the navy suit: {cols}"
    assert len(pool) <= G.POOL
    print("palette_test: ok", six)


if __name__ == "__main__":
    main()
