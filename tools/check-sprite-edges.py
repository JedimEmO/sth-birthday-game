#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image


def main() -> int:
    sheet = Path("assets/generated/sindre-hero/sheet-transparent.png")
    rows = 4
    cols = 4
    margin = 3

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
                failures.append({**frame, "reason": "empty"})
                continue

            left, top, right, bottom = bbox
            touches = (
                left < margin
                or top < margin
                or right > cell_width - margin
                or bottom > cell_height - margin
            )

            if touches:
                failures.append({**frame, "reason": "edge"})

    report = {
        "sheet": str(sheet),
        "size": [width, height],
        "cell_size": [cell_width, cell_height],
        "margin": margin,
        "frames": frames,
        "failures": failures,
    }
    print(json.dumps(report, indent=2))

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
