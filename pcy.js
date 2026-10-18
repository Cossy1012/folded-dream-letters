(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const readStorage = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const status = (element, text, error = false) => {
    element.textContent = text;
    element.classList.toggle("is-error", error);
  };

  // Decorative rain: capped at 30fps; paused when the tab is hidden.
  const rainCanvas = $("#rainCanvas");
  const rainContext = rainCanvas.getContext("2d");
  const rainToggle = $("#rainToggle");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let rainOn = !reducedMotion.matches && readStorage("pcy-rain", true) !== false;
  let width = 0, height = 0, drops = [], rainFrame = 0, lastFrame = 0;
  function resizeRain() {
    width = innerWidth;
    height = innerHeight;
    const scale = Math.min(devicePixelRatio || 1, 2);
    rainCanvas.width = width * scale;
    rainCanvas.height = height * scale;
    rainContext?.setTransform(scale, 0, 0, scale, 0, 0);
    drops = Array.from({ length: Math.max(35, Math.min(100, Math.round(width * height / 15000))) }, () => ({
      x: Math.random() * (width + 100), y: Math.random() * height,
      length: 12 + Math.random() * 20, speed: 320 + Math.random() * 420,
      alpha: .15 + Math.random() * .22
    }));
  }
  function animateRain(time) {
    if (!rainOn || document.hidden || !rainContext) return;
    rainFrame = requestAnimationFrame(animateRain);
    if (lastFrame && time - lastFrame < 32) return;
    const dt = lastFrame ? Math.min((time - lastFrame) / 1000, .06) : 1 / 30;
    lastFrame = time;
    rainContext.clearRect(0, 0, width, height);
    rainContext.lineWidth = 1;
    for (const drop of drops) {
      drop.x -= drop.speed * dt * .13;
      drop.y += drop.speed * dt;
      if (drop.y > height + 35 || drop.x < -35) {
        drop.y = -35;
        drop.x = Math.random() * (width + 100);
      }
      rainContext.strokeStyle = `rgba(64,155,202,${drop.alpha})`;
      rainContext.beginPath();
      rainContext.moveTo(drop.x, drop.y);
      rainContext.lineTo(drop.x - drop.length * .13, drop.y + drop.length);
      rainContext.stroke();
    }
  }
  function updateRain() {
    cancelAnimationFrame(rainFrame);
    lastFrame = 0;
    rainContext?.clearRect(0, 0, width, height);
    rainToggle.setAttribute("aria-pressed", String(rainOn));
    rainToggle.setAttribute("aria-label", rainOn ? "关闭细雨特效" : "开启细雨特效");
    $("#rainLabel").textContent = rainOn ? "细雨 · 开" : "细雨 · 关";
    if (rainOn && !document.hidden && rainContext) rainFrame = requestAnimationFrame(animateRain);
  }
  if (!rainContext) { rainOn = false; rainToggle.disabled = true; }
  rainToggle.addEventListener("click", () => {
    rainOn = !rainOn;
    try { localStorage.setItem("pcy-rain", JSON.stringify(rainOn)); } catch { /* Preference is optional. */ }
    updateRain();
  });
  reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) { rainOn = false; updateRain(); } });
  addEventListener("resize", resizeRain, { passive: true });
  document.addEventListener("visibilitychange", updateRain);
  resizeRain();
  updateRain();

  // Guestbook: local preview or a shared Supabase table, without a silent fallback.
  const config = window.PCY_CONFIG || {};
  const publicUrl = String(config.supabaseUrl || "").trim().replace(/\/+$/, "");
  const publicKey = String(config.supabasePublishableKey || "").trim();
  const isPublic = Boolean(publicUrl && publicKey);
  const boardForm = $("#guestbookForm");
  const boardList = $("#guestbookList");
  const boardStatus = $("#guestbookStatus");
  const submit = $("#guestSubmit");
  const refresh = $("#refreshMessages");
  const more = $("#moreMessages");
  const nameInput = $("#guestName");
  const bodyInput = $("#guestMessage");
  const localKey = "pcy-guestbook-v1";
  let rows = [], offset = 0, loadVersion = 0, loading = false;
  const pageSize = 20;
  const validRow = (row) => row && typeof row.id === "string" &&
    typeof row.name === "string" && typeof row.body === "string" &&
    row.name.length <= 20 && row.body.length > 0 && row.body.length <= 300 &&
    Number.isFinite(Date.parse(row.created_at));
  function localRows() {
    const saved = readStorage(localKey, []);
    return (Array.isArray(saved) ? saved : []).filter(validRow)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }
  let configured = true;
  if (publicUrl || publicKey) {
    try {
      if (!isPublic || new URL(publicUrl).protocol !== "https:" || !publicKey.startsWith("sb_publishable_")) throw new Error("Invalid public configuration");
    } catch { configured = false; }
  }
  $("#guestbookMode").textContent = configured ? (isPublic ? "公开留言" : "本机预览") : "暂不可用";
  $("#guestbookNotice").textContent = isPublic ? "留言会公开显示，请留下愿意与大家分享的话。" : "本机预览中的留言仅在此设备保存，其他访客暂时看不到。";
  async function boardRequest(query, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${publicUrl}/rest/v1/guestbook_messages?${query}`, {
        ...options,
        headers: { apikey: publicKey, "Content-Type": "application/json", ...options.headers },
        signal: controller.signal,
        cache: "no-store"
      });
      if (!response.ok) throw new Error("Guestbook request failed");
      const data = await response.json();
      if (!Array.isArray(data) || !data.every(validRow)) throw new Error("Invalid guestbook response");
      return data;
    } finally { clearTimeout(timer); }
  }
  function renderMessages() {
    boardList.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "guestbook-empty";
      empty.textContent = "还没有留言。来留下这片蓝色里的第一句问候吧。";
      boardList.appendChild(empty);
      return;
    }
    for (const row of rows) {
      const article = document.createElement("article");
      article.className = "guest-message";
      const text = document.createElement("p");
      text.textContent = row.body;
      const footer = document.createElement("footer");
      const author = document.createElement("strong");
      author.textContent = `FROM. ${row.name}`;
      const date = document.createElement("time");
      date.dateTime = row.created_at;
      date.textContent = new Date(row.created_at).toLocaleDateString("zh-CN");
      footer.append(author, date);
      article.append(text, footer);
      boardList.appendChild(article);
    }
  }
  async function loadMessages(reset = true) {
    const version = ++loadVersion;
    const start = reset ? 0 : offset;
    loading = true;
    refresh.disabled = more.disabled = true;
    boardList.setAttribute("aria-busy", "true");
    status(boardStatus, "正在展开留言……");
    try {
      const next = isPublic ? await boardRequest(`select=id,name,body,created_at&order=created_at.desc,id.desc&limit=${pageSize + 1}&offset=${start}`) : localRows().slice(start, start + pageSize + 1);
      if (version !== loadVersion) return false;
      const page = next.slice(0, pageSize);
      const combined = reset ? page : [...rows, ...page];
      rows = [...new Map(combined.map((row) => [row.id, row])).values()];
      offset = start + page.length;
      more.hidden = next.length <= pageSize;
      renderMessages();
      status(boardStatus, "");
      return true;
    } catch {
      if (version !== loadVersion) return false;
      status(boardStatus, "留言暂时加载不了，请稍后点击刷新。", true);
      if (!rows.length) {
        const error = document.createElement("p");
        error.className = "guestbook-empty";
        error.textContent = "暂时无法读取留言。";
        boardList.replaceChildren(error);
      }
      return false;
    } finally {
      if (version === loadVersion) {
        loading = false;
        refresh.disabled = more.disabled = false;
        boardList.setAttribute("aria-busy", "false");
      }
    }
  }
  bodyInput.addEventListener("input", () => { $("#guestCount").textContent = String(bodyInput.value.length); });
  boardForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled || !configured) return;
    const name = nameInput.value.trim() || "LOEY";
    const body = bodyInput.value.trim();
    if (!body || name.length > 20 || body.length > 300) {
      status(boardStatus, "请写下 1–300 字的留言，名字不超过 20 字。", true);
      return;
    }
    submit.disabled = true;
    status(boardStatus, "正在寄出留言……");
    try {
      if (isPublic) {
        const saved = await boardRequest("select=id,name,body,created_at", {
          method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name, body })
        });
        if (saved.length !== 1) throw new Error("Unconfirmed post");
      } else {
        const saved = localRows();
        // Keep all local messages; a full browser store reports failure without losing the draft.
        saved.unshift({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, name, body, created_at: new Date().toISOString() });
        localStorage.setItem(localKey, JSON.stringify(saved));
      }
      bodyInput.value = "";
      $("#guestCount").textContent = "0";
      const refreshed = await loadMessages(true);
      status(boardStatus, refreshed ? (isPublic ? "留言已寄出，大家都能看见啦 ♡" : "留言已保存到此设备 ♡") : "留言已保存，列表暂未刷新，请稍后重试。");
    } catch {
      status(boardStatus, isPublic ? "发送结果尚未确认，请先刷新留言再重试。你写的内容已保留。" : "浏览器未能保存留言。你写的内容还在，请检查浏览器存储设置后再试。", true);
    } finally { submit.disabled = false; }
  });
  refresh.addEventListener("click", () => { if (!loading) void loadMessages(true); });
  more.addEventListener("click", () => { if (!loading) void loadMessages(false); });
  addEventListener("storage", (event) => { if (!isPublic && event.key === localKey && configured) void loadMessages(true); });
  if (configured) void loadMessages();
  else {
    submit.disabled = refresh.disabled = true;
    $("#guestbookNotice").textContent = "留言板暂时不可用，请稍后再来。";
    status(boardStatus, "留言连接尚未准备好。", true);
  }

  // Camera images stay on-device; the only output is an explicit PNG download.
  const video = $("#cameraVideo");
  const enable = $("#enableCamera");
  const take = $("#takePhoto");
  const stop = $("#stopCamera");
  const deviceSelect = $("#cameraDevice");
  const cameraStatus = $("#cameraStatus");
  const indicator = $("#cameraIndicator");
  let stream = null, cameraVersion = 0, photoVersion = 0, photoUrl = "";
  function releaseCamera() {
    const previous = stream;
    stream = null;
    previous?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    video.hidden = true;
    $("#cameraPlaceholder").hidden = false;
    take.disabled = stop.disabled = true;
    enable.disabled = false;
    enable.textContent = "开启相机";
    indicator.textContent = "相机未开启";
    indicator.classList.remove("is-live");
  }
  function stopCamera(message = "相机已关闭。你可以随时再次开启。") {
    cameraVersion++;
    releaseCamera();
    status(cameraStatus, message);
  }
  const cameraErrors = {
    NotAllowedError: "相机权限未获允许。请在浏览器地址栏的权限设置中允许使用相机后重试。",
    NotFoundError: "没有找到可用相机，请连接电脑相机后重试。",
    NotReadableError: "相机可能正在被其他应用占用，请关闭占用相机的应用后重试。",
    OverconstrainedError: "这台相机暂时无法使用，请选择其他相机。",
    SecurityError: "浏览器阻止了相机访问，请检查网站相机权限。"
  };
  async function startCamera(deviceId = "") {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status(cameraStatus, "请通过 HTTPS 网页或 localhost 本机预览打开，再使用支持相机的浏览器。", true);
      return;
    }
    const version = ++cameraVersion;
    releaseCamera();
    enable.disabled = true;
    enable.textContent = "等待授权…";
    stop.disabled = false;
    status(cameraStatus, "请在浏览器弹出的提示中允许使用相机。");
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 1280 }, height: { ideal: 960 }, ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }) }
      });
      if (version !== cameraVersion) { next.getTracks().forEach((track) => track.stop()); return; }
      stream = next;
      video.srcObject = stream;
      const settings = stream.getVideoTracks()[0]?.getSettings() || {};
      video.classList.toggle("is-mirrored", settings.facingMode !== "environment");
      video.hidden = false;
      $("#cameraPlaceholder").hidden = true;
      await video.play();
      if (version !== cameraVersion) return;
      take.disabled = !video.videoWidth;
      enable.textContent = "相机已开启";
      indicator.textContent = "相机已开启";
      indicator.classList.add("is-live");
      status(cameraStatus, "准备好了，点击“拍一张”留下此刻 ♡");
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (version === cameraVersion) stopCamera("相机连接已断开，请检查设备后重新开启。");
      });
      try {
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
        if (version !== cameraVersion) return;
        deviceSelect.replaceChildren();
        devices.forEach((device, index) => {
          const option = document.createElement("option");
          option.value = device.deviceId;
          option.textContent = device.label || `相机 ${index + 1}`;
          deviceSelect.appendChild(option);
        });
        deviceSelect.value = settings.deviceId || devices[0]?.deviceId || "";
        $("#cameraDeviceRow").hidden = devices.length < 2;
      } catch { $("#cameraDeviceRow").hidden = true; }
    } catch (error) {
      if (version !== cameraVersion) return;
      releaseCamera();
      status(cameraStatus, cameraErrors[error.name] || "暂时无法开启相机，请检查连接和浏览器权限后重试。", true);
    }
  }
  video.addEventListener("loadeddata", () => { if (stream) take.disabled = !video.videoWidth; });
  enable.addEventListener("click", () => void startCamera(deviceSelect.value));
  stop.addEventListener("click", () => stopCamera());
  deviceSelect.addEventListener("change", () => { if (stream) void startCamera(deviceSelect.value); });
  $("#retakePhoto").addEventListener("click", () => {
    if (stream) { video.focus(); status(cameraStatus, "调整好姿势，再点击“拍一张”吧。"); }
    else void startCamera(deviceSelect.value);
  });
  take.addEventListener("click", () => {
    if (!stream || !video.videoWidth || !video.videoHeight) return;
    const version = ++photoVersion;
    take.disabled = true;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1050;
    const ctx = canvas.getContext("2d");
    if (!ctx) { take.disabled = false; status(cameraStatus, "浏览器暂时无法生成照片，请换个浏览器重试。", true); return; }
    ctx.fillStyle = "#f6fcff";
    ctx.fillRect(0, 0, 1200, 1050);
    const ratio = 4 / 3;
    let sw = video.videoWidth, sh = video.videoHeight;
    if (sw / sh > ratio) sw = sh * ratio;
    else sh = sw / ratio;
    ctx.save();
    if (video.classList.contains("is-mirrored")) { ctx.translate(1200, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 48, 48, 1104, 828);
    ctx.restore();
    ctx.fillStyle = "#246a8b";
    ctx.textAlign = "center";
    ctx.font = "italic 36px Georgia, serif";
    ctx.fillText("A little blue moment, folded for you.", 600, 940);
    ctx.font = "20px Arial, sans-serif";
    ctx.fillStyle = "#6a9db5";
    ctx.fillText(`PCY  ·  FOLDED DREAM LETTERS  ·  ${new Date().toLocaleDateString("zh-CN")}`, 600, 994);
    canvas.toBlob((blob) => {
      if (version !== photoVersion) return;
      take.disabled = !stream;
      if (!blob) { status(cameraStatus, "照片生成失败，请再拍一次。", true); return; }
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = URL.createObjectURL(blob);
      $("#capturedPhoto").src = photoUrl;
      $("#capturedPhoto").hidden = false;
      $("#photoEmpty").hidden = true;
      const download = $("#downloadPhoto");
      download.href = photoUrl;
      download.download = `PCY-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      download.hidden = $("#retakePhoto").hidden = false;
      status(cameraStatus, "纪念照已经准备好，可以下载啦 ♡");
    }, "image/png");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && (stream || enable.disabled)) stopCamera("相机已在离开页面时关闭，回来后可再次开启。");
  });
  addEventListener("pagehide", (event) => {
    stopCamera();
    photoVersion++;
    if (!event.persisted) {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = "";
    }
  });
})();
