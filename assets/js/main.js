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
    var start = new Date(2008, 5, 2);
    var years = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    yearsEl.textContent = Math.floor(years) + "+ yrs";
  }

  /* ============================= Signal network canvas ============================= */
  (function signalCanvas() {
    var canvas = document.getElementById("signal-canvas");
    if (!canvas || !canvas.getContext) { return; }
    var ctx = canvas.getContext("2d");
    var nodes = [];
    var width = 0, height = 0, dpr = 1;
    var running = false;
    var rafId = null;
    var MAX_NODES = 70;
    var LINK_DIST = 150;

    function nodeCountForViewport() {
      var area = window.innerWidth * window.innerHeight;
      return Math.max(18, Math.min(MAX_NODES, Math.round(area / 22000)));
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25
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
            var alpha = (1 - dist / LINK_DIST) * 0.35;
            ctx.strokeStyle = "rgba(61, 220, 151, " + alpha + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[a].x, nodes[a].y);
            ctx.lineTo(nodes[b].x, nodes[b].y);
            ctx.stroke();
          }
        }
      }
      for (var c = 0; c < nodes.length; c++) {
        ctx.fillStyle = "rgba(242, 169, 59, 0.55)";
        ctx.beginPath();
        ctx.arc(nodes[c].x, nodes[c].y, 1.6, 0, Math.PI * 2);
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
      resizeTimer = window.setTimeout(resize, 150);
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

  /* ============================= Card tilt (fine pointer only) ============================= */
  (function cardTilt() {
    var cards = document.querySelectorAll(".system-card");
    cards.forEach(function (card) {
      function onMove(e) {
        if (!finePointerQuery.matches || !motionEnabled()) { return; }
        var rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = "perspective(800px) rotateX(" + (py * -4) + "deg) rotateY(" + (px * 6) + "deg)";
      }
      function onLeave() { card.style.transform = ""; }
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
    });
  })();

  /* ============================= Scroll progress + active section ============================= */
  (function scrollTracking() {
    var bar = document.getElementById("progressBar");
    var sections = document.querySelectorAll("main section[id], main .hero[id]");
    var navLinks = document.querySelectorAll(".primary-nav__list a[href^='#']");

    function updateProgress() {
      var doc = document.documentElement;
      var scrollTop = window.scrollY || doc.scrollTop;
      var height = doc.scrollHeight - doc.clientHeight;
      var pct = height > 0 ? (scrollTop / height) * 100 : 0;
      if (bar) { bar.style.width = pct + "%"; }
    }
    window.addEventListener("scroll", function () {
      window.requestAnimationFrame(updateProgress);
    }, { passive: true });
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

  /* ============================= Hero console ============================= */
  (function heroConsole() {
    var log = document.getElementById("consoleLog");
    var form = document.getElementById("consoleForm");
    var input = document.getElementById("consoleInput");
    if (!log || !form || !input) { return; }

    var commandTargets = { about: "about", work: "systems", experience: "experience", contact: "contact" };

    function print(text) {
      var li = document.createElement("li");
      li.innerHTML = text;
      log.appendChild(li);
      log.scrollTop = log.scrollHeight;
    }

    function runCommand(raw) {
      var cmd = (raw || "").trim().toLowerCase();
      if (!cmd) { return; }
      print("<code>&gt; " + cmd.replace(/</g, "&lt;") + "</code>");
      if (cmd === "help") {
        print("Commands: about · work · experience · contact · clear");
      } else if (cmd === "clear") {
        log.innerHTML = "";
      } else if (commandTargets[cmd]) {
        scrollToId(commandTargets[cmd]);
        print("Navigating to <code>#" + commandTargets[cmd] + "</code>…");
      } else if (cmd === "whoami") {
        print("Principal / Senior Software Developer — distributed systems &amp; applied AI.");
      } else {
        print("Unknown command: <code>" + cmd.replace(/</g, "&lt;") + "</code>. Try <code>help</code>.");
      }
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      runCommand(input.value);
      input.value = "";
    });

    document.querySelectorAll(".console__quick a[data-cmd]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        // Let the real anchor navigation happen (works without JS); just also log it.
        var cmd = link.getAttribute("data-cmd");
        window.setTimeout(function () { print("Navigating to <code>#" + commandTargets[cmd] + "</code>…"); }, 0);
        if (motionEnabled()) {
          e.preventDefault();
          scrollToId(commandTargets[cmd]);
        }
      });
    });
  })();

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
          cat.querySelectorAll(".skill-tag").forEach(function () { visibleSkills++; });
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
  (function copyButtons() {
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-copy");
        var done = function () {
          var original = btn.textContent;
          btn.textContent = "Copied!";
          window.setTimeout(function () { btn.textContent = original; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(done).catch(done);
        } else {
          done();
        }
      });
    });
  })();

  /* ============================= Back to top ============================= */
  (function backToTop() {
    var btn = document.getElementById("toTop");
    if (!btn) { return; }
    window.addEventListener("scroll", function () {
      btn.classList.toggle("is-visible", window.scrollY > 800);
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

    var items = [
      { label: "Home", hint: "section", go: "home" },
      { label: "Mission Brief", hint: "section", go: "about" },
      { label: "Selected Systems", hint: "section", go: "systems" },
      { label: "Experience Flightpath", hint: "section", go: "experience" },
      { label: "Capability Matrix", hint: "section", go: "matrix" },
      { label: "Field Notes", hint: "section", go: "notes" },
      { label: "Contact / Handoff", hint: "section", go: "contact" },
      { label: "Toggle motion effects", hint: "action", run: function () { document.getElementById("motionToggle").click(); } },
      { label: "Copy email address", hint: "action", run: function () { navigator.clipboard && navigator.clipboard.writeText("admin@alexgorevski.com"); } },
      { label: "Open GitHub profile", hint: "external", url: "https://github.com/agorevski/" },
      { label: "Open LinkedIn profile", hint: "external", url: "https://www.linkedin.com/in/alexgorevski/" },
      { label: "Email admin@alexgorevski.com", hint: "external", url: "mailto:admin@alexgorevski.com" }
    ];

    var activeIndex = -1;
    var lastFocused = null;

    function renderList(filterText) {
      var q = (filterText || "").trim().toLowerCase();
      var filtered = items.filter(function (item) { return item.label.toLowerCase().indexOf(q) !== -1; });
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
      list._filtered = filtered;
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
      var filtered = list._filtered || [];
      if (activeIndex >= 0 && filtered[activeIndex]) { activate(filtered[activeIndex]); }
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

})();
