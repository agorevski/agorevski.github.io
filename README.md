# alexgorevski.com — Systems Observatory

Source for [alexgorevski.com](https://www.alexgorevski.com), served via GitHub Pages
from this repository (`agorevski.github.io`).

## Stack

Vanilla HTML, CSS, and JavaScript. No build step, no bundler, no external
runtime dependencies (fonts, CDNs, frameworks). Everything renders and
navigates correctly with JavaScript disabled; the JS in `assets/js/main.js`
is a progressive-enhancement layer only (canvas signal-network background,
command palette, hero console, capability-matrix filters, motion toggle,
tilt/glow effects on fine pointers).

## Structure

```
index.html            Single-page site (semantic sections, no-JS-safe nav)
404.html               Custom not-found page
favicon.ico            Legacy favicon fallback
assets/
  css/styles.css       All styles (design tokens, layout, components, motion)
  js/main.js           Progressive-enhancement interactions
  img/                 Favicons + photos/logos used by the page
```

## Local preview

Any static file server works, e.g.:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

## Accessibility & motion

- Respects `prefers-reduced-motion`, plus an explicit, persisted motion
  toggle in the header that disables the canvas, smooth scrolling, reveal
  animation, tilt, and cursor-glow effects.
- Pointer-only effects (tilt, cursor glow) are gated behind
  `(pointer: fine)` and skipped entirely on touch devices.
- Skip link, semantic landmarks, visible focus rings, and a focus-managed,
  Escape-to-close command palette (`⌘K` / `Ctrl+K`).
