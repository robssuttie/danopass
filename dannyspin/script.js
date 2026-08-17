(function () {
  "use strict";

  /* ---------------- Theme (shared with DanoPass) ---------------- */
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
    drawWheel(); // slice text colour can depend on theme-aware palette choices later
  });

  /* ---------------- Elements ---------------- */
  const entriesInput = document.getElementById("entriesInput");
  const entriesCount = document.getElementById("entriesCount");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const sampleBtn = document.getElementById("sampleBtn");
  const clearBtn = document.getElementById("clearBtn");
  const spinBtn = document.getElementById("spinBtn");
  const spinHint = document.getElementById("spinHint");
  const canvas = document.getElementById("wheelCanvas");
  const ctx = canvas.getContext("2d");
  const wheelWrap = document.getElementById("wheelWrap");
  const wheelEmptyState = document.getElementById("wheelEmptyState");

  const winnerOverlay = document.getElementById("winnerOverlay");
  const winnerName = document.getElementById("winnerName");
  const spinAgainBtn = document.getElementById("spinAgainBtn");
  const closeWinnerBtn = document.getElementById("closeWinnerBtn");

  const SAMPLE_NAMES = ["Golf", "Beetle", "Polo", "Passat", "Camper", "Wolfsburg"];

  const PALETTE = [
    "#3E9BDC", "#F5A623", "#3FA65B", "#D6524B",
    "#8B5FBF", "#2E93A6", "#DB8A0E", "#5C6BC0"
  ];

  let entries = [];
  let currentRotation = 0; // accumulated degrees, always increases
  let spinning = false;

  /* ---------------- Entries handling ---------------- */
  function parseEntries() {
    return entriesInput.value
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);
  }

  function refreshEntries() {
    entries = parseEntries();
    entriesCount.textContent = `${entries.length} segment${entries.length === 1 ? "" : "s"}`;
    const canSpin = entries.length >= 2 && !spinning;
    spinBtn.disabled = !canSpin;
    spinHint.textContent = spinning
      ? "Spinning…"
      : (entries.length < 2 ? "Add at least 2 names to spin." : "");
    drawWheel();
  }

  entriesInput.addEventListener("input", refreshEntries);

  shuffleBtn.addEventListener("click", () => {
    const list = parseEntries();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    entriesInput.value = list.join("\n");
    refreshEntries();
  });

  sampleBtn.addEventListener("click", () => {
    entriesInput.value = SAMPLE_NAMES.join("\n");
    refreshEntries();
  });

  clearBtn.addEventListener("click", () => {
    entriesInput.value = "";
    refreshEntries();
  });

  /* ---------------- Wheel drawing ---------------- */
  function setupCanvasResolution() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const displaySize = canvas.clientWidth || 440;
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function textColorFor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#16233F" : "#FFFFFF";
  }

  function drawWheel() {
    const size = canvas.clientWidth || 440;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);

    if (entries.length === 0) {
      wheelEmptyState.hidden = false;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#D8DEE9";
      ctx.fill();
      return;
    }
    wheelEmptyState.hidden = true;

    const n = entries.length;
    const sliceAngle = (Math.PI * 2) / n;
    const fontSize = Math.max(11, Math.min(20, 220 / n));

    entries.forEach((name, i) => {
      const start = i * sliceAngle;
      const end = start + sliceAngle;
      const color = PALETTE[i % PALETTE.length];

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // radiating label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = textColorFor(color);
      ctx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
      const maxWidth = radius - radius * 0.22 - 10;
      let label = name;
      while (ctx.measureText(label).width > maxWidth && label.length > 1) {
        label = label.slice(0, -1);
      }
      if (label !== name) label = label.replace(/.$/, "…");
      ctx.fillText(label, radius - 12, 0);
      ctx.restore();
    });
  }

  window.addEventListener("resize", () => {
    setupCanvasResolution();
    drawWheel();
  });

  /* ---------------- Spin logic ---------------- */
  function pickWinnerIndex(n) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  }

  function spin() {
    if (spinning || entries.length < 2) return;
    spinning = true;
    spinBtn.disabled = true;
    spinHint.textContent = "Spinning…";

    const n = entries.length;
    const sliceAngleDeg = 360 / n;
    const winnerIndex = pickWinnerIndex(n);
    const centerAngleDeg = winnerIndex * sliceAngleDeg + sliceAngleDeg / 2;

    // small random jitter so it doesn't always stop dead-center of the slice
    const jitter = (Math.random() - 0.5) * sliceAngleDeg * 0.6;

    // pointer sits at screen angle 0 (3 o'clock); rotating the wheel by R degrees
    // moves the point originally at angle "a" to screen angle (a + R) mod 360.
    // We need (centerAngleDeg + jitter + R) mod 360 === 0.
    const targetMod = ((-(centerAngleDeg + jitter)) % 360 + 360) % 360;
    const currentMod = ((currentRotation % 360) + 360) % 360;
    const forwardDelta = ((targetMod - currentMod) + 360) % 360;

    const extraSpins = 6; // full turns for visual flourish
    currentRotation += extraSpins * 360 + forwardDelta;

    canvas.style.transition = "transform 4.8s cubic-bezier(0.15, 0.65, 0.1, 1)";
    canvas.style.transform = `rotate(${currentRotation}deg)`;

    function onDone(e) {
      if (e && e.propertyName !== "transform") return;
      canvas.removeEventListener("transitionend", onDone);
      spinning = false;
      spinBtn.disabled = entries.length < 2;
      spinHint.textContent = entries.length < 2 ? "Add at least 2 names to spin." : "";

      wheelWrap.classList.add("celebrate");
      setTimeout(() => wheelWrap.classList.remove("celebrate"), 750);
      setTimeout(() => announceWinner(entries[winnerIndex]), 350);
    }
    canvas.addEventListener("transitionend", onDone);
  }

  spinBtn.addEventListener("click", spin);

  /* ---------------- Winner modal ---------------- */
  const winFlash = document.getElementById("winFlash");

  function announceWinner(name) {
    winnerName.textContent = name;
    winnerOverlay.hidden = false;
    launchConfetti();

    winFlash.classList.remove("fire");
    // force reflow so the animation can restart if triggered again quickly
    void winFlash.offsetWidth;
    winFlash.classList.add("fire");
  }

  function closeWinner() {
    winnerOverlay.hidden = true;
  }

  closeWinnerBtn.addEventListener("click", closeWinner);
  winnerOverlay.addEventListener("click", (e) => {
    if (e.target === winnerOverlay) closeWinner();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !winnerOverlay.hidden) closeWinner();
  });
  spinAgainBtn.addEventListener("click", () => {
    closeWinner();
    spin();
  });

  /* ---------------- Confetti ---------------- */
  const confettiCanvas = document.getElementById("confettiCanvas");
  const confettiCtx = confettiCanvas.getContext("2d");
  let confettiParticles = [];
  let confettiRAF = null;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function makeBurst(originXFrac, delayMs, count) {
    const originX = confettiCanvas.width * originXFrac;
    const originY = confettiCanvas.height * 0.34;
    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.95);
      const speed = 7 + Math.random() * 10;
      particles.push({
        x: originX + (Math.random() - 0.5) * 40,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        shape: Math.random() < 0.35 ? "circle" : "rect",
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.35,
        delay: delayMs
      });
    }
    return particles;
  }

  function launchConfetti() {
    if (reduceMotion) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    confettiParticles = [
      ...makeBurst(0.5, 0, 130),
      ...makeBurst(0.16, 130, 90),
      ...makeBurst(0.84, 130, 90),
      ...makeBurst(0.5, 320, 70)
    ];

    if (confettiRAF) cancelAnimationFrame(confettiRAF);
    const gravity = 0.27;
    const drag = 0.995;
    const start = performance.now();
    const totalDuration = 4200;

    function tick(now) {
      const elapsed = now - start;
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;

      confettiParticles.forEach(p => {
        const localElapsed = elapsed - p.delay;
        if (localElapsed < 0) { alive = true; return; }

        p.vy += gravity;
        p.vx *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        if (p.y < confettiCanvas.height + 40) alive = true;

        const fade = Math.max(0, 1 - localElapsed / 3000);
        if (fade <= 0) return;

        confettiCtx.save();
        confettiCtx.globalAlpha = fade;
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rot);
        confettiCtx.fillStyle = p.color;
        if (p.shape === "circle") {
          confettiCtx.beginPath();
          confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          confettiCtx.fill();
        } else {
          confettiCtx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        }
        confettiCtx.restore();
      });

      if (alive && elapsed < totalDuration) {
        confettiRAF = requestAnimationFrame(tick);
      } else {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }
    confettiRAF = requestAnimationFrame(tick);
  }

  /* ---------------- Init ---------------- */
  setupCanvasResolution();
  refreshEntries();
})();
