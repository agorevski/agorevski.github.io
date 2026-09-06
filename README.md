# alexgorevski.com — Systems Observatory

Source for [alexgorevski.com](https://www.alexgorevski.com), served via GitHub Pages
from this repository (`agorevski.github.io`).

## Stack

Vanilla HTML, CSS, and JavaScript. No build step, no bundler, no external
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
