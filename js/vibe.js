"use strict";
// Nearest paintings by vibe (the CLIP fingerprints behind By vibe), for the Keep exploring feed and anything else that wants them.
//   vibeNeighbors(i, k) -> Promise<[{i, sim}]>   the k (<= 60) most alike paintings to gallery index i, nearest first;
//                                                sim is 0..1 (cosine 0.5..1.0 mapped to 0..1), show it only qualitatively.
// Data: data/gallery/vibe/NNN.bin, 1024 paintings per shard, 60 x (u24 index LE + u8 sim) each (tools/vibe_knn.py). One shard is
// fetched on first need and kept (LRU of 6). Goes through the loader's fetch wrapper (?v= and the R2 base). [] on any failure.
const VIBE_K = 60, VIBE_SHARD = 1024, VIBE_REC = VIBE_K * 4, VIBE_KEEP = 6;
const VIBE_CACHE = new Map();   // shard -> Promise<Uint8Array|null>, oldest first

function vibeShard(s) {
  let p = VIBE_CACHE.get(s);
  if (p) { VIBE_CACHE.delete(s); VIBE_CACHE.set(s, p); return p; }
  p = fetch("data/gallery/vibe/" + String(s).padStart(3, "0") + ".bin")
    .then(r => r.ok ? r.arrayBuffer() : null).then(b => b ? new Uint8Array(b) : null).catch(() => null);
  p.then(b => { if (!b && VIBE_CACHE.get(s) === p) VIBE_CACHE.delete(s); });   // never keep a failure
  VIBE_CACHE.set(s, p);
  while (VIBE_CACHE.size > VIBE_KEEP) VIBE_CACHE.delete(VIBE_CACHE.keys().next().value);
  return p;
}

function vibeNeighbors(i, k) {
  try {
    i = i | 0; if (i < 0) return Promise.resolve([]);
    const want = Math.max(0, Math.min(VIBE_K, k == null ? VIBE_K : k | 0));
    return vibeShard(Math.floor(i / VIBE_SHARD)).then(b => {
      const o = (i % VIBE_SHARD) * VIBE_REC;
      if (!b || b.length < o + VIBE_REC) return [];
      const out = [];
      for (let j = 0; j < want; j++) { const q = o + j * 4; out.push({ i: b[q] | (b[q + 1] << 8) | (b[q + 2] << 16), sim: b[q + 3] / 255 }); }
      return out;
    }).catch(() => []);
  } catch (e) { return Promise.resolve([]); }
}
