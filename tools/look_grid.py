#!/usr/bin/env python3
"""Even-grid smoothing for the painting map's "By look" (called by tools/look_layout.py; runs under the same clipenv venv).

The recursive median split (look_layout.even_grid) gives every painting one cell and keeps UMAP neighbors close, but the cuts are
straight lines through dense clouds: across a cut, cell neighbors are unrelated (a visible seam), and a tile of similar paintings gets
broken into patches. This module keeps the same cells and the same global arrangement and only SWAPS paintings between cells to
lower one number: the sum, over every pair of 4-neighbor cells, of the squared distance between the two paintings' CLIP vectors
(PCA-48 of the normalized vectors; for unit vectors squared distance is 2 x cosine distance).

  1. Moves, tried in sweeps over all cells in a fixed shuffled order (seeded numpy RandomState, numba loop: deterministic):
       - near swap:  cell a with a random cell within radius R of it (R shrinks 16 -> 1 over the sweeps);
       - targeted:   take a painting i, pick one of its 8 nearest paintings j (by picture) and swap i with a random cell beside j's cell,
                     i.e. "go and sit next to your look-alike". This is the move that can repair a seam, however far away it is.
  2. A swap is kept when the energy of the (at most 8) edges it touches goes down (or by Metropolis acceptance with a small, falling
     temperature in the first sweeps, so the grid can leave the median split's local minimum), else undone.
  3. The result is still exactly one painting per cell of the same W x H raster, so look.bin keeps its format.

Measures (printed by smoothness()): mean cosine distance between each cell and its right and down neighbor, in the raw 512-d CLIP space,
and the share of seams = neighbor edges whose distance is above the 90th percentile of the unsmoothed grid (a fixed threshold).
"""
import numpy as np
from numba import njit


def features(X, dim=48, seed=7):
    """PCA-48 of the prepared (unit, mean-centered) vectors, scaled so that the mean squared neighbor distance is easy to read."""
    rs = np.random.RandomState(seed)
    sub = X[rs.choice(len(X), min(60000, len(X)), replace=False)]
    mu = sub.mean(0)
    _, _, vt = np.linalg.svd(sub - mu, full_matrices=False)
    return ((X - mu) @ vt[:dim].T).astype(np.float32)


def knn(F, k=8, chunk=4096):
    """k nearest paintings by picture for every painting (torch matmul in chunks; exact)."""
    import torch
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    T = torch.from_numpy(F).to(dev)
    sq = (T * T).sum(1)
    out = np.zeros((len(F), k), np.int32)
    for s in range(0, len(F), chunk):
        d = sq[s:s + chunk, None] - 2 * T[s:s + chunk] @ T.T + sq[None, :]
        d[torch.arange(d.shape[0]), torch.arange(s, s + d.shape[0])] = 1e9
        out[s:s + chunk] = d.topk(k, largest=False).indices.cpu().numpy()
    return out


@njit(cache=True)
def _nbrs(c, W, N, out):
    x = c % W; y = c // W; m = 0
    if x > 0: out[m] = c - 1; m += 1
    if x < W - 1 and c + 1 < N: out[m] = c + 1; m += 1
    if y > 0: out[m] = c - W; m += 1
    if c + W < N: out[m] = c + W; m += 1
    return m


@njit(cache=True)
def _d(F, i, j):
    s = 0.0
    for t in range(F.shape[1]):
        v = F[i, t] - F[j, t]; s += v * v
    return s


@njit(cache=True)
def _local(F, occ, a, b, W, N, buf):
    """Energy of the edges touching cells a and b (the a-b edge, when they are neighbors, once)."""
    e = 0.0
    m = _nbrs(a, W, N, buf)
    for q in range(m): e += _d(F, occ[a], occ[buf[q]])
    m = _nbrs(b, W, N, buf)
    for q in range(m):
        if buf[q] != a: e += _d(F, occ[b], occ[buf[q]])
    return e


@njit(cache=True)
def _run(F, occ, where, K, W, N, sweeps, r0, t0, order, seed):
    np.random.seed(seed)
    buf = np.zeros(4, np.int64)
    acc = 0
    for sw in range(sweeps):
        frac = sw / max(1, sweeps - 1)
        R = max(1, int(r0 * (1 - frac)))
        temp = t0 * (1 - frac) if sw < sweeps // 2 else 0.0
        for q in range(N):
            a = order[(q + sw * 7919) % N]
            if np.random.random() < 0.5:
                b = -1
                x = a % W + np.random.randint(-R, R + 1); y = a // W + np.random.randint(-R, R + 1)
                if x >= 0 and x < W and y >= 0:
                    b = y * W + x
            else:
                i = occ[a]; j = K[i, np.random.randint(0, K.shape[1])]
                cj = where[j]
                m = _nbrs(cj, W, N, buf)
                b = buf[np.random.randint(0, m)] if m > 0 else -1
            if b < 0 or b >= N or b == a: continue
            before = _local(F, occ, a, b, W, N, buf)
            ia, ib = occ[a], occ[b]
            occ[a] = ib; occ[b] = ia
            after = _local(F, occ, a, b, W, N, buf)
            dl = after - before
            if dl < 0 or (temp > 0 and np.random.random() < np.exp(-dl / temp)):
                where[ib] = a; where[ia] = b; acc += 1
            else:
                occ[a] = ia; occ[b] = ib
    return acc


def refine(F, gx, gy, W, sweeps=150, r0=16, seed=3):
    """Swap-refine an assignment of paintings to cells. gx, gy: cell of each painting (0-based, first N cells of a W-wide raster)."""
    N = len(F)
    cell = gy.astype(np.int64) * W + gx.astype(np.int64)
    occ = np.zeros(N, np.int64); occ[cell] = np.arange(N)
    where = cell.copy()
    K = knn(F)
    sc = float(np.mean(((F[:2000] - F[2000:4000]) ** 2).sum(1)))   # typical random-pair squared distance: temperature scale
    order = np.random.RandomState(seed).permutation(N).astype(np.int64)
    acc = _run(F, occ, where, K, W, N, sweeps, r0, 0.02 * sc, order, seed)
    print(f"  grid smoothing: {acc} swaps kept over {sweeps} sweeps", flush=True)
    return (where % W).astype(np.int32), (where // W).astype(np.int32)


def edges(gx, gy, W, N):
    """Index pairs (a, b) of painting neighbors to the right and below."""
    cell = gy.astype(np.int64) * W + gx; occ = np.zeros(N, np.int64); occ[cell] = np.arange(N)
    c = np.arange(N); x = c % W
    r = c[(x < W - 1) & (c + 1 < N)]; d = c[c + W < N]
    return np.concatenate([occ[r], occ[d]]), np.concatenate([occ[r + 1], occ[d + W]])


def smoothness(E, gx, gy, W, thresh=None):
    """(mean cosine distance between neighbor cells in the raw CLIP space, share of seams above `thresh`, that threshold = 90th percentile when not given)."""
    N = len(E)
    a, b = edges(gx, gy, W, N)
    d = np.empty(len(a), np.float32)
    for s in range(0, len(a), 200000):
        d[s:s + 200000] = 1 - (E[a[s:s + 200000]] * E[b[s:s + 200000]]).sum(1) / (np.linalg.norm(E[a[s:s + 200000]], axis=1) * np.linalg.norm(E[b[s:s + 200000]], axis=1) + 1e-9)
    if thresh is None: thresh = float(np.percentile(d, 90))
    return float(d.mean()), float((d > thresh).mean()), thresh
