const photoFiles = [
  "web-01.jpg",
  "web-02.jpg",
  "OplusInfoCollection_261007071710074.png",
  "mmexport1791553031076.jpg",
  "mmexport1791553040300.jpg",
  "OplusInfoCollection_261009052252364.png",
  "OplusInfoCollection_261007071720301.png",
  "web-08.png",
  "mmexport1791553037672.jpg",
  "mmexport1791553051074.jpg",
  "web-11.jpg",
  "mmexport1791553043909.jpg",
  "mmexport1791553028239.jpg",
  "OplusInfoCollection_261007072449327.png",
  "mmexport1791553062068.jpg",
  "web-16.png",
  "img-1791553317178f192cdf3de9a11455ebee680cb0668737c2f6c6b09be5b08df235aa2cc2a67a2.jpg",
  "OplusInfoCollection_261007192800236.png",
  "web-19.jpg",
  "mmexport1791553057883.jpg",
  "mmexport1791553034058.jpg",
  "mmexport1791553054427.jpg",
  "mmexport1791553047704.jpg",
  "loey-memory-20261021-01.jpg",
  "loey-memory-20261021-02.jpg",
  "loey-memory-20261021-03.jpg",
  "loey-memory-20261021-04.jpg",
  "loey-memory-20261021-05.jpg",
  "loey-memory-20261021-06.jpg",
  "loey-memory-20261021-07.jpg",
  "loey-memory-20261021-08.jpg"
];

const assetPath = (name) => `./assets/纪念册图片/${encodeURIComponent(name)}`;
const grid = document.querySelector("#photoGrid");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = lightbox.querySelector("img");
const photoIndex = document.querySelector("#photoIndex");
document.querySelector("#photoTotal").textContent = String(photoFiles.length).padStart(2, "0");
let currentPhoto = 0;

photoFiles.forEach((file, index) => {
  const button = document.createElement("button");
  button.className = "photo-card";
  button.type = "button";
  button.dataset.number = String(index + 1).padStart(2, "0");
  button.setAttribute("aria-label", `查看纪念册第 ${index + 1} 张照片`);
  button.innerHTML = `<img src="${assetPath(file)}" alt="朴灿烈纪念照片 ${index + 1}" loading="lazy" />`;
  button.addEventListener("click", () => showPhoto(index));
  grid.appendChild(button);
});

function showPhoto(index) {
  currentPhoto = (index + photoFiles.length) % photoFiles.length;
  lightboxImage.src = assetPath(photoFiles[currentPhoto]);
  photoIndex.textContent = String(currentPhoto + 1).padStart(2, "0");
  if (!lightbox.open) lightbox.showModal();
}

lightbox.querySelector(".prev").addEventListener("click", () => showPhoto(currentPhoto - 1));
lightbox.querySelector(".next").addEventListener("click", () => showPhoto(currentPhoto + 1));
lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (event) => { if (event.target === lightbox) lightbox.close(); });
document.addEventListener("keydown", (event) => {
  if (!lightbox.open) return;
  if (event.key === "ArrowLeft") showPhoto(currentPhoto - 1);
  if (event.key === "ArrowRight") showPhoto(currentPhoto + 1);
});

const stage = document.querySelector("[data-letter-stage]");
const letterCover = stage.querySelector(".letter-cover");
const closeEnvelope = stage.querySelector(".close-envelope");

function openLetter() {
  stage.classList.add("is-open");
  letterCover.setAttribute("aria-hidden", "true");
  letterCover.setAttribute("tabindex", "-1");
  stage.querySelector(".letter-open").setAttribute("aria-hidden", "false");
  startMusicOnce();
  closeEnvelope.focus();
}

letterCover.addEventListener("click", openLetter);
letterCover.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openLetter();
  }
});
closeEnvelope.addEventListener("click", () => {
  stage.classList.remove("is-open");
  letterCover.setAttribute("aria-hidden", "false");
  letterCover.setAttribute("tabindex", "0");
  stage.querySelector(".letter-open").setAttribute("aria-hidden", "true");
  letterCover.focus();
});

document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(button.dataset.scroll).scrollIntoView({ behavior: "smooth" }));
});

const bgm = document.querySelector("#bgm");
const musicToggle = document.querySelector("#musicToggle");
let hasTriedAutoplay = false;

function setMusicState(playing) {
  musicToggle.classList.toggle("playing", playing);
  musicToggle.setAttribute("aria-pressed", String(playing));
  musicToggle.setAttribute("aria-label", playing ? "暂停背景音乐" : "播放背景音乐");
}

async function startMusicOnce() {
  if (hasTriedAutoplay || !bgm.paused) return;
  hasTriedAutoplay = true;
  try { await bgm.play(); setMusicState(true); } catch { setMusicState(false); }
}

musicToggle.addEventListener("click", async () => {
  if (bgm.paused) {
    try { await bgm.play(); setMusicState(true); } catch { setMusicState(false); }
  } else {
    bgm.pause();
    setMusicState(false);
  }
});
document.addEventListener("pointerdown", startMusicOnce, { once: true });

const defaultNotes = [
  "愿你的每一岁，都有音乐、舞台和自由的风。生日快乐，灿烈！",
  "谢谢你把温柔和勇气写进歌里。新的一岁，也要一直做喜欢的事。",
  "从今天到很久很久以后，我们都还会在。Happy Chanyeol Day ♡"
];
const notesRoot = document.querySelector("#notes");
const form = document.querySelector("#replyForm");
const message = document.querySelector("#message");
const charCount = document.querySelector("#charCount");
const toast = document.querySelector("#toast");

function getSavedNotes() {
  try { return JSON.parse(localStorage.getItem("folded-dream-letters") || "[]"); }
  catch { return []; }
}

function renderNotes() {
  const saved = getSavedNotes();
  const all = [...saved, ...defaultNotes].slice(0, 9);
  notesRoot.innerHTML = all.map((note, index) => (
    `<article class="note" style="--tilt:${[-1.1, .8, -.45, .65][index % 4]}deg"><p>${escapeHTML(note)}</p><small>FROM. LOEY ${String(index + 1).padStart(2, "0")}</small></article>`
  )).join("");
}

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

message.addEventListener("input", () => { charCount.textContent = message.value.length; });
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = message.value.trim();
  if (!value) return;
  const saved = getSavedNotes();
  localStorage.setItem("folded-dream-letters", JSON.stringify([value, ...saved].slice(0, 6)));
  form.reset();
  charCount.textContent = "0";
  renderNotes();
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
});
renderNotes();

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: .12 });
document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...document.querySelectorAll("nav a")];
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
  });
}, { rootMargin: "-40% 0px -55%", threshold: 0 });
sections.forEach((section) => sectionObserver.observe(section));
window.addEventListener("scroll", () => document.querySelector(".site-header").classList.toggle("scrolled", scrollY > 30), { passive: true });
