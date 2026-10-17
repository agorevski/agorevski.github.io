#!/usr/bin/env python3
"""Build public files in _site, inlining the canonical CSS."""

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil


STYLESHEET = "/assets/css/styles.css"
ROOT_FILES = ("index.html", "404.html", "favicon.ico", ".nojekyll")
PUBLIC_ASSETS = {
    "assets/css": {".css"},
    "assets/js": {".js"},
    "assets/img": {".svg", ".png", ".webp", ".jpg", ".jpeg", ".gif", ".avif", ".ico"},
}
MANIFEST = ".build-site.json"


def validate_output(output, files, contents):
    """Refuse unknown files; adopt legacy output only on an exact content match."""
    marker = output / MANIFEST
    if marker.is_symlink():
        raise ValueError("Output manifest must not be a symlink")
    if marker.exists():
        recorded = json.loads(marker.read_text(encoding="utf-8"))
        if not isinstance(recorded, list) or any(
            not isinstance(name, str)
            or Path(name).is_absolute()
            or ".." in Path(name).parts
            or name != Path(name).as_posix()
            or name in (".", MANIFEST)
            for name in recorded
        ):
            raise ValueError("Invalid output manifest")
        previous = {Path(name) for name in recorded}
    else:
        previous = files
    directories = {parent for path in previous for parent in path.parents if parent != Path(".")}
    for path in output.rglob("*"):
        relative = path.relative_to(output)
        if path.is_symlink() or (
            relative != Path(MANIFEST)
            and relative not in (directories if path.is_dir() else previous)
        ):
            raise ValueError(f"Output contains an unknown file or directory: {relative}")
    if not marker.exists() and any(
        not (output / path).is_file() or (output / path).read_bytes() != contents(path)
        for path in files
    ):
        raise ValueError("Existing output does not match this build; use a fresh output directory")
    return previous


class StylesheetParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.stylesheets = []

    def handle_starttag(self, tag, attrs):
        if tag == "link" and "stylesheet" in dict(attrs).get("rel", "").lower().split():
            self.stylesheets.append((self.getpos(), attrs, self.get_starttag_text()))

    handle_startendtag = handle_starttag


def inline_stylesheet(html, css):
    parser = StylesheetParser()
    parser.feed(html)
    if len(parser.stylesheets) != 1:
        raise ValueError("index.html must contain exactly one stylesheet link")
    (line, column), attrs, original = parser.stylesheets[0]
    if len(attrs) != 2 or dict(attrs) != {"rel": "stylesheet", "href": STYLESHEET}:
        raise ValueError(f"Expected an unqualified stylesheet link to {STYLESHEET}")
    if re.search(r"</style\b", css, re.IGNORECASE):
        raise ValueError("Canonical CSS contains an unsafe closing style tag")
    # Relative CSS URLs would resolve against index.html after inlining.
    for match in re.finditer(r"url\(\s*['\"]?([^'\"\s)]+)", css, re.IGNORECASE):
        if not re.match(r"(?:/|#|[a-z][a-z0-9+.-]*:)", match[1], re.IGNORECASE):
            raise ValueError("Canonical CSS must not use relative URLs when inlined")
    if re.search(r"@import\b", css, re.IGNORECASE):
        raise ValueError("Canonical CSS must not import additional stylesheets")
    offset = sum(len(part) for part in html.splitlines(keepends=True)[: line - 1]) + column
    return html[:offset] + "<style>\n" + css + "\n</style>" + html[offset + len(original) :]


def build_site(source, output=None):
    source = Path(source).resolve()
    output = Path(output) if output is not None else source / "_site"
    if output.is_symlink():
        raise ValueError("Output must not be a symlink")
    output = output.resolve()
    if output.parent != source or output.name.startswith("."):
        raise ValueError("Output must be a non-hidden direct child of the source directory")
    if output.exists() and not output.is_dir():
        raise ValueError("Output must be a directory")

    files = {Path(name) for name in ROOT_FILES}
    for directory, extensions in PUBLIC_ASSETS.items():
        files.update(
            path.relative_to(source)
            for path in (source / directory).rglob("*")
            if path.is_file()
            and path.suffix.lower() in extensions
            and not any(part.startswith(".") or part == "__pycache__" for part in path.relative_to(source).parts)
        )
    # Keep both historical top-level PDFs and the current generated resume URL.
    files.update(path.relative_to(source) for path in (source / "assets/docs").glob("*.pdf"))
    files.update(
        path.relative_to(source)
        for path in (source / "assets/docs/resume/generated").glob("*.pdf")
    )
    files.add(Path(STYLESHEET.lstrip("/")))
    for relative in sorted(files):
        path = source / relative
        if not path.is_file():
            raise FileNotFoundError(f"Missing required public file: {relative}")
        if path.resolve() != path.absolute():
            raise ValueError(f"Public files must not use symlinks: {relative}")

    html = inline_stylesheet(
        (source / "index.html").read_text(encoding="utf-8"),
        (source / STYLESHEET.lstrip("/")).read_text(encoding="utf-8"),
    )
    def contents(relative):
        return html.encode("utf-8") if relative == Path("index.html") else (source / relative).read_bytes()

    previous = validate_output(output, files, contents) if output.exists() else set()
    output.mkdir(exist_ok=True)
    for relative in sorted(files):
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if relative == Path("index.html"):
            destination.write_text(html, encoding="utf-8")
        else:
            shutil.copyfile(source / relative, destination)
    for relative in sorted(previous - files):
        (output / relative).unlink(missing_ok=True)
    old_directories = {parent for path in previous for parent in path.parents if parent != Path(".")}
    for relative in sorted(old_directories, key=lambda path: len(path.parts), reverse=True):
        directory = output / relative
        if directory.is_dir() and not any(directory.iterdir()):
            directory.rmdir()
    (output / MANIFEST).write_text(
        json.dumps(sorted(path.as_posix() for path in files)) + "\n", encoding="utf-8"
    )
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Output directory directly inside the repository")
    args = parser.parse_args()
    try:
        output = build_site(Path(__file__).resolve().parents[1], args.output)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Build failed: {error}\n")
    print(f"Built public site: {output}")


if __name__ == "__main__":
    main()
