# alexgorevski.com — Systems Observatory

Source for [alexgorevski.com](https://www.alexgorevski.com), served via GitHub Pages
from this repository (`agorevski.github.io`).

## Stack

Vanilla HTML, CSS, and JavaScript. No bundler or external
runtime dependencies (fonts, CDNs, frameworks). Everything renders and
navigates correctly with JavaScript disabled; the JS in `assets/js/main.js`
is a progressive-enhancement layer only (canvas signal-network background,
command palette, capability-matrix filters, motion toggle,
and a subtle pointer glow).

## Design & content

An editorial portfolio with a portrait-led introduction, career highlights,
expandable project briefs, an experience timeline, and filterable expertise.
Responsive layouts use local assets and system fonts.

Career and project copy should stay grounded in the existing portfolio and
public professional profiles. Do not add unverified impact metrics, client
endorsements, or inferred availability.

## Structure

```
index.html            Single-page site (semantic sections, no-JS-safe nav)
404.html               Custom not-found page
favicon.ico            Legacy favicon fallback
assets/
  css/styles.css       All styles (design tokens, layout, components, motion)
  docs/                Resume PDF linked from the page and command palette
  js/main.js           Progressive-enhancement interactions
  img/                 Favicons + photos/logos used by the page
```

## Local preview

Any static file server works, e.g.:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

## Production delivery

The Pages workflow runs `python3 scripts/build_site.py` and publishes `_site/`,
not the repository root. The build embeds `assets/css/styles.css` in the
homepage so the initial render does not wait for a separate stylesheet request.
Keep editing the source stylesheet; the generated HTML is not committed.
The source preview above still loads the stylesheet normally.

Only public site files and downloadable PDFs are published; resume sources,
fonts used to generate the PDF, tests, and development files are excluded.
To preview the deployed output, run the build and then
`python3 -m http.server 8080 --directory _site`.
Repeat the same build command to refresh `_site/`, including removal of obsolete
generated assets. A generated-file manifest limits cleanup to prior build files;
unknown files or directories cause a failure without being removed. Existing
output without a manifest is adopted only if it exactly matches the current
build. Use `--output _site-preview` for a separate output directory.

GitHub Pages currently serves static assets with `Cache-Control: max-age=600`.
That cache lifetime is controlled by the host, not HTML or this workflow.
Inlining the homepage stylesheet and reducing portrait transfer size mitigate
PageSpeed's cache-lifetime warning, but cannot remove it. Longer-lived asset
cache headers require a configurable hosting service or a CDN in front of
the custom domain; GitHub Pages does not honor a repository `_headers` file.

## Editable resume

The website links to **`assets/docs/resume/generated/resume.pdf`**.
Its editable source is **`assets/docs/resume/resume.yaml`**. Change the YAML
to update the content; `resume.css` and `template.html` control the layout.
The template reproduces the original's US Letter page, centered header,
teal links, underlined roles, italic descriptions, and compact career history.

One-time setup (Python 3.9+ and Chrome, Chromium, or Edge):

```sh
cd assets/docs/resume
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
```

After editing the YAML, export with:

```sh
python render.py
```

This creates `generated/resume.pdf` and a self-contained
`generated/resume.html` preview. The generated PDF is tracked by Git and is
the website's resume download; the HTML preview
and variant outputs are ignored. PDF timestamps are removed so rerendering
unchanged content with the same browser does not create timestamp-only diffs.
Commit and push the regenerated PDF to publish an updated resume.

### Git hooks

Enable the versioned hooks once per clone, from the repository root:

```sh
git config --local core.hooksPath .githooks
```

Both commits and pushes run `render.py`, then rebuild the complete production
site in ignored `_site/` using `scripts/build_site.py`. The site build uses the
working tree (including unstaged site edits); its output is never staged.
The pre-commit hook stages only
`assets/docs/resume/generated/resume.pdf`, including it in the commit if it
changed. The pre-push hook also regenerates and stages the PDF, but blocks
the push if resume files still need committing. Commit those changes and
push again; the hook never creates commits automatically.

Stage or stash edits to resume sources before committing or pushing:
hooks refuse to generate from unstaged source changes, preserving partial
staging rather than silently including excluded content. Other staged files
are left alone. Missing dependencies, export failures, or site build failures
stop the operation.
Hooks prefer `assets/docs/resume/.venv/bin/python`, otherwise `python3` or
`python`; install the requirements using the setup above. `CHROME_BIN`
can specify the browser executable.

Use `--input other.yaml --output generated/other.pdf` for variants, or
`--browser /path/to/chrome` if browser detection fails. `--html-only`
generates just the HTML; open it in a browser and **Print → Save as PDF**
with Letter paper, 100% scale, CSS/default margins, and headers/footers off.
The layout targets one page with the supplied content; longer content can
flow onto additional pages rather than being clipped or silently shrunk.

YAML paragraphs use `>-` to fold multiple source lines into a single paragraph.
Quote dates (including single years). Duplicate an earlier-role entry or a
publication bullet to add items. Publication bullets contain text fragments
with optional `style: bold`, `style: italic`, or `url`; other fields are plain
text, not Markdown/HTML. Content and link attributes are HTML-escaped.

The bundled [Carlito fonts](https://github.com/google/fonts/tree/main/ofl/carlito)
are Calibri-compatible and distributed under `assets/docs/resume/fonts/OFL.txt`.
They are embedded in the HTML/PDF for consistent output without network access
or a Calibri installation. Font rendering may differ slightly from the Word
original. The PDF's malformed Github link is corrected to the portfolio's
existing GitHub profile; the resume's wording is otherwise retained.

## Accessibility & motion

- Respects `prefers-reduced-motion`, plus an explicit, persisted motion
  toggle in the header that disables the canvas, smooth scrolling,
  transitions, and cursor-glow effects.
- Pointer-only effects (cursor glow) are gated behind
  `(pointer: fine)` and skipped entirely on touch devices.
- Skip link, semantic landmarks, visible focus rings, and a focus-managed,
  Escape-to-close command palette (`⌘K` / `Ctrl+K`).
- JavaScript-only controls remain hidden until enhancement initializes;
  ordinary links and project disclosures remain usable without JavaScript.
- Clipboard actions report success only after the browser confirms the copy;
  denied or unavailable clipboard access produces explicit feedback.
