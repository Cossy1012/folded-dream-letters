(() => {
  "use strict";
  const frame = document.querySelector("#mistFrame");
  const photo = document.querySelector("#mistPhoto"), canvas = document.querySelector("#mistCanvas");
  const reset = document.querySelector("#resetMist"), clear = document.querySelector("#clearMist");
  const status = document.querySelector("#mistStatus"), ctx = canvas?.getContext("2d");
  if (!frame || !photo || !ctx) return;

  let width = 0, height = 0, loaded = false, clearAll = false, activePointer = null, last = null, resizeFrame = 0;
  const marks = [];
  const grain = document.createElement("canvas");
  grain.width = grain.height = 128;
  const grainCtx = grain.getContext("2d");
  if (grainCtx) {
    const pixels = grainCtx.createImageData(128, 128);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
      pixels.data[i + 3] = Math.floor(Math.random() * 18);
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
  function drawFog() {
    if (!loaded || !width || !height) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, width, height);
    if (clearAll) return;
    const blur = Math.min(24, width * .035);
    ctx.save(); ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(photo, -blur, -blur, width + blur * 2, height + blur * 2);
    ctx.restore();
    const haze = ctx.createLinearGradient(0, 0, width, height);
    haze.addColorStop(0, "rgba(239,249,252,.83)");
    haze.addColorStop(.5, "rgba(222,239,246,.78)");
    haze.addColorStop(1, "rgba(244,251,253,.86)");
    ctx.fillStyle = haze; ctx.fillRect(0, 0, width, height);
    if (grainCtx) { ctx.fillStyle = ctx.createPattern(grain, "repeat"); ctx.fillRect(0, 0, width, height); }
    // Repeatable condensation droplets stay in place when the window changes size.
    let seed = 1127;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 190; i++) {
      const x = random() * width, y = random() * height;
      const r = (1 + random() * 2.6) * Math.min(1.2, width / 650);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(167,200,214,.18)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.54)"; ctx.lineWidth = .8; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x - r * .2, y - r * .45, r * .22, r * .35, -.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.fill();
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
    status.textContent = "水雾已起，轻轻擦开，就能看见他。";
  }
  photo.addEventListener("load", ready);
  photo.addEventListener("error", () => {
    loaded = false; canvas.hidden = true; frame.classList.add("is-touched");
    reset.disabled = clear.disabled = true;
    status.textContent = "照片暂时加载失败，请刷新网页后重试。";
  });
  if (photo.complete && photo.naturalWidth) ready();
  if ("ResizeObserver" in window) new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(resize);
  }).observe(frame);
  else addEventListener("resize", resize);
})();
