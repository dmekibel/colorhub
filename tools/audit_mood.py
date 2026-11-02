#!/usr/bin/env python3
"""Thirty-six moods (seven families) for every painting (David, 2026-10-26: "moods can be their own folders, like periods and movements"). CLIP zero-shot on the cached embeddings
(no network): each mood is described by a few phrases; a painting's reading is how much of the softmax mass over all twelve falls on that mood, then ranked across the
archive (0..255) so every mood uses its whole range and a board of "the most serene" is the top of that ranking. The model's reading of a picture's mood, not a claim
about how colors feel (see the color myths in CLAUDE.md).
  python3 tools/audit_mood.py [--show]    # writes data/gallery/mood.bin (6 bytes per painting: its three strongest moods as id, strength pairs) and mood.json
Paintings with no cached embedding get 128 everywhere and are counted as unscored. Needs research/_raw/clipenv and research/_raw/subjects/clip-embeds.npy.
"""
import hashlib, json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("SUBJECTS_RAW", ROOT / "research" / "_raw"))
VENV_PY = RAW / "clipenv" / "bin" / "python"
CACHE = RAW / "subjects"
MODEL, PRETRAINED = "ViT-B-32", "laion2b_s34b_b79k"

MOODS = [   # id, name, family, phrases
    ("serene", "Serene", "Calm", ["a serene, peaceful, calm painting", "a quiet tranquil scene with soft light", "a still and restful painting"]),
    ("contemplative", "Contemplative", "Calm", ["a contemplative painting of a person lost in thought", "a quiet scene of reading or reflection", "a pensive, inward, meditative mood"]),
    ("languid", "Languid", "Calm", ["a languid, drowsy summer afternoon", "people resting and idling in leisurely warmth", "a lazy, slow, sun-warmed scene"]),
    ("tender", "Tender", "Calm", ["a tender painting of a mother and child", "a gentle, affectionate act of care", "a soft, warm, loving moment"]),
    ("intimate", "Intimate", "Calm", ["an intimate, quiet domestic scene", "a private, gentle moment between people", "a cozy interior with a person absorbed in a task"]),
    ("joyful", "Joyful", "Joy and play", ["a joyful, happy, bright painting", "a cheerful sunny scene full of delight", "a painting that radiates happiness"]),
    ("festive", "Festive", "Joy and play", ["a festive painting of a celebration, a feast or a dance", "a lively gathering with music and dancing", "a carnival or a party scene"]),
    ("playful", "Playful", "Joy and play", ["a playful, humorous painting", "a charming painting of children or animals at play", "a light-hearted fanciful scene"]),
    ("exuberant", "Exuberant", "Joy and play", ["an exuberant, energetic, vividly colored painting", "a burst of lively motion and bold color", "a wild, high-spirited, ecstatic scene"]),
    ("whimsical", "Whimsical", "Joy and play", ["a whimsical, fairy-tale, fanciful painting", "a magical storybook scene", "a quirky imaginative dreamlike fantasy"]),
    ("triumphant", "Triumphant", "Joy and play", ["a triumphant painting of victory and glory", "a hero crowned or celebrated", "a proud, victorious procession"]),
    ("romantic", "Romantic", "Love and desire", ["a romantic, tender painting of lovers", "a dreamy, sentimental, affectionate scene", "an intimate loving embrace"]),
    ("sensual", "Sensual", "Love and desire", ["a sensual, voluptuous painting of a reclining figure", "a languorous nude bathed in warm light", "a painting of desire and beauty"]),
    ("yearning", "Yearning", "Love and desire", ["a painting of longing, a figure gazing out of a window", "someone waiting, hoping, looking into the distance", "a wistful, yearning gaze toward something absent"]),
    ("majestic", "Majestic", "Awe and the sacred", ["a majestic, grand, monumental painting", "a solemn ceremonial scene of power and glory", "a vast awe-inspiring noble scene"]),
    ("reverent", "Reverent", "Awe and the sacred", ["a reverent, devotional religious painting", "people at prayer in a sacred space", "a holy figure with a golden halo"]),
    ("sublime", "Sublime", "Awe and the sacred", ["a sublime landscape of vast mountains and sky", "an awe-inspiring wild nature scene dwarfing a tiny figure", "a boundless, overwhelming, breathtaking view"]),
    ("mystical", "Mystical", "Awe and the sacred", ["a mystical, visionary painting of spiritual light", "a glowing, otherworldly, heavenly apparition", "a transcendent, radiant, symbolic scene"]),
    ("solemn", "Solemn", "Awe and the sacred", ["a solemn, formal, dignified painting", "a stately ceremony or a grave official portrait", "a serious, composed, ceremonial mood"]),
    ("dramatic", "Dramatic", "Tension and drama", ["a dramatic painting with strong contrasts of light and dark", "an intense stormy scene full of action", "a turbulent dynamic composition"]),
    ("tense", "Tense", "Tension and drama", ["a tense, anxious, uneasy painting", "a frightening or threatening scene", "a nervous painting with a sense of dread"]),
    ("ominous", "Ominous", "Tension and drama", ["an ominous, foreboding sky before a storm", "a dark threatening atmosphere warning of danger", "a sinister, brooding landscape"]),
    ("restless", "Restless", "Tension and drama", ["a restless, agitated, unsettled painting", "a crowded nervous energy of a modern city", "an anxious, jittery composition"]),
    ("turbulent", "Turbulent", "Tension and drama", ["a turbulent painting of a battle or a shipwreck", "chaos, violence and struggle", "a swirling, violent, chaotic scene"]),
    ("somber", "Somber", "Dark and heavy", ["a somber, grave, serious painting", "a dark funeral or mourning scene", "a heavy, solemn and grim painting"]),
    ("melancholy", "Melancholy", "Dark and heavy", ["a melancholy, wistful, lonely painting", "a pensive sad figure alone", "a faded, sorrowful, grey mood"]),
    ("desolate", "Desolate", "Dark and heavy", ["a desolate, empty, barren landscape", "a lonely abandoned place under a bleak sky", "silence and emptiness"]),
    ("mournful", "Mournful", "Dark and heavy", ["a mournful painting of grief and loss", "weeping figures around a dead body", "a lament, a deathbed, a funeral"]),
    ("eerie", "Eerie", "Dark and heavy", ["an eerie, uncanny, ghostly painting", "a haunting pale figure in the dark", "a spooky unsettling night scene"]),
    ("bittersweet", "Bittersweet", "Complex", ["a bittersweet painting, joy mixed with sadness", "a happy scene tinged with melancholy", "a smile through tears, a fleeting golden moment"]),
    ("nostalgic", "Nostalgic", "Complex", ["a nostalgic painting of a remembered past", "a faded, sepia, old-fashioned memory", "a gentle look back at childhood or an old village"]),
    ("wistful", "Wistful", "Complex", ["a wistful, gently sad, hopeful painting", "a soft longing in a quiet evening light", "a dreamy, faraway, tender sadness"]),
    ("dreamlike", "Dreamlike", "Complex", ["a dreamlike, surreal, hazy painting", "an illogical imaginative scene out of a dream", "floating figures in a strange symbolic space"]),
    ("mysterious", "Mysterious", "Complex", ["a mysterious, enigmatic painting", "a veiled figure and unanswered questions", "a twilight atmosphere of secrets"]),
    ("satirical", "Satirical", "Complex", ["a satirical, caricatured, grotesque painting", "a comic or ironic scene mocking its subjects", "an absurd, exaggerated, humorous crowd"]),
    ("stoic", "Stoic", "Complex", ["a stoic, dignified figure bearing hardship", "a proud, composed, weathered face", "quiet endurance and resilience"]),
]


def main():
    if Path(sys.executable).resolve() != VENV_PY.resolve():
        if not VENV_PY.exists():
            sys.exit("needs research/_raw/clipenv")
        os.execv(str(VENV_PY), [str(VENV_PY), *sys.argv])
    import numpy as np, torch, open_clip
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    model, _, _ = open_clip.create_model_and_transforms(MODEL, pretrained=PRETRAINED)
    model = model.to(dev).eval(); tok = open_clip.get_tokenizer(MODEL)

    def enc(ph):
        with torch.no_grad():
            T = model.encode_text(tok(ph).to(dev)); T = T / T.norm(dim=-1, keepdim=True)
        return T.float().cpu().numpy()

    ids = [l for l in (ROOT / "data/gallery/ids.txt").read_text().splitlines() if l]
    have = (CACHE / "clip-embeds.ids.txt").read_text().splitlines(); arr = np.load(CACHE / "clip-embeds.npy")
    row = {k: i for i, k in enumerate(have)}
    ix = np.array([row.get(i, -1) for i in ids]); ok = ix >= 0
    E = np.zeros((len(ids), 512), np.float32); E[ok] = arr[ix[ok]].astype(np.float32)
    E /= np.maximum(np.linalg.norm(E, axis=1, keepdims=True), 1e-6)
    S = np.stack([(E @ enc(ph).T).max(axis=1) for _, _, _, ph in MOODS], axis=1) * 100.0   # (n, K): each mood's best phrase
    S -= S.max(axis=1, keepdims=True); P = np.exp(S); P /= P.sum(axis=1, keepdims=True)
    K = len(MOODS); m = int(ok.sum())
    R = np.zeros((len(ids), K), np.float32)   # each mood's reading ranked across the archive, 0..1
    for k in range(K):
        o = np.argsort(P[ok, k], kind="stable"); rk = np.empty(m, np.float32); rk[o] = np.arange(m) / max(1, m - 1)
        R[ok, k] = rk
    # each painting keeps its three strongest moods (by that rank): 3 x (mood id, strength) = 6 bytes, so a folder is "paintings that have this mood in their top three"
    top = np.argsort(-R, axis=1)[:, :3]
    out = np.zeros((len(ids), 6), np.uint8)
    for j in range(3):
        out[:, 2 * j] = top[:, j].astype(np.uint8)
        out[:, 2 * j + 1] = np.round(np.take_along_axis(R, top[:, j:j + 1], axis=1)[:, 0] * 255).astype(np.uint8)
    out[~ok] = 255   # no reading: mood id 255 everywhere
    (ROOT / "data/gallery/mood.bin").write_bytes(out.tobytes())
    h = hashlib.sha1(("\n".join(ids) + "\n").encode()).hexdigest()[:8]
    (ROOT / "data/gallery/mood.json").write_text(json.dumps({"v": 2, "n": len(ids), "hash": h, "format": "top3", "moods": [[a, b, c] for a, b, c, _ in MOODS], "scored": m, "unscored": int(len(ids) - m)}, indent=1) + "\n")
    print(f"mood.bin: {len(ids)} paintings, top 3 of {K} moods each, {m} scored")
    if "--show" in sys.argv:
        import glob
        names = {}
        for f in glob.glob(str(ROOT / "data/corpus/*.json")):
            d = json.load(open(f, encoding="utf-8"))
            for r in (d if isinstance(d, list) else d.get("items", d.get("rows", []))): names[r.get("id")] = (r.get("a"), r.get("t"))
        idx = np.where(ok)[0]
        for k, (a, b, c, _) in enumerate(MOODS):
            tp = idx[np.argsort(-R[idx, k])[:6]]
            print("--", b, f"({c})"); [print("  ", names.get(ids[i])) for i in tp]


if __name__ == "__main__":
    main()
