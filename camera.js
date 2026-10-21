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
  const person = new Image();
  let personState = "loading";
  const status = (text, error = false) => {
    cameraStatus.textContent = text;
    cameraStatus.classList.toggle("is-error", error);
  };
  const frames = {
    blue: { name: "蓝色信笺", paper: "#f6fcff", ink: "#246a8b", accent: "#6a9db5", box: [48, 48, 1104, 828], caption: "A little blue moment, folded for you." },
    polaroid: { name: "奶油拍立得", paper: "#fff9ed", ink: "#77604d", accent: "#ad8c72", box: [60, 52, 1080, 810], caption: "Dear. LOEY, keep this little moment." },
    film: { name: "复古胶片", paper: "#1c2633", ink: "#f9efd5", accent: "#d4b989", box: [84, 76, 1032, 774], caption: "LOEY  /  OUR BLUE ARCHIVE" },
    stars: { name: "星光纪念", paper: "#18365b", ink: "#f8edce", accent: "#a9d6f3", box: [64, 74, 1072, 804], caption: "You are my little blue star." },
    loey: { name: "LOEY 透明人物合拍", paper: "#f6fcff", ink: "#246a8b", accent: "#6a9db5", box: [48, 48, 1104, 828], caption: "LOEY + YOU · Stay with me, my love." }
  };
  let stream = null, starting = false, rendering = false, refreshing = false;
  let cameraVersion = 0, photoVersion = 0, listVersion = 0, countdownTimer = 0, countdownDeadline = 0;
  let rawPhoto = null, photoDate = null, photoUrl = "";

  function ready() {
    return Boolean(stream?.getVideoTracks().some((track) => track.readyState === "live") && video.videoWidth && video.videoHeight);
  }
  function updateControls() {
    take.disabled = starting || !ready() || Boolean(countdownDeadline) || rendering || (frameSelect.value === "loey" && personState !== "ready");
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
  function paintPerson(ctx, width, height) {
    if (personState !== "ready") return;
    const h = height * .98, w = h * person.naturalWidth / person.naturalHeight;
    ctx.drawImage(person, -width * .015, height - h, w, h);
  }
  function updateOverlay() {
    const selected = frameSelect.value === "loey";
    personGuide.hidden = !selected;
    personGuide.textContent = personState === "ready"
      ? "LOEY 在左边，留右边给你 ♡ 对着预览调整站位，拍下一张属于你们的合照。"
      : personState === "loading" ? "正在加载透明人物相框，请稍等…" : "人物素材暂时加载失败，请刷新网页后重试。";
    $("#frameTip").textContent = selected ? "透明人物会一起保存在下载的照片里，也可以拍完再换其他相框。" : "拍完也能换相框，喜欢哪一款就下载哪一款。";
    personOverlay.hidden = !selected || !ready() || personState !== "ready";
    const ctx = personOverlay.getContext("2d");
    if (ctx) { ctx.clearRect(0, 0, 1104, 828); if (!personOverlay.hidden) paintPerson(ctx, 1104, 828); }
  }
  function paintFrame(ctx, image, frameKey, date) {
    const frame = frames[frameKey] || frames.blue;
    ctx.fillStyle = frame.paper;
    ctx.fillRect(0, 0, 1200, 1050);
    ctx.drawImage(frameKey === "loey" && image === demo ? personDemo : image, ...frame.box);
    if (frameKey === "loey") {
      const [x, y, w, h] = frame.box;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.translate(x, y); paintPerson(ctx, w, h); ctx.restore();
    }
    ctx.strokeStyle = frame.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(...frame.box);
    if (frameKey === "film") {
      ctx.fillStyle = "#e9ddbc";
      for (let y = 54; y < 930; y += 86) { ctx.fillRect(20, y, 32, 40); ctx.fillRect(1148, y, 32, 40); }
      ctx.font = "18px monospace";
      ctx.textAlign = "left";
      ctx.fillText("27  /  NOV", 88, 44);
    } else if (frameKey === "stars") {
      ctx.fillStyle = "#efdb9a";
      [[30, 50, 13], [300, 31, 9], [820, 36, 12], [1166, 260, 13], [27, 600, 10], [1171, 836, 10], [170, 992, 12], [1040, 997, 14]].forEach(([x, y, r]) => star(ctx, x, y, r));
    } else if (frameKey === "polaroid") {
      ctx.fillStyle = "#e1cbb49c";
      for (const x of [60, 1140]) {
        ctx.save(); ctx.translate(x, 54); ctx.rotate(x === 60 ? -.55 : .55); ctx.fillRect(-45, -12, 90, 24); ctx.restore();
      }
    }
    ctx.textAlign = "center";
    ctx.fillStyle = frame.ink;
    ctx.font = frameKey === "film" ? "30px monospace" : "italic 36px Georgia, serif";
    ctx.fillText(frame.caption, 600, 940);
    ctx.font = "20px Arial, sans-serif";
    ctx.fillStyle = frame.accent;
    ctx.fillText(`LOEY  ·  FOLDED DREAM LETTERS  ·  ${date ? date.toLocaleDateString("zh-CN") : "11.27"}`, 600, 994);
  }
  const demo = document.createElement("canvas");
  demo.width = 1104; demo.height = 828;
  const demoContext = demo.getContext("2d");
  if (demoContext) {
    const gradient = demoContext.createLinearGradient(0, 0, 1104, 828);
    gradient.addColorStop(0, "#e1f2fc"); gradient.addColorStop(1, "#edf8fd");
    demoContext.fillStyle = gradient; demoContext.fillRect(0, 0, 1104, 828);
    demoContext.fillStyle = "#83c4e2"; demoContext.textAlign = "center"; demoContext.font = "150px Georgia, serif";
    demoContext.fillText("♡", 552, 410);
    demoContext.fillStyle = "#6796ac"; demoContext.font = "30px Arial, sans-serif";
    demoContext.fillText("YOUR LITTLE BLUE MOMENT", 552, 520);
  }
  const personDemo = document.createElement("canvas");
  personDemo.width = 1104; personDemo.height = 828;
  const personDemoContext = personDemo.getContext("2d");
  if (personDemoContext) {
    const gradient = personDemoContext.createLinearGradient(0, 0, 1104, 828);
    gradient.addColorStop(0, "#ddf1fb"); gradient.addColorStop(1, "#eff9fd");
    personDemoContext.fillStyle = gradient; personDemoContext.fillRect(0, 0, 1104, 828);
    personDemoContext.textAlign = "center"; personDemoContext.fillStyle = "#80bed8";
    personDemoContext.font = "100px Georgia, serif"; personDemoContext.fillText("♡", 820, 360);
    personDemoContext.fillStyle = "#6198b0"; personDemoContext.font = "34px Georgia, serif";
    personDemoContext.fillText("YOU", 820, 445);
    personDemoContext.font = "18px Arial, sans-serif";
    personDemoContext.fillText("A LITTLE MOMENT WITH LOEY", 820, 488);
  }
  function renderPhoto(success = "相框已更新，可以下载这张纪念照啦 ♡") {
    const frameKey = Object.hasOwn(frames, frameSelect.value) ? frameSelect.value : "blue";
    const frame = frames[frameKey];
    const version = ++photoVersion;
    $("#frameCaption").textContent = `${rawPhoto ? "纪念照" : "相框预览"} · ${frame.name}`;
    preview.setAttribute("aria-label", `${frame.name}相框预览`);
    if (!rawPhoto || (frameKey === "loey" && personState !== "ready")) {
      rendering = false;
      const ctx = preview.getContext("2d"); if (ctx) paintFrame(ctx, demo, frameKey, null);
      $("#capturedPhoto").hidden = true; $("#photoEmpty").hidden = false;
      download.hidden = $("#retakePhoto").hidden = true;
      download.removeAttribute("href"); download.setAttribute("aria-disabled", "true");
      updateControls();
      return;
    }
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1050;
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
      download.download = `${frameKey === "loey" ? "LOEY" : "PCY"}-${frameKey}-${photoDate.toISOString().replace(/[:.]/g, "-")}.png`;
      download.setAttribute("aria-disabled", "false");
      download.hidden = $("#retakePhoto").hidden = false;
      status(success);
    }, "image/png");
  }
  function capturePhoto() {
    if (!ready() || starting || rendering) return;
    try {
      const image = document.createElement("canvas"); image.width = 1104; image.height = 828;
      const ctx = image.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      let sw = video.videoWidth, sh = video.videoHeight;
      if (sw / sh > 4 / 3) sw = sh * 4 / 3; else sh = sw * 3 / 4;
      if (video.classList.contains("is-mirrored")) { ctx.translate(1104, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, 1104, 828);
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
  video.addEventListener("loadeddata", () => { updateControls(); updateOverlay(); });
  enable.addEventListener("click", () => void startCamera(deviceSelect.value));
  stop.addEventListener("click", () => stopCamera());
  take.addEventListener("click", requestPhoto);
  cancel.addEventListener("click", () => cancelCountdown(true));
  frameSelect.addEventListener("change", () => { updateOverlay(); renderPhoto(); });
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
  person.addEventListener("load", () => {
    personState = "ready"; updateOverlay(); updateControls();
    if (frameSelect.value === "loey") renderPhoto();
  });
  person.addEventListener("error", () => { personState = "error"; updateOverlay(); updateControls(); });
  person.src = "./assets/loey-person-cutout.png?v=20261021";
  renderPhoto();
  updateControls();
  void refreshCameraDevices();
})();
