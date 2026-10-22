(() => {
  "use strict";
  const frame = document.querySelector("#mistFrame");
  const photo = document.querySelector("#mistPhoto"), canvas = document.querySelector("#mistCanvas");
  const reset = document.querySelector("#resetMist"), clear = document.querySelector("#clearMist");
  const status = document.querySelector("#mistStatus"), ctx = canvas?.getContext("2d");
  const opacity = document.querySelector("#mistOpacity"), opacityValue = document.querySelector("#mistOpacityValue");
  if (!frame || !photo || !ctx) return;

  function updateOpacity(save = false) {
    const value = Math.max(0, Math.min(100, Number(opacity.value)));
    canvas.style.opacity = String(value / 100);
    opacityValue.value = `${value}%`;
    opacity.setAttribute("aria-valuetext", `${value}%`);
    if (save) try { localStorage.setItem("pcy-mist-opacity", String(value)); } catch { /* Storage is optional. */ }
  }
  try {
    const saved = localStorage.getItem("pcy-mist-opacity");
    if (saved !== null && Number.isFinite(Number(saved))) opacity.value = String(Math.max(0, Math.min(100, Number(saved))));
  } catch { /* Use the default when storage is unavailable. */ }
  updateOpacity();
  opacity.addEventListener("input", () => updateOpacity(true));

  let width = 0, height = 0, loaded = false, clearAll = false, activePointer = null, last = null, resizeFrame = 0;
  const marks = [];
  const grain = document.createElement("canvas");
  grain.width = grain.height = 128;
  const grainCtx = grain.getContext("2d");
  if (grainCtx) {
    const pixels = grainCtx.createImageData(128, 128);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
      pixels.data[i + 3] = Math.floor(Math.random() * 5);
    }
    grainCtx.putImageData(pixels, 0, 0);
  }
  function brush(x, y, radius) {
    const fade = ctx.createRadialGradient(x, y, 0, x, y, radius);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(.65, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = fade;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  function waterDrop(x, y, radius, stretch, angle, refract = false) {
    const rx = radius, ry = radius * stretch;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    if (refract) {
      ctx.save(); ctx.clip();
      const sw = rx * 1.25 / width * photo.naturalWidth, sh = ry * 1.25 / height * photo.naturalHeight;
      const sx = Math.max(0, Math.min(photo.naturalWidth - sw, x / width * photo.naturalWidth - sw / 2));
      const sy = Math.max(0, Math.min(photo.naturalHeight - sh, y / height * photo.naturalHeight - sh / 2));
      ctx.drawImage(photo, sx, sy, sw, sh, -rx, -ry, rx * 2, ry * 2);
      ctx.restore();
    }
    const lens = ctx.createLinearGradient(-rx, -ry, rx * .5, ry);
    lens.addColorStop(0, "rgba(255,255,255,.30)");
    lens.addColorStop(.42, "rgba(227,245,249,.04)");
    lens.addColorStop(1, "rgba(18,47,58,.23)");
    ctx.fillStyle = lens; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, .12, Math.PI * .88);
    ctx.strokeStyle = "rgba(20,52,65,.28)"; ctx.lineWidth = Math.max(.35, radius * .09); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-rx * .13, -ry * .13, rx * .8, ry * .8, 0, Math.PI * 1.05, Math.PI * 1.65);
    ctx.strokeStyle = "rgba(255,255,255,.72)"; ctx.lineWidth = Math.max(.4, radius * .12); ctx.stroke();
    if (radius > 2) {
      ctx.beginPath(); ctx.ellipse(-rx * .3, -ry * .4, rx * .15, ry * .1, -.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fill();
    }
    ctx.restore();
  }
  function drawFog() {
    if (!loaded || !width || !height) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, width, height);
    if (clearAll) return;
    // A translucent wet film: the photo remains readable behind the glass.
    ctx.drawImage(photo, 0, 0, width, height);
    ctx.save(); ctx.filter = `blur(${Math.min(7, width * .006)}px)`;
    ctx.drawImage(photo, 0, 0, width, height); ctx.restore();
    const haze = ctx.createLinearGradient(0, 0, width, height);
    haze.addColorStop(0, "rgba(236,246,249,.18)");
    haze.addColorStop(.5, "rgba(220,237,242,.12)");
    haze.addColorStop(1, "rgba(243,250,252,.23)");
    ctx.fillStyle = haze; ctx.fillRect(0, 0, width, height);
    if (grainCtx) { ctx.fillStyle = ctx.createPattern(grain, "repeat"); ctx.fillRect(0, 0, width, height); }
    let seed = 1127;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const unit = width / 900;
    // Fine condensation, medium beads and a few larger refracting droplets.
    for (let i = 0; i < 1700; i++) {
      const x = random() * width, y = random() * height, r = (.22 + random() * .85) * unit;
      ctx.fillStyle = i % 3 ? "rgba(255,255,255,.36)" : "rgba(27,63,77,.16)";
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 230; i++) waterDrop(random() * width, random() * height, (1.2 + random() * 2.7) * unit, 1 + random() * .42, (random() - .5) * .35);
    for (let i = 0; i < 30; i++) waterDrop(random() * width, random() * height, (4.3 + random() * 4.8) * unit, 1 + random() * .45, (random() - .5) * .2, true);
    // Narrow irregular rivulets left by droplets sliding down the glass.
    for (let i = 0; i < 9; i++) {
      const x = random() * width, y = random() * height * .8, length = (24 + random() * 95) * unit;
      const drift = (random() - .5) * 14 * unit;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - drift, y + length * .3, x + drift, y + length * .7, x + drift * .4, y + length);
      const trail = ctx.createLinearGradient(x, y, x, y + length);
      trail.addColorStop(0, "rgba(255,255,255,0)"); trail.addColorStop(.7, "rgba(255,255,255,.38)"); trail.addColorStop(1, "rgba(56,89,101,.18)");
      ctx.strokeStyle = trail; ctx.lineWidth = (1 + random() * 1.5) * unit; ctx.lineCap = "round"; ctx.stroke();
      waterDrop(x + drift * .4, y + length, (2.8 + random() * 2) * unit, 1.5, 0, true);
    }
    for (const mark of marks) brush(mark.x * width, mark.y * height, mark.r * width);
  }
  function resize() {
    const box = frame.getBoundingClientRect();
    width = frame.clientWidth; height = frame.clientHeight;
    if (!box.width || !box.height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    last = null;
    drawFog();
  }
  function wipe(event) {
    if (!loaded || clearAll || (event.pointerType !== "mouse" && activePointer !== event.pointerId)) return;
    const box = canvas.getBoundingClientRect();
    const point = { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) { last = null; return; }
    const radius = Math.max(24, Math.min(62, width * .065));
    const from = last || point, distance = Math.hypot((point.x - from.x) * width, (point.y - from.y) * height);
    const steps = Math.max(1, Math.ceil(distance / (radius * .32)));
    for (let i = 1; i <= steps; i++) {
      const mark = { x: from.x + (point.x - from.x) * i / steps, y: from.y + (point.y - from.y) * i / steps, r: radius / width };
      marks.push(mark); brush(mark.x * width, mark.y * height, radius);
    }
    last = point;
    frame.classList.add("is-touched");
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) return;
    activePointer = event.pointerId; last = null;
    canvas.setPointerCapture(event.pointerId);
    wipe(event);
  });
  canvas.addEventListener("pointermove", wipe);
  canvas.addEventListener("pointerleave", () => { last = null; });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(type, (event) => {
    if (activePointer === event.pointerId) { activePointer = null; last = null; }
  });
  reset.addEventListener("click", () => {
    marks.length = 0; clearAll = false; last = null;
    frame.classList.remove("is-touched"); drawFog();
    status.textContent = "水雾又回来了，再慢慢擦一擦吧 ♡";
  });
  clear.addEventListener("click", () => {
    marks.length = 0; clearAll = true; last = null;
    ctx.clearRect(0, 0, width, height); frame.classList.add("is-touched");
    status.textContent = "看清这一刻了。想再玩一次，可以点击“重新起雾”。";
  });
  function ready() {
    if (!photo.naturalWidth) return;
    loaded = true; resize(); frame.classList.add("is-ready");
    reset.disabled = clear.disabled = false;
    opacity.disabled = false;
    status.textContent = "水雾已起，轻轻擦开，就能看见他。";
  }
  photo.addEventListener("load", ready);
  photo.addEventListener("error", () => {
    loaded = false; canvas.hidden = true; frame.classList.add("is-touched");
    reset.disabled = clear.disabled = true;
    opacity.disabled = true;
    status.textContent = "照片暂时加载失败，请刷新网页后重试。";
  });
  if (photo.complete && photo.naturalWidth) ready();
  if ("ResizeObserver" in window) new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(resize);
  }).observe(frame);
  else addEventListener("resize", resize);
})();
