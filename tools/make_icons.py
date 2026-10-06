# Renders the app icon (a fanned paint-chip deck on neutral dark grey) at 180 and 512 px.
from PIL import Image, ImageDraw
CHIPS = ["#E34234", "#FFBF00", "#50C878", "#007FFF", "#9966CC"]
PAPER, GROUND = "#F5F4F0", "#121212"
def render(size):
    S = size * 4
    img = Image.new("RGBA", (S, S), GROUND)
    w, h, r = int(S * .17), int(S * .58), int(S * .032)
    px, py = S // 2, int(S * .79)          # pivot near the bottom
    for i, col in enumerate(CHIPS):
        layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        x0, y0 = px - w // 2, py - h
        d.rounded_rectangle([x0 - 6, y0 - 6, x0 + w + 6, py + 6], r + 6, fill=GROUND)   # gap between chips
        d.rounded_rectangle([x0, y0, x0 + w, py], r, fill=PAPER)
        d.rounded_rectangle([x0, y0, x0 + w, y0 + int(h * .78)], r, fill=col)
        d.rectangle([x0, y0 + int(h * .78) - r, x0 + w, y0 + int(h * .78)], fill=col)
        ang = (2 - i) * 15                  # left chip rotated left, drawn first
        layer = layer.rotate(ang, resample=Image.BICUBIC, center=(px, py))
        img.alpha_composite(layer)
    img = img.resize((size, size), Image.LANCZOS).convert("RGB")
    return img
for s in (180, 512):
    render(s).save(f"icon-{s}.png", optimize=True)
print("ok")
