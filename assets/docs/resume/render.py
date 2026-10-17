#!/usr/bin/env python3
"""Render the editable YAML resume as standalone HTML and a printable PDF."""

import argparse
import base64
from html import escape
import os
from pathlib import Path
import shutil
from string import Template
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit

import yaml
from pypdf import PdfWriter
from pypdf.errors import PyPdfError


ROOT = Path(__file__).resolve().parent


def text(value):
    if not isinstance(value, str):
        raise ValueError(f"Expected text, got {value!r}. Quote numeric dates in YAML.")
    return escape(value)


def items(value):
    if not isinstance(value, list):
        raise ValueError(f"Expected a YAML list, got {type(value).__name__}.")
    return value


def fragment(item):
    content = text(item["text"])
    style = item.get("style")
    if style not in (None, "bold", "italic"):
        raise ValueError(f"Unknown text style: {style!r}")
    if style:
        tag = "strong" if style == "bold" else "em"
        content = f"<{tag}>{content}</{tag}>"
    if "url" in item:
        url = item["url"]
        text(url)
        if urlsplit(url).scheme not in ("https", "http", "mailto"):
            raise ValueError(f"Unsupported link URL: {url!r}")
        content = f'<a href="{escape(url, quote=True)}">{content}</a>'
    return content


def role_heading(role):
    return (
        '<div class="role-heading">'
        f'<h3>{text(role["title"])}</h3>'
        f'<span class="dates">{text(role["dates"])}</span></div>'
    )


def render(data):
    experience = data["experience"]
    current = experience["current"]
    fonts = {
        key: base64.b64encode(
            (ROOT / "fonts" / f"Carlito-{name}.ttf").read_bytes()
        ).decode("ascii")
        for key, name in (
            ("regular", "Regular"),
            ("bold", "Bold"),
            ("italic", "Italic"),
            ("bold_italic", "BoldItalic"),
        )
    }
    styles = Template((ROOT / "resume.css").read_text(encoding="utf-8")).substitute(
        fonts
    )
    return Template((ROOT / "template.html").read_text(encoding="utf-8")).substitute(
        styles=styles,
        name=text(data["name"]),
        contact=" &middot; ".join(fragment(item) for item in items(data["contact"])),
        summary=text(data["summary"]),
        experience_heading=text(experience["heading"]),
        current=role_heading(current)
        + "".join(
            f"<p>{text(paragraph)}</p>" for paragraph in items(current["highlights"])
        ),
        earlier_note=text(experience["earlier_note"]),
        earlier="".join(
            f'<article>{role_heading(role)}<p>{text(role["description"])}</p></article>'
            for role in items(experience["earlier"])
        ),
        publications_heading=text(data["publications"]["heading"]),
        publications="".join(
            "<li>" + "".join(fragment(item) for item in items(bullet)) + "</li>"
            for bullet in items(data["publications"]["items"])
        ),
        education_heading=text(data["education"]["heading"]),
        education_description=text(data["education"]["description"]),
    )


def find_browser(explicit):
    candidates = [
        explicit,
        os.environ.get("CHROME_BIN"),
        "google-chrome",
        "chromium",
        "chromium-browser",
        "chrome",
        "msedge",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    for variable in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
        if os.environ.get(variable):
            candidates.extend(
                str(Path(os.environ[variable]) / suffix)
                for suffix in (
                    "Google/Chrome/Application/chrome.exe",
                    "Microsoft/Edge/Application/msedge.exe",
                )
            )
    if explicit:
        candidates = [explicit]
    for candidate in candidates:
        if candidate and (executable := shutil.which(candidate)):
            return executable
    raise ValueError(
        "Chrome/Chromium/Edge was not found. Use --browser PATH, set CHROME_BIN, "
        "or use --html-only and print the HTML from your browser."
    )


def write_pdf(source, destination):
    writer = PdfWriter(clone_from=source)
    writer.metadata = {
        key: value
        for key, value in (writer.metadata or {}).items()
        if key not in ("/CreationDate", "/ModDate")
    }
    writer.write(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "resume.yaml")
    parser.add_argument(
        "--output", type=Path, default=ROOT / "generated" / "resume.pdf"
    )
    parser.add_argument(
        "--html-only", action="store_true", help="Skip the browser/PDF step"
    )
    parser.add_argument("--browser", help="Path to Chrome, Chromium, or Edge")
    args = parser.parse_args()
    try:
        output = args.output.resolve()
        html_path = output.with_suffix(".html")
        if output.suffix.lower() != ".pdf":
            raise ValueError(
                "--output must end in .pdf (the HTML uses the same basename)."
            )
        if args.input.resolve() in (output, html_path):
            raise ValueError("Output must not overwrite the input YAML.")
        data = yaml.safe_load(args.input.read_text(encoding="utf-8"))
        html = render(data)
        browser = None if args.html_only else find_browser(args.browser)
        output.parent.mkdir(parents=True, exist_ok=True)
        html_path.write_text(html, encoding="utf-8")
        print(f"HTML: {html_path}")
        if browser:
            with tempfile.TemporaryDirectory(prefix="resume-") as temporary:
                pdf = Path(temporary) / "resume.pdf"
                result = subprocess.run(
                    [
                        browser,
                        "--headless",
                        "--disable-gpu",
                        f"--user-data-dir={Path(temporary) / 'profile'}",
                        "--no-pdf-header-footer",
                        "--allow-file-access-from-files",
                        f"--print-to-pdf={pdf}",
                        html_path.as_uri(),
                    ],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
                if result.returncode or not pdf.is_file():
                    raise ValueError(
                        f"Browser PDF export failed:\n{result.stderr.strip()}"
                    )
                normalized = Path(temporary) / "normalized.pdf"
                write_pdf(pdf, normalized)
                shutil.copyfile(normalized, output)
            print(f"PDF:  {output}")
    except (
        OSError,
        ValueError,
        KeyError,
        TypeError,
        yaml.YAMLError,
        PyPdfError,
        subprocess.TimeoutExpired,
    ) as error:
        parser.exit(1, f"Resume export failed: {error}\n")


if __name__ == "__main__":
    sys.exit(main())
