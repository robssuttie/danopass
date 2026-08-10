(function () {
  "use strict";

  /* ---------------- Theme ---------------- */
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    localStorage.setItem("danopass-theme", theme);
  }

  const savedTheme = localStorage.getItem("danopass-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));

  themeToggle.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  });

  /* ---------------- Eyes that follow the cursor ---------------- */
  (function initEyeTracking() {
    const img = document.querySelector(".mascot");
    const leftPupil = document.getElementById("eyePupilLeft");
    const rightPupil = document.getElementById("eyePupilRight");
    if (!img || !leftPupil || !rightPupil) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Coordinates measured directly against the source artwork (1165x1350).
    const NATURAL_W = 1165;
    const EYES = {
      left:  { x: 727, y: 326, rx: 9, ry: 5, el: leftPupil },
      right: { x: 875, y: 353, rx: 9, ry: 5, el: rightPupil }
    };
    const PUPIL_DIAMETER = 15; // px, at natural (1165-wide) scale

    let scale = 1;

    function layout() {
      scale = img.clientWidth / NATURAL_W;
      Object.values(EYES).forEach(e => {
        const size = Math.max(4, PUPIL_DIAMETER * scale);
        e.el.style.width = size + "px";
        e.el.style.height = size + "px";
        e.el.style.left = (e.x * scale) + "px";
        e.el.style.top = (e.y * scale) + "px";
      });
    }

    function pointAt(clientX, clientY) {
      const rect = img.getBoundingClientRect();
      Object.values(EYES).forEach(e => {
        const cx = rect.left + e.x * scale;
        const cy = rect.top + e.y * scale;
        const rx = e.rx * scale;
        const ry = e.ry * scale;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const nx = rx ? dx / rx : 0;
        const ny = ry ? dy / ry : 0;
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist > 1) { dx /= dist; dy /= dist; }
        e.el.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
      });
    }

    layout();
    if (!img.complete) img.addEventListener("load", layout);
    window.addEventListener("resize", layout);

    if (!reduceMotion) {
      window.addEventListener("mousemove", (e) => pointAt(e.clientX, e.clientY));
      window.addEventListener("touchmove", (e) => {
        if (e.touches && e.touches[0]) pointAt(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
    }
  })();

  /* ---------------- Wiring ---------------- */
  const output = document.getElementById("passwordOutput");
  const copyBtn = document.getElementById("copyBtn");
  const copyHint = document.getElementById("copyHint");
  const simpleBtn = document.getElementById("simpleBtn");
  const complexBtn = document.getElementById("complexBtn");
  const symbolsToggle = document.getElementById("symbolsToggle");
  const mixedCaseToggle = document.getElementById("mixedCaseToggle");

  let hintTimer = null;

  // Shrinks the on-stone text until it fits its box on both axes, so long
  // passwords never get clipped or ellipsised — the box just gets used fully.
  function fitStoneText() {
    const el = output;
    el.style.fontSize = "";
    const computed = window.getComputedStyle(el);
    let size = parseFloat(computed.fontSize);
    const minSize = 9; // px floor, still legible
    let guard = 0;
    while (guard < 40 && size > minSize &&
           (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
      size -= 1;
      el.style.fontSize = size + "px";
      guard++;
    }
  }

  function showPassword(pass) {
    output.textContent = pass;
    copyBtn.disabled = false;
    copyHint.textContent = "";
    requestAnimationFrame(fitStoneText);
  }

  function setLoading(isLoading) {
    simpleBtn.disabled = isLoading;
    complexBtn.disabled = isLoading;
    if (isLoading) {
      output.textContent = "…";
    }
  }

  async function requestPassword(type) {
    setLoading(true);
    copyHint.textContent = "";
    const params = new URLSearchParams({
      type,
      symbols: symbolsToggle.checked ? "1" : "0",
      mixed: mixedCaseToggle.checked ? "1" : "0"
    });
    try {
      const res = await fetch(`/api/generate?${params.toString()}`);
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      showPassword(data.password);
    } catch (err) {
      output.textContent = "tap generate";
      copyHint.textContent = "Couldn't reach the generator — try again.";
    } finally {
      setLoading(false);
    }
  }

  simpleBtn.addEventListener("click", () => requestPassword("simple"));
  complexBtn.addEventListener("click", () => requestPassword("complex"));

  window.addEventListener("resize", () => {
    if (copyBtn.disabled) return; // nothing generated yet
    fitStoneText();
  });

  copyBtn.addEventListener("click", async () => {
    const text = output.textContent.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyHint.textContent = "Copied to clipboard.";
    } catch (err) {
      copyHint.textContent = "Couldn't copy — select the text manually.";
    }
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { copyHint.textContent = ""; }, 2200);
  });
})();
