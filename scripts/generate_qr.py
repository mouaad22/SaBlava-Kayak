#!/usr/bin/env python3
"""Generate per-kayak QR codes for the Aiguablava Kayak route experience.

Each code encodes  https://routes.sablavakayaks.com/?k=NN  where NN is 00..26.
  - 00  = general / kiosk scan (no specific kayak)
  - 01..26 = the kayaks

Output: plain black-on-white SVG (vector), error-correction level H, with a
two-digit number label printed under each code so staff can match sticker to
kayak. SVG is hand-built (crisp rects + quiet zone + label) for print quality.

Run:  python scripts/generate_qr.py
"""
from __future__ import annotations

import pathlib

import qrcode
from qrcode.constants import ERROR_CORRECT_H

BASE_URL = "https://routes.sablavakayaks.com/?k="
IDS = [f"{n:02d}" for n in range(0, 27)]  # 00..26  -> 27 codes

# --- layout (SVG user units; unitless so it scales to any print size) ---
MODULE = 10          # size of one QR module
QUIET = 4            # quiet-zone border, in modules (QR spec minimum)
LABEL_GAP = 6        # modules of space between code and label
LABEL_HEIGHT = 14    # modules tall reserved for the label text
FG = "#000000"
BG = "#ffffff"

OUT_DIR = pathlib.Path(__file__).resolve().parent.parent / "qr-codes"


def matrix_for(data: str) -> list[list[bool]]:
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, border=QUIET)
    qr.add_data(data)
    qr.make(fit=True)
    return qr.get_matrix()  # includes the quiet-zone border


def modules_to_path(matrix: list[list[bool]]) -> str:
    """Merge every dark module into a single SVG path (one rect per module)."""
    segs = []
    for r, row in enumerate(matrix):
        for c, dark in enumerate(row):
            if dark:
                x, y = c * MODULE, r * MODULE
                segs.append(f"M{x} {y}h{MODULE}v{MODULE}h-{MODULE}z")
    return "".join(segs)


def build_svg(data: str, label: str) -> str:
    matrix = matrix_for(data)
    n = len(matrix)                       # modules per side (incl. quiet zone)
    code_px = n * MODULE
    total_h = code_px + (LABEL_GAP + LABEL_HEIGHT) * MODULE
    label_y = code_px + (LABEL_GAP + LABEL_HEIGHT * 0.72) * MODULE
    font_px = LABEL_HEIGHT * MODULE
    path = modules_to_path(matrix)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {code_px} {total_h}" width="{code_px}" height="{total_h}" '
        f'shape-rendering="crispEdges" role="img" '
        f'aria-label="QR code for kayak {label} - {data}">'
        f'<rect width="{code_px}" height="{total_h}" fill="{BG}"/>'
        f'<path d="{path}" fill="{FG}"/>'
        f'<text x="{code_px / 2}" y="{label_y:.1f}" fill="{FG}" '
        f'font-family="Arial, Helvetica, sans-serif" font-size="{font_px}" '
        f'font-weight="700" text-anchor="middle" '
        f'letter-spacing="{MODULE}">{label}</text>'
        f'</svg>'
    )


# --- print sheet (A4, ready to print to PDF from any browser) ---
PER_PAGE = 12          # 3 cols x 4 rows; 21 codes -> 2 pages (12 + 9)
QR_PRINT_MM = 38       # printed width of each QR square (label band adds below)


def build_print_sheet(svgs: dict[str, str]) -> str:
    chunks = [IDS[i:i + PER_PAGE] for i in range(0, len(IDS), PER_PAGE)]
    pages = []
    for pno, chunk in enumerate(chunks, 1):
        cells = "".join(
            f'<figure class="cell"><div class="qr">{svgs[kid]}</div>'
            f'<figcaption>{BASE_URL}{kid}</figcaption></figure>'
            for kid in chunk
        )
        pages.append(
            f'<section class="sheet">'
            f'<header>Aiguablava Kayak — QR codes — page {pno}/{len(chunks)}</header>'
            f'<div class="grid">{cells}</div></section>'
        )
    body = "".join(pages)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Aiguablava Kayak — QR print sheet</title>
<style>
  @page {{ size: A4 portrait; margin: 12mm; }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }}
  .sheet {{ break-after: page; }}
  .sheet:last-child {{ break-after: auto; }}
  header {{ font-size: 9pt; color: #555; letter-spacing: .04em;
           text-transform: uppercase; margin: 0 0 6mm; }}
  .grid {{ display: grid; grid-template-columns: repeat(3, 1fr);
          column-gap: 8mm; row-gap: 8mm; }}
  .cell {{ margin: 0; display: flex; flex-direction: column; align-items: center;
          outline: .3mm dashed #c8c8c8; outline-offset: 3mm; }}
  .qr svg {{ width: {QR_PRINT_MM}mm; height: auto; display: block; }}
  figcaption {{ font-size: 6.5pt; color: #888; margin-top: 1mm;
               font-family: "Courier New", monospace; }}
  @media screen {{ body {{ background: #eee; padding: 16px; }}
    .sheet {{ background: #fff; width: 210mm; min-height: 297mm; padding: 12mm;
             margin: 0 auto 16px; box-shadow: 0 1px 6px rgba(0,0,0,.2); }} }}
</style></head>
<body>{body}</body></html>"""


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    svgs: dict[str, str] = {}
    for kid in IDS:
        url = f"{BASE_URL}{kid}"
        svg = build_svg(url, kid)
        svgs[kid] = svg
        out = OUT_DIR / f"kayak-{kid}.svg"
        out.write_text(svg, encoding="utf-8")
        print(f"  {out.name:16s} -> {url}")
    print(f"\nGenerated {len(IDS)} SVG codes in {OUT_DIR}")

    sheet = OUT_DIR / "print-sheet.html"
    sheet.write_text(build_print_sheet(svgs), encoding="utf-8")
    print(f"Print sheet: {sheet}  ({-(-len(IDS) // PER_PAGE)} A4 pages)")


if __name__ == "__main__":
    main()
