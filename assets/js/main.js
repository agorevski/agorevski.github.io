/*!
  Systems Observatory — progressive enhancement layer.
  Every feature here is additive: all content and navigation already work
  with this file absent. No external dependencies.
*/
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointerQuery = window.matchMedia("(pointer: fine)");
  var MOTION_KEY = "ago-motion";

  /* ============================= Motion preference ============================= */
  function storedMotionPref() {
    try { return window.localStorage.getItem(MOTION_KEY); } catch (e) { return null; }
  }
  function setStoredMotionPref(value) {
    try { window.localStorage.setItem(MOTION_KEY, value); } catch (e) { /* storage unavailable */ }
  }
  function motionEnabled() {
    return !root.classList.contains("motion-off");
  }
  function applyMotionState(enabled, persist) {
    root.classList.toggle("motion-off", !enabled);
    root.classList.toggle("motion-user-on", enabled);
    var btn = document.getElementById("motionToggle");
    var label = document.getElementById("motionToggleLabel");
    if (btn) { btn.setAttribute("aria-pressed", String(enabled)); }
    if (label) { label.textContent = enabled ? "Motion On" : "Motion Off"; }
    if (persist) { setStoredMotionPref(enabled ? "on" : "off"); }
  }
  (function initMotion() {
    var stored = storedMotionPref();
    var enabled = stored ? stored === "on" : !reduceMotionQuery.matches;
    applyMotionState(enabled, false);
    var toggle = document.getElementById("motionToggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        applyMotionState(!motionEnabled(), true);
      });
    }
    if (reduceMotionQuery.addEventListener) {
      reduceMotionQuery.addEventListener("change", function () {
        if (!storedMotionPref()) { applyMotionState(!reduceMotionQuery.matches, false); }
      });
    }
  })();

  /* ============================= Pointer capability ============================= */
  function updatePointerClass() {
    root.classList.toggle("has-fine-pointer", finePointerQuery.matches);
    root.classList.toggle("no-fine-pointer", !finePointerQuery.matches);
  }
  updatePointerClass();
  if (finePointerQuery.addEventListener) {
    finePointerQuery.addEventListener("change", updatePointerClass);
  }

  /* ============================= Footer year ============================= */
  var yearEl = document.getElementById("currentYear");
  if (yearEl) { yearEl.textContent = String(new Date().getFullYear()); }

  /* ============================= Years-of-experience readout ============================= */
  var yearsEl = document.getElementById("yearsExperience");
  if (yearsEl) {
    var CAREER_START = new Date(2008, 5, 2); // June 2008
    var MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
    var years = (Date.now() - CAREER_START.getTime()) / MS_PER_YEAR;
    yearsEl.textContent = Math.floor(years) + "+ yrs";
  }

  /* ============================= Signal network canvas ============================= */
  (function signalCanvas() {
    var canvas = document.getElementById("signal-canvas");
    if (!canvas || !canvas.getContext) { return; }
    var ctx = canvas.getContext("2d");
    if (!ctx) { return; }
    var nodes = [];
    var width = 0, height = 0, dpr = 1;
    var running = false;
    var rafId = null;
    var MAX_NODES = 70;
    var MIN_NODES = 18;
    var AREA_PER_NODE = 22000;
    var MAX_DPR = 1.5;
    var LINK_DIST = 150;
    var NODE_SPEED = 0.25; // max drift px per frame
    var NODE_RADIUS = 1.6;
    var LINK_ALPHA = 0.35; // opacity at zero distance
    var palette = getComputedStyle(root);
    var LINK_RGB = palette.getPropertyValue("--mint-rgb").trim();
    var NODE_FILL = "rgba(" + palette.getPropertyValue("--amber-rgb").trim() + ", 0.55)";
    var RESIZE_DEBOUNCE_MS = 150;

    function nodeCountForViewport() {
      var area = window.innerWidth * window.innerHeight;
      return Math.max(MIN_NODES, Math.min(MAX_NODES, Math.round(area / AREA_PER_NODE)));
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      var count = nodeCountForViewport();
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * NODE_SPEED,
          vy: (Math.random() - 0.5) * NODE_SPEED
        });
      }
    }

    function step() {
      ctx.clearRect(0, 0, width, height);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) { n.vx *= -1; }
        if (n.y < 0 || n.y > height) { n.vy *= -1; }
      }
      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var dx = nodes[a].x - nodes[b].x;
          var dy = nodes[a].y - nodes[b].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            var alpha = (1 - dist / LINK_DIST) * LINK_ALPHA;
            ctx.strokeStyle = "rgba(" + LINK_RGB + ", " + alpha + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[a].x, nodes[a].y);
            ctx.lineTo(nodes[b].x, nodes[b].y);
            ctx.stroke();
          }
        }
      }
      for (var c = 0; c < nodes.length; c++) {
        ctx.fillStyle = NODE_FILL;
        ctx.beginPath();
        ctx.arc(nodes[c].x, nodes[c].y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      rafId = window.requestAnimationFrame(step);
    }

    function start() {
      if (running || !motionEnabled() || document.hidden) { return; }
      running = true;
      rafId = window.requestAnimationFrame(step);
    }
    function stop() {
      running = false;
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
      ctx.clearRect(0, 0, width, height);
    }

    resize();
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, RESIZE_DEBOUNCE_MS);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { stop(); } else { start(); }
    });
    // React to the motion toggle / OS preference by observing the html class.
    var observer = new MutationObserver(function () {
      if (motionEnabled()) { start(); } else { stop(); }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    start();
  })();

  /* ============================= Hero pointer glow ============================= */
  (function heroGlow() {
    var hero = document.getElementById("home");
    var glow = document.getElementById("heroGlow");
    if (!hero || !glow) { return; }
    var ticking = false;
    function onMove(e) {
      if (!finePointerQuery.matches || !motionEnabled()) { return; }
      var rect = hero.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(function () {
          glow.style.setProperty("--mx", x + "px");
          glow.style.setProperty("--my", y + "px");
          glow.classList.add("is-active");
          ticking = false;
        });
      }
    }
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", function () { glow.classList.remove("is-active"); });
  })();

  /* ============================= Scroll progress + active section ============================= */
  (function scrollTracking() {
    var bar = document.getElementById("progressBar");
    var sections = document.querySelectorAll("main section[id], main .hero[id]");
    var navLinks = document.querySelectorAll(".primary-nav__list a[href^='#']");

    var ticking = false;
    function updateProgress() {
      var scrollTop = window.scrollY || root.scrollTop;
      var height = root.scrollHeight - root.clientHeight;
      var pct = height > 0 ? (scrollTop / height) * 100 : 0;
      if (bar) { bar.style.width = pct + "%"; }
    }
    function requestProgressUpdate() {
      if (ticking) { return; }
      ticking = true;
      window.requestAnimationFrame(function () { updateProgress(); ticking = false; });
    }
    window.addEventListener("scroll", requestProgressUpdate, { passive: true });
    updateProgress();

    if ("IntersectionObserver" in window && sections.length) {
      var current = "";
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { current = entry.target.id; }
        });
        navLinks.forEach(function (link) {
          var match = link.getAttribute("href") === "#" + current;
          if (match) { link.setAttribute("aria-current", "true"); }
          else { link.removeAttribute("aria-current"); }
        });
      }, { rootMargin: "-40% 0px -55% 0px", threshold: 0 });
      sections.forEach(function (s) { io.observe(s); });
    }
  })();

  /* ============================= Mobile nav auto-close ============================= */
  (function mobileNavClose() {
    var toggle = document.getElementById("navToggle");
    if (!toggle) { return; }
    toggle.querySelectorAll("a[href^='#']").forEach(function (link) {
      link.addEventListener("click", function () { toggle.open = false; });
    });
  })();

  /* ============================= Smooth-scroll helper (motion aware) ============================= */
  function scrollToId(id) {
    var target = document.getElementById(id);
    if (!target) { return; }
    target.scrollIntoView({ behavior: motionEnabled() ? "smooth" : "auto", block: "start" });
    // Keep the URL in sync (back button, bookmarking, reload) without letting
    // the browser's own hash-jump fight the smooth scroll already in progress.
    if (window.history && window.history.pushState) {
      window.history.pushState(null, "", "#" + id);
    } else {
      window.location.hash = id;
    }
    if (typeof target.focus === "function") {
      var hadTabIndex = target.hasAttribute("tabindex");
      if (!hadTabIndex) { target.setAttribute("tabindex", "-1"); }
      target.focus({ preventScroll: true });
      if (!hadTabIndex) {
        target.addEventListener("blur", function cleanup() {
          target.removeAttribute("tabindex");
          target.removeEventListener("blur", cleanup);
        });
      }
    }
  }

  /* ============================= Capability matrix filters ============================= */
  (function matrixFilters() {
    var group = document.getElementById("matrixFilters");
    var grid = document.getElementById("matrixGrid");
    var status = document.getElementById("matrixStatus");
    if (!group || !grid) { return; }
    var chips = group.querySelectorAll(".chip");
    var cats = grid.querySelectorAll(".matrix-cat");

    function applyFilter(filter) {
      var visibleSkills = 0;
      cats.forEach(function (cat) {
        var match = filter === "all" || cat.getAttribute("data-cat") === filter;
        cat.style.display = match ? "" : "none";
        if (match) {
          visibleSkills += cat.querySelectorAll(".skill-tag").length;
        }
      });
      if (status) {
        status.textContent = filter === "all"
          ? "Showing all capability categories."
          : "Showing " + visibleSkills + " skills in the selected category.";
      }
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        applyFilter(chip.getAttribute("data-filter"));
      });
    });
  })();

  /* ============================= Copy-to-clipboard ============================= */
  var copyStatus = document.createElement("p");
  copyStatus.className = "sr-only";
  copyStatus.setAttribute("role", "status");
  document.body.appendChild(copyStatus);
  var COPY_FEEDBACK_MS = 2400;

  function copyText(value, button) {
    var original = button ? button.textContent : "";
    if (button) { button.disabled = true; }
    copyStatus.textContent = "";
    function finish(copied) {
      var message = copied ? "Copied!" : "Copy unavailable. Please copy the email address manually.";
      copyStatus.textContent = message;
      if (button) {
        button.textContent = copied ? message : "Copy unavailable";
        window.setTimeout(function () {
          button.textContent = original;
          button.disabled = false;
        }, COPY_FEEDBACK_MS);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () { finish(true); }, function () { finish(false); });
    } else {
      finish(false);
    }
  }

  (function copyButtons() {
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        copyText(btn.getAttribute("data-copy"), btn);
      });
    });
  })();

  /* ============================= Back to top ============================= */
  (function backToTop() {
    var btn = document.getElementById("toTop");
    if (!btn) { return; }
    var SHOW_AFTER_PX = 800;
    window.addEventListener("scroll", function () {
      btn.classList.toggle("is-visible", window.scrollY > SHOW_AFTER_PX);
    }, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: motionEnabled() ? "smooth" : "auto" });
      var brand = document.querySelector(".brand");
      if (brand) { brand.focus({ preventScroll: true }); }
    });
  })();

  /* ============================= Command palette ============================= */
  (function commandPalette() {
    var palette = document.getElementById("palette");
    var trigger = document.getElementById("paletteTrigger");
    var backdrop = document.getElementById("paletteBackdrop");
    var input = document.getElementById("paletteInput");
    var list = document.getElementById("paletteList");
    if (!palette || !trigger || !input || !list) { return; }

    // The contact markup is the single source of truth for the address.
    var mailto = document.querySelector('a[href^="mailto:"]');
    var EMAIL = mailto ? mailto.getAttribute("href").slice("mailto:".length) : "";

    var items = [
      { label: "Home", hint: "section", go: "home" },
      { label: "About", hint: "section", go: "about" },
      { label: "Selected Work", hint: "section", go: "systems" },
      { label: "Experience", hint: "section", go: "experience" },
      { label: "Expertise", hint: "section", go: "matrix" },
      { label: "Field Notes", hint: "section", go: "notes" },
      { label: "Contact", hint: "section", go: "contact" },
      { label: "View resume (PDF)", hint: "document", url: "/assets/docs/Alex_Gorevski_Resume_2025.pdf" },
      { label: "Toggle motion effects", hint: "action", run: function () { document.getElementById("motionToggle").click(); } },
      { label: "Open GitHub profile", hint: "external", url: "https://github.com/agorevski/" },
      { label: "Open LinkedIn profile", hint: "external", url: "https://www.linkedin.com/in/alexgorevski/" }
    ];
    if (EMAIL) {
      items.push(
        { label: "Copy email address", hint: "action", run: function () { copyText(EMAIL); } },
        { label: "Email " + EMAIL, hint: "external", url: "mailto:" + EMAIL }
      );
    }

    var activeIndex = -1;
    var lastFocused = null;
    var filteredItems = [];

    function renderList(filterText) {
      var q = (filterText || "").trim().toLowerCase();
      var filtered = items.filter(function (item) { return item.label.toLowerCase().indexOf(q) !== -1; });
      filteredItems = filtered;
      list.innerHTML = "";
      if (!filtered.length) {
        var empty = document.createElement("li");
        empty.className = "palette__empty";
        empty.textContent = "No matches.";
        list.appendChild(empty);
        activeIndex = -1;
        input.removeAttribute("aria-activedescendant");
        return;
      }
      filtered.forEach(function (item, i) {
        var li = document.createElement("li");
        li.setAttribute("role", "option");
        li.id = "palette-opt-" + i;
        li.setAttribute("aria-selected", String(i === 0));
        li.innerHTML = "<span>" + item.label + "</span><span class=\"hint\">" + item.hint + "</span>";
        li.addEventListener("click", function () { activate(item); });
        list.appendChild(li);
      });
      activeIndex = 0;
      input.setAttribute("aria-activedescendant", "palette-opt-0");
    }

    function moveActive(delta) {
      var options = list.querySelectorAll('li[role="option"]');
      if (!options.length) { return; }
      activeIndex = (activeIndex + delta + options.length) % options.length;
      options.forEach(function (li, i) { li.setAttribute("aria-selected", String(i === activeIndex)); });
      input.setAttribute("aria-activedescendant", options[activeIndex].id);
      options[activeIndex].scrollIntoView({ block: "nearest" });
    }

    function activate(item) {
      if (!item) { return; }
      close();
      if (item.go) { scrollToId(item.go); }
      else if (item.run) { item.run(); }
      else if (item.url) { window.open(item.url, item.url.indexOf("mailto:") === 0 ? "_self" : "_blank", "noopener"); }
    }

    function activateCurrent() {
      if (activeIndex >= 0 && filteredItems[activeIndex]) { activate(filteredItems[activeIndex]); }
    }

    function open() {
      lastFocused = document.activeElement;
      palette.hidden = false;
      renderList("");
      input.value = "";
      window.setTimeout(function () { input.focus(); }, 0);
      document.addEventListener("keydown", onKeydown, true);
    }
    function close() {
      palette.hidden = true;
      document.removeEventListener("keydown", onKeydown, true);
      if (lastFocused && typeof lastFocused.focus === "function") { lastFocused.focus(); }
    }

    function onKeydown(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); return; }
      if (e.key === "Enter") { e.preventDefault(); activateCurrent(); return; }
      if (e.key === "Tab") {
        // Simple focus trap: only the input is meaningfully focusable in this dialog.
        e.preventDefault();
        input.focus();
      }
    }

    trigger.addEventListener("click", open);
    if (backdrop) { backdrop.addEventListener("click", close); }
    input.addEventListener("input", function () { renderList(input.value); });

    document.addEventListener("keydown", function (e) {
      var isK = e.key === "k" || e.key === "K";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (palette.hidden) { open(); } else { close(); }
      }
    });
  })();

  root.classList.add("js-ready");
})();
