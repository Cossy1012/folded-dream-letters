(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const video = $("#cameraVideo"), enable = $("#enableCamera"), take = $("#takePhoto"), stop = $("#stopCamera");
  const deviceSelect = $("#cameraDevice"), refreshDevices = $("#refreshCameras"), deviceHint = $("#cameraDeviceHint");
  const delaySelect = $("#cameraDelay"), frameSelect = $("#photoFrame"), cancel = $("#cancelCapture");
  const countdown = $("#cameraCountdown"), countdownNumber = $("#cameraCountdownNumber");
  const cameraStatus = $("#cameraStatus"), indicator = $("#cameraIndicator"), download = $("#downloadPhoto");
  const preview = $("#framePreview");
  const personOverlay = $("#cameraPersonOverlay"), personGuide = $("#personFrameGuide");
  const portraits = new Map();
  const status = (text, error = false) => {
    cameraStatus.textContent = text;
    cameraStatus.classList.toggle("is-error", error);
  };
  const frames = {
    blue: { name: "蓝色信笺", paper: "#f6fcff", accent: "#6a9db5", caption: "A little blue moment, folded for you." },
    polaroid: { name: "奶油拍立得", paper: "#fff9ed", accent: "#ad8c72", caption: "Dear. LOEY, keep this little moment." },
    film: { name: "复古胶片", paper: "#1c2633", accent: "#d4b989", caption: "LOEY  /  OUR BLUE ARCHIVE" },
    stars: { name: "星光纪念", paper: "#18365b", accent: "#a9d6f3", caption: "You are my little blue star." },
    loey: { name: "LOEY 透明人物合拍", paper: "#f6fcff", accent: "#6a9db5", caption: "LOEY + YOU · Stay with me, my love.", portrait: "loey-person-cutout.png" },
    "loey-peace": { name: "LOEY 比耶合拍", paper: "#f6fcff", accent: "#6a9db5", caption: "LOEY + YOU · A little peace, a little love.", portrait: "loey-peace-cutout.png" },
    "loey-heart": { name: "LOEY 爱心合拍", paper: "#f6fcff", accent: "#6a9db5", caption: "LOEY + YOU · All my little hearts for you.", portrait: "loey-heart-cutout.png" },
    "loey-smile": { name: "LOEY 笑脸合拍", paper: "#f6fcff", accent: "#6a9db5", caption: "LOEY + YOU · Keep this little smile.", portrait: "loey-smile-cutout.png" },
    "loey-rose": { name: "LOEY 玫瑰合拍", paper: "#fff8f8", accent: "#bd8fa2", caption: "LOEY + YOU · A rose, folded with love.", portrait: "loey-rose-cutout.png" },
    "loey-school-v": { name: "LOEY 校服比耶", paper: "#b9001b", accent: "#efb9c2", caption: "LOEY + YOU · A little school-day love.", portrait: "loey-school-v-cutout.png" },
    "loey-school-side": { name: "LOEY 校服侧身", paper: "#b9001b", accent: "#efb9c2", caption: "LOEY + YOU · A little school-day love.", portrait: "loey-school-side-cutout.png" },
    "loey-school-smile": { name: "LOEY 校服笑眼", paper: "#b9001b", accent: "#efb9c2", caption: "LOEY + YOU · A little school-day love.", portrait: "loey-school-smile-cutout.png" },
    "loey-school-heart": { name: "LOEY 校服脸颊心", paper: "#b9001b", accent: "#efb9c2", caption: "LOEY + YOU · A little school-day love.", portrait: "loey-school-heart-cutout.png" }
  };
  let stream = null, starting = false, rendering = false, refreshing = false;
  let cameraVersion = 0, photoVersion = 0, listVersion = 0, countdownTimer = 0, countdownDeadline = 0;
  let rawPhoto = null, photoDate = null, photoUrl = "";

  function ready() {
    return Boolean(stream?.getVideoTracks().some((track) => track.readyState === "live") && video.videoWidth && video.videoHeight);
  }
  function cameraSize() {
    const scale = Math.min(1, 1920 / Math.max(video.videoWidth || 1104, video.videoHeight || 828));
    return { width: Math.round((video.videoWidth || 1104) * scale), height: Math.round((video.videoHeight || 828) * scale) };
  }
  function syncLiveGeometry() {
    if (!video.videoWidth || !video.videoHeight) return;
    const size = cameraSize();
    video.parentElement.style.aspectRatio = `${size.width} / ${size.height}`;
    personOverlay.width = size.width; personOverlay.height = size.height;
  }
  function currentPortrait(frameKey = frameSelect.value) {
    return portraits.get(frames[frameKey]?.portrait);
  }
  function loadPortrait(frameKey = frameSelect.value) {
    const file = frames[frameKey]?.portrait;
    if (!file || portraits.has(file)) return;
    const item = { image: new Image(), state: "loading" };
    portraits.set(file, item);
    item.image.addEventListener("load", () => {
      item.state = "ready";
      if (frames[frameSelect.value]?.portrait === file) { updateOverlay(); renderPhoto(); }
      updateControls();
    });
    item.image.addEventListener("error", () => {
      item.state = "error";
      if (frames[frameSelect.value]?.portrait === file) updateOverlay();
      updateControls();
    });
    item.image.src = `./assets/${file}?v=20261021-portraits`;
  }
  function updateControls() {
    take.disabled = starting || !ready() || Boolean(countdownDeadline) || rendering || (Boolean(frames[frameSelect.value]?.portrait) && currentPortrait()?.state !== "ready");
    take.textContent = countdownDeadline ? "倒计时中…" : rendering ? "正在生成…" : "拍一张 ♡";
    enable.disabled = starting || Boolean(stream);
    enable.textContent = starting ? "等待授权…" : stream ? "相机已开启" : "开启相机";
    stop.disabled = !starting && !stream;
    delaySelect.disabled = frameSelect.disabled = Boolean(countdownDeadline) || rendering;
    deviceSelect.disabled = starting;
    refreshDevices.disabled = starting || refreshing || !navigator.mediaDevices?.enumerateDevices;
  }
  function cancelCountdown(notify = false) {
    const wasCounting = Boolean(countdownDeadline);
    clearTimeout(countdownTimer);
    countdownTimer = countdownDeadline = 0;
    countdown.hidden = cancel.hidden = true;
    updateControls();
    if (notify && wasCounting) status("定时拍照已取消，准备好后可以重新拍摄。");
  }
  function releaseCamera() {
    cancelCountdown();
    const previous = stream;
    stream = null;
    previous?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    video.hidden = true;
    video.parentElement.style.removeProperty("aspect-ratio");
    personOverlay.hidden = true;
    $("#cameraPlaceholder").hidden = false;
    indicator.textContent = "相机未开启";
    indicator.classList.remove("is-live");
    updateControls();
  }
  function stopCamera(message = "相机已关闭。你可以随时再次开启。") {
    cameraVersion++;
    starting = false;
    releaseCamera();
    status(message);
  }
  async function refreshCameraDevices(notify = false) {
    if (!navigator.mediaDevices?.enumerateDevices || document.hidden) return;
    const request = ++listVersion, cameraAtStart = cameraVersion;
    refreshing = true;
    updateControls();
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      if (request !== listVersion || cameraAtStart !== cameraVersion) return;
      const devices = [...new Map(all.filter((device) => device.kind === "videoinput" && device.deviceId)
        .map((device) => [device.deviceId, device])).values()];
      const activeId = stream?.getVideoTracks()[0]?.getSettings().deviceId || "";
      const wantedId = activeId || deviceSelect.value;
      const automatic = document.createElement("option");
      automatic.value = "";
      automatic.textContent = "自动选择";
      deviceSelect.replaceChildren(automatic);
      devices.forEach((device, index) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || `相机 ${index + 1}（开启后显示名称）`;
        deviceSelect.appendChild(option);
      });
      const found = devices.some((device) => device.deviceId === wantedId);
      deviceSelect.value = found ? wantedId : "";
      deviceHint.textContent = devices.length ? `${notify ? "已刷新 · " : ""}找到 ${devices.length} 个相机，可选择电脑内置或外接摄像头。` : "请先开启并允许相机；连接 USB 摄像头后再点“刷新设备”。";
      if (activeId && !found) stopCamera("当前摄像头已断开或不再可用。请选择其他设备，再开启相机。");
    } catch {
      if (request === listVersion) deviceHint.textContent = "设备列表暂时无法读取，请检查相机权限后再次刷新。";
    } finally {
      if (request === listVersion) { refreshing = false; updateControls(); }
    }
  }
  const cameraErrors = {
    NotAllowedError: "相机权限未获允许。请在浏览器地址栏的权限设置中允许使用相机后重试。",
    NotFoundError: "没有找到可用相机，请连接电脑或 USB 摄像头后刷新设备列表。",
    NotReadableError: "相机可能正在被其他应用占用，请关闭占用相机的应用后重试。",
    OverconstrainedError: "所选摄像头暂时不可用，请刷新设备并选择其他相机。",
    SecurityError: "浏览器阻止了相机访问，请检查网站相机权限。"
  };
  async function startCamera(deviceId = "") {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status("请通过 HTTPS 网页或 localhost 本机预览打开，再使用支持相机的浏览器。", true);
      return;
    }
    const version = ++cameraVersion;
    releaseCamera();
    starting = true;
    updateControls();
    status("请在浏览器弹出的提示中允许使用相机。");
    try {
      const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        width: { ideal: 1280 }, height: { ideal: 960 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" })
      } });
      if (version !== cameraVersion) { next.getTracks().forEach((track) => track.stop()); return; }
      stream = next;
      video.srcObject = stream;
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState !== "live") throw new DOMException("Camera stream ended", "NotReadableError");
      video.classList.toggle("is-mirrored", track?.getSettings().facingMode !== "environment");
      track?.addEventListener("ended", () => {
        if (version === cameraVersion) {
          stopCamera("摄像头连接已断开，定时拍照已取消。请检查设备后重新开启。");
          void refreshCameraDevices();
        }
      });
      video.hidden = false;
      $("#cameraPlaceholder").hidden = true;
      await video.play();
      if (version !== cameraVersion) return;
      if (track.readyState !== "live") throw new DOMException("Camera stream ended", "NotReadableError");
      starting = false;
      indicator.textContent = "相机已开启";
      indicator.classList.add("is-live");
      syncLiveGeometry();
      updateControls();
      updateOverlay();
      status("准备好了，选择定时和相框，再点击“拍一张” ♡");
      void refreshCameraDevices();
    } catch (error) {
      if (version !== cameraVersion) return;
      starting = false;
      releaseCamera();
      status(cameraErrors[error.name] || "暂时无法开启相机，请检查连接和浏览器权限后重试。", true);
    }
  }

  function star(ctx, x, y, radius) {
    ctx.beginPath();
    for (let point = 0; point < 10; point++) {
      const angle = point * Math.PI / 5 - Math.PI / 2;
      const r = point % 2 ? radius * .42 : radius;
      const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
      if (point) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Keep the cutout in the same position in live preview and the saved photo.
  function paintPerson(ctx, width, height, frameKey = frameSelect.value) {
    const item = currentPortrait(frameKey);
    if (item?.state !== "ready") return;
    const person = item.image;
    const scale = Math.min(height / person.naturalHeight, width * .72 / person.naturalWidth);
    const w = person.naturalWidth * scale, h = person.naturalHeight * scale;
    ctx.drawImage(person, -width * .015, height - h, w, h);
  }
  function updateOverlay() {
    const selected = Boolean(frames[frameSelect.value]?.portrait);
    const personState = currentPortrait()?.state || "loading";
    personGuide.hidden = !selected;
    personGuide.textContent = personState === "ready"
      ? "LOEY 在左边，留右边给你 ♡ 对着预览调整站位，拍下一张属于你们的合照。"
      : personState === "loading" ? "正在加载透明人物相框，请稍等…" : "人物素材暂时加载失败，请刷新网页后重试。";
    $("#frameTip").textContent = selected ? "透明人物会一起保存在下载的照片里，也可以拍完再换其他相框。" : "拍完也能换相框，喜欢哪一款就下载哪一款。";
    personOverlay.hidden = !selected || !ready() || personState !== "ready";
    const ctx = personOverlay.getContext("2d");
    if (ctx) { ctx.clearRect(0, 0, personOverlay.width, personOverlay.height); if (!personOverlay.hidden) paintPerson(ctx, personOverlay.width, personOverlay.height); }
  }
  function paintFrame(ctx, image, frameKey, date) {
    const frame = frames[frameKey] || frames.blue;
    const width = ctx.canvas.width, height = ctx.canvas.height;
    const unit = Math.min(width, height) / 828, inset = 12 * unit;
    ctx.clearRect(0, 0, width, height);
    if (image === demo) paintDemo(ctx, width, height, Boolean(frame.portrait));
    else ctx.drawImage(image, 0, 0, width, height);
    if (frame.portrait) paintPerson(ctx, width, height, frameKey);
    // The frame sits inside the photo: no extra canvas, paper margins or footer.
    ctx.strokeStyle = frameKey === "polaroid" ? frame.paper : frame.portrait ? frame.paper : frame.accent;
    ctx.lineWidth = (frameKey === "polaroid" ? 12 : frame.portrait ? 7 : 2) * unit;
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    if (frameKey === "film") {
      ctx.fillStyle = "#1c2633b3";
      ctx.fillRect(0, 0, 28 * unit, height); ctx.fillRect(width - 28 * unit, 0, 28 * unit, height);
      ctx.fillStyle = "#e9ddbc";
      for (let y = 22 * unit; y < height; y += 64 * unit) {
        ctx.fillRect(8 * unit, y, 12 * unit, 25 * unit); ctx.fillRect(width - 20 * unit, y, 12 * unit, 25 * unit);
      }
    } else if (frameKey === "stars") {
      ctx.fillStyle = "#efdb9a";
      [[.06, .07, 12], [.3, .035, 7], [.84, .06, 10], [.96, .35, 9], [.04, .73, 8], [.95, .83, 12]].forEach(([x, y, r]) => star(ctx, width * x, height * y, r * unit));
    }
    const shade = ctx.createLinearGradient(0, height - 100 * unit, 0, height);
    shade.addColorStop(0, "rgba(9,30,42,0)"); shade.addColorStop(1, "rgba(9,30,42,.48)");
    ctx.fillStyle = shade; ctx.fillRect(0, height - 100 * unit, width, 100 * unit);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = `italic ${23 * unit}px Georgia, serif`;
    ctx.fillText(frame.caption, width / 2, height - 43 * unit, width - 64 * unit);
    ctx.font = `${13 * unit}px Arial, sans-serif`;
    ctx.fillText(`LOEY  ·  FOLDED DREAM LETTERS  ·  ${date ? date.toLocaleDateString("zh-CN") : "11.27"}`, width / 2, height - 21 * unit, width - 64 * unit);
  }
  const demo = document.createElement("canvas");
  demo.width = 1104; demo.height = 828;
  function paintDemo(ctx, width, height, portrait) {
    const unit = Math.min(width, height) / 828;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#ddf1fb"); gradient.addColorStop(1, "#eff9fd");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    const x = width * (portrait ? .81 : .5);
    ctx.textAlign = "center"; ctx.fillStyle = "#80bed8";
    ctx.font = `${100 * unit}px Georgia, serif`; ctx.fillText("♡", x, height * .43);
    ctx.fillStyle = "#6198b0"; ctx.font = `${32 * unit}px Georgia, serif`;
    ctx.fillText(portrait ? "YOU" : "YOUR BLUE MOMENT", x, height * .53, width * (portrait ? .33 : .85));
    ctx.font = `${16 * unit}px Arial, sans-serif`;
    ctx.fillText("A LITTLE MOMENT WITH LOEY", x, height * .59, width * (portrait ? .33 : .85));
  }
  function renderPhoto(success = "相框已更新，可以下载这张纪念照啦 ♡") {
    const frameKey = Object.hasOwn(frames, frameSelect.value) ? frameSelect.value : "blue";
    const frame = frames[frameKey];
    const version = ++photoVersion;
    $("#frameCaption").textContent = `${rawPhoto ? "纪念照" : "相框预览"} · ${frame.name}`;
    preview.setAttribute("aria-label", `${frame.name}相框预览`);
    if (!rawPhoto || (frame.portrait && currentPortrait(frameKey)?.state !== "ready")) {
      rendering = false;
      const size = rawPhoto || (ready() ? cameraSize() : demo);
      preview.width = size.width; preview.height = size.height;
      const ctx = preview.getContext("2d"); if (ctx) paintFrame(ctx, demo, frameKey, null);
      $("#capturedPhoto").hidden = true; $("#photoEmpty").hidden = false;
      download.hidden = $("#retakePhoto").hidden = true;
      download.removeAttribute("href"); download.setAttribute("aria-disabled", "true");
      updateControls();
      return;
    }
    const canvas = document.createElement("canvas"); canvas.width = rawPhoto.width; canvas.height = rawPhoto.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { status("浏览器暂时无法生成照片，请换个浏览器重试。", true); return; }
    rendering = true;
    updateControls();
    download.setAttribute("aria-disabled", "true");
    download.removeAttribute("href");
    paintFrame(ctx, rawPhoto, frameKey, photoDate);
    canvas.toBlob((blob) => {
      if (version !== photoVersion) return;
      rendering = false;
      updateControls();
      if (!blob) { status("照片生成失败，请重新选择相框再试一次。", true); return; }
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = URL.createObjectURL(blob);
      $("#capturedPhoto").src = photoUrl;
      $("#capturedPhoto").alt = `带有${frame.name}相框的 LOEY 纪念照`;
      $("#capturedPhoto").hidden = false;
      $("#photoEmpty").hidden = true;
      download.href = photoUrl;
      download.download = `${frame.portrait ? "LOEY" : "PCY"}-${frameKey}-${photoDate.toISOString().replace(/[:.]/g, "-")}.png`;
      download.setAttribute("aria-disabled", "false");
      download.hidden = $("#retakePhoto").hidden = false;
      status(success);
    }, "image/png");
  }
  function capturePhoto() {
    if (!ready() || starting || rendering) return;
    try {
      const size = cameraSize();
      const image = document.createElement("canvas"); image.width = size.width; image.height = size.height;
      const ctx = image.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      if (video.classList.contains("is-mirrored")) { ctx.translate(size.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, 0, 0, size.width, size.height);
      rawPhoto = image;
      photoDate = new Date();
      renderPhoto("纪念照已经准备好，可以换相框或直接下载 ♡");
    } catch { status("相机画面尚未准备好，请稍等一下再拍。", true); updateControls(); }
  }
  function requestPhoto() {
    if (!ready() || starting || rendering || countdownDeadline) return;
    const seconds = [3, 5, 10].includes(Number(delaySelect.value)) ? Number(delaySelect.value) : 0;
    if (!seconds) { capturePhoto(); return; }
    const version = cameraVersion;
    countdownDeadline = performance.now() + seconds * 1000;
    countdown.hidden = cancel.hidden = false;
    updateControls();
    let lastNumber = 0;
    const tick = () => {
      if (!ready() || version !== cameraVersion || document.hidden) { cancelCountdown(); return; }
      const remaining = countdownDeadline - performance.now();
      if (remaining <= 0) { cancelCountdown(); capturePhoto(); return; }
      const number = Math.ceil(remaining / 1000);
      if (number !== lastNumber) { countdownNumber.textContent = String(number); status(`${number} 秒后拍照，准备好，笑一笑 ♡`); lastNumber = number; }
      countdownTimer = setTimeout(tick, Math.min(100, remaining));
    };
    tick();
  }
  const refreshLiveView = () => {
    syncLiveGeometry(); updateControls(); updateOverlay();
    if (!rawPhoto) renderPhoto();
  };
  video.addEventListener("loadeddata", refreshLiveView);
  video.addEventListener("resize", refreshLiveView);
  enable.addEventListener("click", () => void startCamera(deviceSelect.value));
  stop.addEventListener("click", () => stopCamera());
  take.addEventListener("click", requestPhoto);
  cancel.addEventListener("click", () => cancelCountdown(true));
  frameSelect.addEventListener("change", () => { loadPortrait(); updateOverlay(); renderPhoto(); });
  refreshDevices.addEventListener("click", () => void refreshCameraDevices(true));
  deviceSelect.addEventListener("change", () => { if (stream || starting) void startCamera(deviceSelect.value); });
  navigator.mediaDevices?.addEventListener?.("devicechange", () => void refreshCameraDevices(true));
  $("#retakePhoto").addEventListener("click", () => {
    if (stream) { status("调整好姿势，再点击“拍一张”吧。"); video.focus(); }
    else void startCamera(deviceSelect.value);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && (stream || starting)) stopCamera("离开页面时已关闭相机并取消定时；回来后可以重新开启。");
    else if (!document.hidden) void refreshCameraDevices();
  });
  addEventListener("pagehide", (event) => {
    stopCamera();
    photoVersion++;
    rendering = false;
    if (!event.persisted && photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = ""; }
  });
  addEventListener("pageshow", (event) => { if (event.persisted && rawPhoto) renderPhoto(); });
  loadPortrait("loey");
  renderPhoto();
  updateControls();
  void refreshCameraDevices();
})();
