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
    const eyeEls = {
      left:  { socket: document.getElementById("eyeSocketLeft"),  pupil: document.getElementById("eyePupilLeft") },
      right: { socket: document.getElementById("eyeSocketRight"), pupil: document.getElementById("eyePupilRight") }
    };
    if (!img || !eyeEls.left.socket || !eyeEls.right.socket) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Coordinates + sizes measured directly against the source artwork (1165x1350 natural size).
    // hw/hh = half-width/half-height of the iris cover, measured along the eye's OWN tilted
    // axes. rot = clockwise tilt of that axis in degrees (0 = perfectly horizontal).
    const NATURAL_W = 1165;
    const EYES = {
      left:  { x: 725, y: 328, hw: 17, hh: 11, rot: 0, ...eyeEls.left },
      right: { x: 871, y: 345, hw: 17, hh: 10, rot: 8, ...eyeEls.right }
    };
    const PUPIL_DIAMETER = 11; // natural px, fits comfortably inside the iris cover
    const MARGIN = 2;          // natural px kept clear so the pupil never touches the cover's edge

    let scale = 1;

    function layout() {
      scale = img.clientWidth / NATURAL_W;
      Object.values(EYES).forEach(e => {
        const w = e.hw * 2 * scale;
        const h = e.hh * 2 * scale;
        e.socket.style.width = w + "px";
        e.socket.style.height = h + "px";
        e.socket.style.left = (e.x * scale) + "px";
        e.socket.style.top = (e.y * scale) + "px";
        e.socket.style.transform = `translate(-50%, -50%) rotate(${e.rot}deg)`;

        const pSize = Math.max(4, PUPIL_DIAMETER * scale);
        e.pupil.style.width = pSize + "px";
        e.pupil.style.height = pSize + "px";
        e.pupil.style.left = (e.x * scale) + "px";
        e.pupil.style.top = (e.y * scale) + "px";
      });
    }

    function pointAt(clientX, clientY) {
      const rect = img.getBoundingClientRect();
      Object.values(EYES).forEach(e => {
        const cx = rect.left + e.x * scale;
        const cy = rect.top + e.y * scale;
        let dx = clientX - cx;
        let dy = clientY - cy;

        // Rotate the cursor offset into the eye's own (tilted) coordinate frame.
        const rad = -e.rot * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        let localX = dx * cos - dy * sin;
        let localY = dx * sin + dy * cos;

        const rx = Math.max(0, e.hw * scale - (PUPIL_DIAMETER * scale) / 2 - MARGIN * scale);
        const ry = Math.max(0, e.hh * scale - (PUPIL_DIAMETER * scale) / 2 - MARGIN * scale);
        const nx = rx ? localX / rx : 0;
        const ny = ry ? localY / ry : 0;
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist > 1) { localX /= dist; localY /= dist; }

        // Rotate back out of the eye's local frame into real screen space.
        const rad2 = e.rot * Math.PI / 180;
        const cos2 = Math.cos(rad2), sin2 = Math.sin(rad2);
        const finalX = localX * cos2 - localY * sin2;
        const finalY = localX * sin2 + localY * cos2;

        e.pupil.style.transform = `translate(-50%, -50%) translate(${finalX}px, ${finalY}px)`;
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
