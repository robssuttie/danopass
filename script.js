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
