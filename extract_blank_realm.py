import os
import pymupdf
from PIL import Image
import io

doc = pymupdf.open("Mythic Bastionland Blank Realm.pdf")
page = doc[0]

os.makedirs("stamps", exist_ok=True)

# 1. Inspect the 144 grid hexes vs 12 legend hexes in page.get_drawings()
drawings = page.get_drawings()
grid_hexes = []
legend_hexes = []
for d in drawings:
    r = d["rect"]
    if r.y0 < 520:
        grid_hexes.append(r)
    else:
        legend_hexes.append(r)

print(f"Grid hexes count: {len(grid_hexes)}, Legend hexes count: {len(legend_hexes)}")

# Sort grid hexes to find unique column X positions and row Y positions
x0s = sorted(list(set(round(r.x0, 2) for r in grid_hexes)))
print("12 Column x0s:", x0s)
for col_idx, x_val in enumerate(x0s):
    col_rects = sorted([r for r in grid_hexes if abs(r.x0 - x_val) < 1.0], key=lambda r: r.y0)
    print(f"Col {col_idx+1}: count={len(col_rects)}, y0_first={col_rects[0].y0:.2f}, y0_last={col_rects[-1].y0:.2f}, w={col_rects[0].width:.2f}, h={col_rects[0].height:.2f}")

# 2. Map the 22 images by xref to their exact names
XREF_MAP = {
    # 6 Landmarks (red ink)
    637: "landmark_Dwelling",
    643: "landmark_Sanctum",
    645: "landmark_Monument",
    647: "landmark_Hazard",
    649: "landmark_Curse",
    613: "landmark_Ruin",
    # 12 Terrains (1-12)
    653: "terrain_01_Marsh",
    619: "terrain_02_Heath",
    625: "terrain_03_Crag",
    631: "terrain_04_Peaks",
    655: "terrain_05_Forest",
    621: "terrain_06_Valley",
    627: "terrain_07_Hills",
    633: "terrain_08_Meadow",
    617: "terrain_09_Bog",
    623: "terrain_10_Lake",
    629: "terrain_11_Glade",
    635: "terrain_12_Plains",
    # 4 Holdings
    639: "holding_Castle",
    641: "holding_Town",
    615: "holding_Fortress",
    651: "holding_Tower",
}

def make_white_transparent(pil_img):
    rgba = pil_img.convert("RGBA")
    datas = rgba.getdata()
    new_data = []
    for item in datas:
        r, g, b, a = item
        # Calculate luminance; pure white (255,255,255) becomes transparent,
        # anti-aliased near-white edges get smooth alpha
        lum = (r + g + b) / 3.0
        if lum > 248:
            new_data.append((r, g, b, 0))
        elif lum > 215:
            # Smooth ramp for anti-aliased ink edges
            alpha = int(255 * (248 - lum) / (248 - 215))
            new_data.append((r, g, b, alpha))
        else:
            new_data.append((r, g, b, 255))
    rgba.putdata(new_data)
    return rgba

for xref, name in XREF_MAP.items():
    raw = doc.extract_image(xref)
    pil_img = Image.open(io.BytesIO(raw["image"]))
    trans_img = make_white_transparent(pil_img)
    out_path = os.path.join("stamps", f"{name}.png")
    trans_img.save(out_path, "PNG")
    print(f"Saved {out_path} ({trans_img.size})")

# 3. Also render the Blank Realm grid area (x: 10..448, y: 10..520) at 3x scale (216 DPI)
grid_clip = pymupdf.Rect(10, 10, 448, 520)
pix = page.get_pixmap(clip=grid_clip, matrix=pymupdf.Matrix(3, 3), alpha=False)
pix.save("stamps/blank_realm_grid.png")
print("Saved stamps/blank_realm_grid.png:", pix.width, "x", pix.height)

# 4. Also render full Blank Realm PDF pages and Realm Sheets PDF pages for reference modal
for i, p in enumerate(doc):
    px = p.get_pixmap(matrix=pymupdf.Matrix(2.2, 2.2), alpha=False)
    px.save(f"stamps/blank_realm_page_{i+1}.jpg")

doc_sample = pymupdf.open("Mythic Bastionland Realm Sheets.pdf")
for i, p in enumerate(doc_sample):
    px = p.get_pixmap(matrix=pymupdf.Matrix(2.2, 2.2), alpha=False)
    px.save(f"stamps/sample_realm_page_{i+1}.jpg")
print("Rendered full reference sheets.")
