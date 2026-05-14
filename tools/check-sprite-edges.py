#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image


SHEETS = [
    ("sindre-hero", Path("assets/generated/sindre-hero/sheet-transparent.png"), 4, 4, 3),
    ("burger-bruiser", Path("assets/generated/enemies/burger-bruiser/sheet-transparent.png"), 2, 2, 2),
    ("berry-jam-shade", Path("assets/generated/enemies/berry-jam-shade/sheet-transparent.png"), 2, 2, 2),
    ("syrup-mage", Path("assets/generated/enemies/syrup-mage/sheet-transparent.png"), 2, 2, 2),
    ("waffle-golem", Path("assets/generated/enemies/waffle-golem/sheet-transparent.png"), 2, 2, 2),
    ("griddle-baron", Path("assets/generated/enemies/griddle-baron/sheet-transparent.png"), 3, 3, 2),
    ("candle-lich", Path("assets/generated/enemies/candle-lich/sheet-transparent.png"), 3, 3, 2),
    ("burger-emperor", Path("assets/generated/enemies/burger-emperor/sheet-transparent.png"), 3, 3, 2),
]


def main() -> int:
    reports = [check_sheet(*sheet) for sheet in SHEETS]
    failures = [failure for report in reports for failure in report["failures"]]
    print(json.dumps({"sheets": reports, "failure_count": len(failures)}, indent=2))
    return 1 if failures else 0


def check_sheet(name: str, sheet: Path, rows: int, cols: int, margin: int) -> dict:
    image = Image.open(sheet).convert("RGBA")
    width, height = image.size
    cell_width = width // cols
    cell_height = height // rows
    frames = []
    failures = []

    for row in range(rows):
        for col in range(cols):
            cell = image.crop(
                (
                    col * cell_width,
                    row * cell_height,
                    (col + 1) * cell_width,
                    (row + 1) * cell_height,
                )
            )
            bbox = cell.getchannel("A").getbbox()
            frame = {"row": row, "col": col, "alpha_bbox": bbox}
            frames.append(frame)

            if bbox is None:
                failures.append({**frame, "sheet": name, "reason": "empty"})
                continue

            left, top, right, bottom = bbox
            touches = (
                left < margin
                or top < margin
                or right > cell_width - margin
                or bottom > cell_height - margin
            )

            if touches:
                failures.append({**frame, "sheet": name, "reason": "edge"})

    return {
        "name": name,
        "sheet": str(sheet),
        "size": [width, height],
        "grid": [rows, cols],
        "cell_size": [cell_width, cell_height],
        "margin": margin,
        "frames": frames,
        "failures": failures,
    }


if __name__ == "__main__":
    sys.exit(main())
