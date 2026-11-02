#!/usr/bin/env python3
"""Zero-shot island labels for the painting map's "By look" (called by tools/look_islands.py; runs under the clipenv venv).

The subject tags (Wikidata genre / depicts, title words, image model) name most islands well, but they can name one badly when the
tags are noisy: 184 George Catlin-style group drawings of Native American people were the 'Still life' end of a 'Flowers and still
lifes' island. CLIP can read the picture itself: ~70 plain phrases are embedded once with the same model, and each island's centroid
(mean of its paintings' unit CLIP vectors) is scored against them. Deterministic, no randomness; the text vectors are cached in
research/_raw/subjects/look-vocab-embeds.npy (keyed by a hash of this list).

  zero_shot(E, L, K) -> per island [(label, z, cos), ...] best three phrases as (label, kind, z, vote share). `z` is the phrase's score for this island against all
  islands (so a phrase that every island matches a bit does not win everywhere); the label is a short noun phrase for the map.
"""
import hashlib, os
from pathlib import Path
import numpy as np

# (CLIP prompt, label shown on the map, kind). kind groups phrases that mean the same family of subject: people / sacred / land / water /
# built / still / animal / flat (heraldry, text, maps, diagrams, abstract) / other
VOCAB = [
    ("a drawing of a group of Native American people standing", "Native American figures", "people"),
    ("a group of people standing in a row", "Figure groups", "people"),
    ("a group portrait of several people", "Group portraits", "people"),
    ("a portrait of a man", "Portraits of men", "people"),
    ("a portrait of a woman", "Portraits of women", "people"),
    ("a portrait of a child", "Children", "people"),
    ("a self-portrait of the painter", "Self-portraits", "people"),
    ("a painting of a nude woman", "Nudes", "people"),
    ("a painting of a mother with her children", "Families", "people"),
    ("a painting of dancers", "Dancers", "people"),
    ("a painting of musicians playing instruments", "Musicians", "people"),
    ("a painting of peasants working in the fields", "Peasant scenes", "people"),
    ("a tavern scene with people drinking", "Tavern scenes", "people"),
    ("an interior room with people", "Interiors", "people"),
    ("a painting of soldiers in battle", "Battles", "people"),
    ("a hunting scene", "Hunting scenes", "people"),
    ("an orientalist painting of the Middle East", "Orientalist scenes", "people"),
    ("the Madonna and Child", "Madonnas", "sacred"),
    ("a painting of a saint with a halo", "Saints", "sacred"),
    ("the crucifixion of Christ", "Crucifixions", "sacred"),
    ("a religious altarpiece with gold background", "Altarpieces", "sacred"),
    ("a painting of angels", "Angels", "sacred"),
    ("a mythological scene with gods and goddesses", "Myths", "sacred"),
    ("a landscape with trees and a path", "Wooded landscapes", "land"),
    ("a landscape of mountains", "Mountains", "land"),
    ("a flat Dutch landscape with a big cloudy sky", "Dutch skies", "land"),
    ("a snowy winter landscape", "Winter scenes", "land"),
    ("a sunset over a field", "Sunsets", "land"),
    ("a night scene under the moon", "Night scenes", "land"),
    ("a river landscape", "Rivers", "water"),
    ("a seascape with sailing ships", "Ships at sea", "water"),
    ("waves on a beach", "Seashores", "water"),
    ("a harbor with boats", "Harbors", "water"),
    ("a view of a canal in Venice", "Venice views", "built"),
    ("a view of a city street", "City streets", "built"),
    ("a view of a village with houses", "Villages", "built"),
    ("the interior of a church", "Church interiors", "built"),
    ("ancient ruins", "Ruins", "built"),
    ("a castle on a hill", "Castles", "built"),
    ("a bouquet of flowers in a vase", "Flower bouquets", "still"),
    ("a still life of fruit on a table", "Fruit still lifes", "still"),
    ("a still life with a skull and objects", "Vanitas", "still"),
    ("a still life of dead game and kitchen objects", "Kitchen still lifes", "still"),
    ("a painting of horses", "Horses", "animal"),
    ("a painting of dogs", "Dogs", "animal"),
    ("a painting of birds", "Birds", "animal"),
    ("a painting of cows and sheep on a farm", "Farm animals", "animal"),
    ("a painting of a lion or a tiger", "Wild animals", "animal"),
    ("a painting of fish", "Fish", "animal"),
    ("a coat of arms", "Coats of arms", "flat"),
    ("a manuscript page with handwritten text", "Manuscript pages", "flat"),
    ("an illuminated manuscript with a decorated initial", "Illuminated manuscripts", "flat"),
    ("a map", "Maps", "flat"),
    ("a technical diagram or architectural drawing", "Diagrams", "flat"),
    ("an abstract painting of colored shapes", "Abstract art", "flat"),
    ("a pencil sketch", "Sketches", "flat"),
    ("a Japanese woodblock print", "Japanese prints", "flat"),
    ("a Chinese ink painting of birds and flowers", "Chinese ink paintings", "flat"),
    ("a Persian miniature", "Persian miniatures", "flat"),
    ("a fantasy creature or monster", "Fantasy", "other"),
    ("a stone sculpture", "Sculpture", "other"),
    ("an ancient Egyptian relief", "Egyptian art", "other"),
    ("a decorative pattern", "Patterns", "flat"),
]


def vocab_hash():
    return hashlib.sha1("\n".join(p for p, _, _ in VOCAB).encode()).hexdigest()[:8]


def text_vectors(cache_dir):
    """(len(VOCAB), 512) unit text vectors; computed with the same CLIP model as the pictures, cached."""
    f = Path(cache_dir) / "look-vocab-embeds.npy"; fh = Path(cache_dir) / "look-vocab-embeds.hash"
    if f.exists() and fh.exists() and fh.read_text().strip() == vocab_hash():
        return np.load(f)
    import subjects_clip as sc
    torch, open_clip, model, pre, dev = sc.load_model()
    tok = open_clip.get_tokenizer(sc.MODEL)
    with torch.no_grad():
        t = model.encode_text(tok([p for p, _, _ in VOCAB]).to(dev)); t = t / t.norm(dim=-1, keepdim=True)
    T = t.float().cpu().numpy()
    np.save(f, T); fh.write_text(vocab_hash() + "\n")
    return T


def zero_shot(E, L, K, cache_dir, top=3):
    """Best phrases per island. E: unit CLIP vectors (zero rows = none)."""
    have = np.abs(E).sum(1) > 0
    T = text_vectors(cache_dir)
    C = np.stack([E[(L == k) & have].mean(0) for k in range(K)]); C /= np.linalg.norm(C, axis=1, keepdims=True) + 1e-9
    S = C @ T.T
    Zs = (S - S.mean(0)) / (S.std(0) + 1e-9)
    # votes: which phrase each single painting is closest to (per-phrase z-score over all paintings), as a share of the island
    P = E[have] @ T.T
    Pz = (P - P.mean(0)) / (P.std(0) + 1e-9)
    am = np.full(len(E), -1); am[np.where(have)[0]] = Pz.argmax(1)
    out = []
    for k in range(K):
        mem = am[(L == k) & have]
        o = np.argsort(-Zs[k], kind="stable")[:top]
        out.append([(VOCAB[j][1], VOCAB[j][2], round(float(Zs[k, j]), 2), round(float((mem == j).mean()), 2)) for j in o])
    return out
