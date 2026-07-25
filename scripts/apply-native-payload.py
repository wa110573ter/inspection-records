from __future__ import annotations

import base64
import gzip
from pathlib import Path


def apply_payload(prefix: str, destination: str) -> None:
    parts = sorted(Path("scripts/native-payload").glob(f"{prefix}-*.txt"))
    if not parts:
        raise RuntimeError(f"No payload parts found for {prefix}")

    encoded = "".join(part.read_text(encoding="utf-8").strip() for part in parts)
    decoded = gzip.decompress(base64.b64decode(encoded, validate=True))
    target = Path(destination)
    target.write_bytes(decoded)
    print(f"updated {destination} from {len(parts)} payload part(s)")


apply_payload("inspection", "app/inspection-app.tsx")
apply_payload("page", "app/page.tsx")
