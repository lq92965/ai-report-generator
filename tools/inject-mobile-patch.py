"""Inject mobile-patch.css + mobile-patch.js before </head> in all project HTML files."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNIPPET = (
    '    <link rel="stylesheet" href="mobile-patch.css">\n'
    '    <script src="mobile-patch.js"></script>\n'
)


def main() -> None:
    injected = 0
    skipped = 0
    for path in sorted(ROOT.glob("**/*.html")):
        if "node_modules" in path.parts:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        if "mobile-patch.css" in text and "mobile-patch.js" in text:
            skipped += 1
            continue
        if not re.search(r"</head>", text, re.I):
            print("no </head>:", path.relative_to(ROOT))
            skipped += 1
            continue
        new_text, n = re.subn(r"(</head>)", SNIPPET + r"\1", text, count=1, flags=re.I)
        if n != 1:
            print("replace failed:", path)
            continue
        path.write_text(new_text, encoding="utf-8")
        injected += 1
    print(f"injected={injected} skipped_already_or_no_head={skipped}")


if __name__ == "__main__":
    main()
