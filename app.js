/* =========================================================
   NYANG GARDEN — router + renderer
   Reads data.json (site structure) + data/*.json (dates, loaded on demand).

   Two category shapes are supported:
   - 3-level: category has "years" (array) -> #/{cat}/{year} shows dates
   - 2-level: category has "file" directly (no "years") -> #/{cat} shows dates
   ========================================================= */

const app = document.getElementById("app");
let DATA = null;
const yearDatesCache = {}; // file path -> parsed array, so revisiting doesn't re-fetch
const categoryFileCache = {}; // file path -> parsed content (array OR {years:[...]}) for cat.file categories

async function loadData() {
  const res = await fetch("data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load data.json");
  DATA = await res.json();
}

async function loadYearDates(yr) {
  if (!yr.file) return [];
  if (yearDatesCache[yr.file]) return yearDatesCache[yr.file];
  const res = await fetch(yr.file, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load ${yr.file}`);
  const dates = await res.json();
  yearDatesCache[yr.file] = dates;
  return dates;
}

// A category with "file" (no inline "years") can point to either:
// - a flat array of leaf entries (2-level, e.g. OTHERS)
// - an object { years: [{ id, name, cover, dates: [...] }] } (3-level all in one file, e.g. CONCERT/FANCAM)
async function loadCategoryFile(cat) {
  if (!cat.file) return null;
  if (categoryFileCache[cat.file]) return categoryFileCache[cat.file];
  const res = await fetch(cat.file, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load ${cat.file}`);
  const content = await res.json();
  categoryFileCache[cat.file] = content;
  return content;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child) node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function imgWithFallback(src, alt) {
  const img = el("img", { src, alt, loading: "lazy" });
  img.addEventListener("error", () => { img.style.display = "none"; }, { once: true });
  return img;
}

function card({ href, cover, eyebrow, title, sub, external = false, target = "_self", extraClass = "" }) {
  const a = el("a", { class: "card" + (extraClass ? " " + extraClass : "") + (external ? " is-external" : ""), href, target });
  if (external) a.setAttribute("rel", "noopener noreferrer");
  const frame = el("div", { class: "card-frame" }, cover ? imgWithFallback(cover, title) : null);
  const plate = el("div", { class: "card-plate" }, [
    eyebrow ? el("span", { class: "plate-eyebrow" }, eyebrow) : null,
    el("p", { class: "plate-title" }, title),
    sub ? el("p", { class: "plate-sub" }, sub) : null,
  ]);
  a.appendChild(frame);
  a.appendChild(plate);
  return a;
}

// Same look as card(), but a <button> that opens the on-site gallery lightbox
// instead of navigating anywhere (used by the "media" gallery category).
function galleryCard(entry, eyebrowOverride) {
  const btn = el("button", { type: "button", class: "card card-date gallery-card" });
  const frame = el("div", { class: "card-frame" }, entry.cover ? imgWithFallback(entry.cover, entry.label || entry.id) : null);
  const plate = el("div", { class: "card-plate" }, [
    el("span", { class: "plate-eyebrow" }, eyebrowOverride || entry.id),
    el("p", { class: "plate-title" }, entry.label || entry.id),
  ]);
  btn.appendChild(frame);
  btn.appendChild(plate);
  btn.addEventListener("click", () => openGalleryModal(entry));
  return btn;
}

function breadcrumb(parts) {
  const wrap = el("nav", { class: "floor-guide", "aria-label": "Breadcrumb" });
  parts.forEach((p, i) => {
    if (i > 0) wrap.appendChild(el("span", { class: "sep" }, "/"));
    if (p.href) wrap.appendChild(el("a", { href: p.href }, p.label));
    else wrap.appendChild(el("span", { class: "current" }, p.label));
  });
  return wrap;
}

const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const ICON_MENU = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;

function makeSearchButton(btnClass) {
  const btn = el("button", { class: btnClass, "aria-label": "Search", html: ICON_SEARCH });
  btn.addEventListener("click", openSearchModal);
  return btn;
}
function makeMenuButton(btnClass) {
  const btn = el("button", { class: btnClass, "aria-label": "Menu", html: ICON_MENU });
  btn.addEventListener("click", openMenuModal);
  return btn;
}
// Fill in the actual links here — this is the only part you need to edit.

/* ---------- Horizontal site nav (replaces the old hamburger Menu icon) ----------
   Shows on the hero of EVERY page, not just home. "Haven" and "Leave a note!"
   are placeholders for now — point home until you tell me what they should do. ---------- */

const GALLERY_HUB_CATEGORY_IDS = ["event", "offstage", "concert", "others"];

const NAV_ITEMS = [
  { label: "Garden Gate", icon: "https://res.cloudinary.com/jz2djjuo/image/upload/v1789575245/suoc0ubftervxnhqkf40.png", href: "#/", isActive: (top) => top === "" },
  { label: "Gallery", icon: "https://res.cloudinary.com/jz2djjuo/image/upload/v1789575245/p7qjuy7r3qsfcypcv8vg.png", href: "#/gallery", isActive: (top) => top === "gallery" || GALLERY_HUB_CATEGORY_IDS.includes(top) },
  { label: "In Bloom", icon: "https://res.cloudinary.com/jz2djjuo/image/upload/v1789575245/r1z2iorzk81ooqbk3cgc.png", href: "#/fancam", isActive: (top) => top === "fancam" },
  { label: "Nyang Grove", icon: "https://res.cloudinary.com/jz2djjuo/image/upload/v1789575245/jl5yciixbi56pvqsgjsp.png", href: "#/dm-media", isActive: (top) => top === "dm-media" },
  { label: "Haven", icon: "https://res.cloudinary.com/jz2djjuo/image/upload/v1789575245/pgfjfhsysmmckd95q8vu.png", href: "#/", isActive: () => false, comingSoon: true },
  { label: "Leave a note!", icon: "https://res.cloudinary.com/jz2djjuo/image/upload/v1789575245/hqfge8zczjrpt11qi88a.png", href: "#/", isActive: () => false, comingSoon: true },
];

function siteNav() {
  const hash = location.hash.replace(/^#\/?/, "");
  const top = hash.split("/").filter(Boolean)[0] || "";
  const nav = el("nav", { class: "site-nav", "aria-label": "Primary" });
  NAV_ITEMS.forEach((item) => {
    const attrs = { href: item.href, class: "site-nav-link" + (item.isActive(top) ? " is-active" : "") };
    if (item.comingSoon) attrs.title = "Sắp ra mắt";
    nav.appendChild(
      el("a", attrs, [
        el("img", { class: "site-nav-icon", src: item.icon, alt: "" }),
        el("span", {}, item.label),
      ])
    );
  });
  return nav;
}

function heroBanner() {
  const hero = DATA.hero || {};
  const searchBtn = el("button", { class: "hero-icon-btn", "aria-label": "Search", html: ICON_SEARCH });
  searchBtn.addEventListener("click", openSearchModal);
  return el("div", { class: "hero" }, [
    hero.image ? (() => {
      const img = el("img", { class: "hero-img", src: hero.image, alt: hero.title || DATA.siteName, loading: "eager" });
      img.addEventListener("error", () => { img.style.display = "none"; }, { once: true });
      return img;
    })() : null,
    el("div", { class: "hero-topbar" }, [
      siteNav(),
      searchBtn,
    ]),
    el("div", { class: "hero-body" }, [
      el("h1", { class: "hero-title" }, hero.title || DATA.siteName),
      hero.subtitle ? el("p", { class: "hero-subtitle" }, hero.subtitle) : null,
    ]),
  ]);
}

/* ---------- Divider (Yarndings 20 symbol row) ---------- */

const DIVIDER_TEXT = "fahbzfhdcefjhmyffahbzfhdcefjhmyffahbzfhdcefjhmyfahbzfbahjfahbzf";
function divider() {
  return el("div", { class: "divider", "aria-hidden": "true" }, DIVIDER_TEXT);
}

/* ---------- Gallery lightbox (for "media"-type flat categories) ----------
   entry = { id, name, label, cover, images: [{ url, note }] }
   Two views inside the same modal: thumbnail grid, and a fullsize viewer
   with prev/next + an optional note overlay in the corner. ---------- */

function openGalleryModal(entry) {
  const images = entry.images || [];
  const PAGE_SIZE = 30;
  let index = null; // null = grid view, number = fullsize view
  let page = 0;

  const closeBtn = el("button", { type: "button", class: "modal-close", "aria-label": "Close" }, "×");
  const titleEl = el("h3", { class: "modal-title" }, entry.label || entry.id);
  const body = el("div", { class: "gallery-body" });
  const modalBox = el("div", { class: "modal-box gallery-modal-box" }, [closeBtn, titleEl, body]);
  const backdrop = el("div", { class: "modal-backdrop" }, [modalBox]);

  function close() {
    document.body.removeChild(backdrop);
    document.removeEventListener("keydown", onKeyDown);
  }
  function onKeyDown(e) {
    if (e.key === "Escape") { close(); return; }
    if (index !== null) {
      if (e.key === "ArrowLeft") showIndex(index - 1);
      if (e.key === "ArrowRight") showIndex(index + 1);
    }
  }

  function showGrid() {
    index = null;
    titleEl.textContent = entry.label || entry.id;

    const totalPages = Math.max(1, Math.ceil(images.length / PAGE_SIZE));
    page = Math.min(Math.max(page, 0), totalPages - 1);

    const start = page * PAGE_SIZE;
    const pageImages = images.slice(start, start + PAGE_SIZE);

    const thumbGrid = el("div", { class: "gallery-thumb-grid" });
    pageImages.forEach((img, i) => {
      const globalIndex = start + i;
      const thumb = el("img", { src: img.url, alt: "", loading: "lazy", class: "gallery-thumb" });
      thumb.addEventListener("click", () => showIndex(globalIndex));
      thumbGrid.appendChild(thumb);
    });

    const children = [images.length ? thumbGrid : el("p", { class: "search-empty" }, "Chưa có ảnh nào trong bộ này.")];

    if (totalPages > 1) {
      const prevAttrs = { type: "button", class: "gallery-pager-btn", "aria-label": "Trang trước" };
      if (page === 0) prevAttrs.disabled = "";
      const nextAttrs = { type: "button", class: "gallery-pager-btn", "aria-label": "Trang sau" };
      if (page === totalPages - 1) nextAttrs.disabled = "";

      const prevPageBtn = el("button", prevAttrs, "«");
      const pageLabel = el("span", { class: "gallery-pager-label" }, `${page + 1} / ${totalPages}`);
      const nextPageBtn = el("button", nextAttrs, "»");

      prevPageBtn.addEventListener("click", () => { page -= 1; showGrid(); });
      nextPageBtn.addEventListener("click", () => { page += 1; showGrid(); });

      children.push(el("div", { class: "gallery-pager" }, [prevPageBtn, pageLabel, nextPageBtn]));
    }

    body.replaceChildren(...children);
  }

  function showIndex(i) {
    if (!images.length) return;
    index = (i + images.length) % images.length;
    const img = images[index];
    titleEl.textContent = `${entry.label || entry.id} — ${index + 1}/${images.length}`;

    const viewer = el("div", { class: "gallery-viewer" }, [
      el("img", { src: img.url, alt: "", class: "gallery-fullimg" }),
    ]);

    if (images.length > 1) {
      const prevBtn = el("button", { type: "button", class: "gallery-nav-btn gallery-nav-prev", "aria-label": "Ảnh trước" }, "‹");
      const nextBtn = el("button", { type: "button", class: "gallery-nav-btn gallery-nav-next", "aria-label": "Ảnh sau" }, "›");
      prevBtn.addEventListener("click", () => showIndex(index - 1));
      nextBtn.addEventListener("click", () => showIndex(index + 1));
      viewer.appendChild(prevBtn);
      viewer.appendChild(nextBtn);
    }

    if (img.note && img.note.trim()) {
      viewer.appendChild(el("div", { class: "gallery-note" }, img.note));
    }

    const backLink = el("button", { type: "button", class: "gallery-back-link" }, "‹ Xem tất cả ảnh");
    backLink.addEventListener("click", () => {
      page = Math.floor(index / PAGE_SIZE);
      showGrid();
    });

    body.replaceChildren(viewer, el("div", { class: "gallery-back-row" }, [backLink]));
  }

  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKeyDown);

  showGrid();
  document.body.appendChild(backdrop);
}

/* ---------- Menu (opens from plain-header pages — mirrors the same NAV_ITEMS
   used in the horizontal nav on hero pages, since that nav isn't visible here) ---------- */

function openMenuModal() {
  const closeBtn = el("button", { type: "button", class: "modal-close", "aria-label": "Close" }, "×");
  const list = el("nav", { class: "menu-list" });

  function close() {
    document.body.removeChild(backdrop);
    document.removeEventListener("keydown", onKeyDown);
  }
  function onKeyDown(e) {
    if (e.key === "Escape") close();
  }

  NAV_ITEMS.forEach((item) => {
    const link = el("a", { href: item.href, class: "menu-list-item" }, [
      el("img", { class: "menu-list-icon", src: item.icon, alt: "" }),
      el("span", {}, item.label),
    ]);
    link.addEventListener("click", close);
    list.appendChild(link);
  });

  const modalBox = el("div", { class: "modal-box menu-modal-box" }, [
    closeBtn,
    el("h3", { class: "modal-title" }, "Menu"),
    list,
  ]);
  const backdrop = el("div", { class: "modal-backdrop" }, [modalBox]);

  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKeyDown);

  document.body.appendChild(backdrop);
}

/* ---------- Search (works from any page) ----------
   Works across BOTH category shapes: 3-level (category -> years -> dates)
   and 2-level (category -> dates directly via category.file). ---------- */

function normalizeText(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

async function buildSearchIndex() {
  const index = [];
  const yearRefs = [];
  const fileCats = [];

  DATA.categories.forEach((cat) => {
    if (cat.years) {
      cat.years.forEach((yr) => yearRefs.push({ cat, yr, yrLabel: yr.name }));
    } else if (cat.file) {
      fileCats.push(cat);
    }
  });

  function pushEntry(catName, yrLabel, d) {
    const haystack = normalizeText(`${catName} ${yrLabel || ""} ${d.id} ${d.label || ""}`);
    index.push({ catName, yrLabel, d, haystack });
  }

  function pushGalleryEntry(catName, entry) {
    const haystack = normalizeText(`${catName} ${entry.id} ${entry.label || ""}`);
    index.push({ catName, isGallery: true, entry, haystack });
  }

  await Promise.all(
    yearRefs.map(async ({ cat, yr, yrLabel }) => {
      let dates;
      try {
        dates = await loadYearDates(yr);
      } catch (err) {
        return; // skip years whose file failed to load
      }
      dates.forEach((d) => pushEntry(cat.name, yrLabel, d));
    })
  );

  await Promise.all(
    fileCats.map(async (cat) => {
      let content;
      try {
        content = await loadCategoryFile(cat);
      } catch (err) {
        return; // skip categories whose file failed to load
      }
      if (Array.isArray(content)) {
        if (cat.isGallery) {
          // Flat gallery category (e.g. DM MEDIA): index by entry, opens lightbox
          content.forEach((entry) => pushGalleryEntry(cat.name, entry));
        } else {
          // Flat 2-level category (e.g. OTHERS)
          content.forEach((d) => pushEntry(cat.name, null, d));
        }
      } else if (content && Array.isArray(content.years)) {
        // Nested 3-level-in-one-file category (e.g. CONCERT, FANCAM)
        content.years.forEach((yr) => {
          (yr.dates || []).forEach((d) => pushEntry(cat.name, yr.name, d));
        });
      }
    })
  );

  return index;
}

function openSearchModal() {
  let searchIndex = null;
  let indexError = null;

  const input = el("input", { type: "text", class: "search-input", placeholder: "Search by date, location, year,... exp: 240212, ICN, MAMA" });
  const resultsWrap = el("div", { class: "search-results" });

  function showMessage(text) {
    resultsWrap.replaceChildren(el("p", { class: "search-empty" }, text));
  }

  function runSearch() {
    if (indexError) { showMessage(`Couldn't load search data: ${indexError.message}`); return; }
    if (!searchIndex) { showMessage("Loading search data…"); return; }

    const q = normalizeText(input.value.trim());
    if (!q) { showMessage("Type to search by date, location, year, or category..."); return; }

    const matches = searchIndex.filter((item) => item.haystack.includes(q));
    if (!matches.length) { showMessage("No matching results found."); return; }

    const grid = el("div", { class: "grid search-result-grid" });
    matches.slice(0, 30).forEach((item) => {
      if (item.isGallery) {
        grid.appendChild(galleryCard(item.entry, item.catName));
        return;
      }
      grid.appendChild(
        card({
          href: item.d.link,
          target: "_blank",
          external: true,
          cover: item.d.cover,
          eyebrow: item.yrLabel ? `${item.catName} / ${item.yrLabel}` : item.catName,
          title: item.d.label || item.d.id,
          extraClass: "card-date",
        })
      );
    });
    resultsWrap.replaceChildren(grid);
  }

  showMessage("Loading search data…");

  const closeBtn = el("button", { type: "button", class: "modal-close", "aria-label": "Close" }, "×");
  const modalBox = el("div", { class: "modal-box search-modal-box" }, [
    closeBtn,
    el("h3", { class: "modal-title" }, "Search"),
    input,
    resultsWrap,
  ]);
  const backdrop = el("div", { class: "modal-backdrop" }, [modalBox]);

  function close() {
    document.body.removeChild(backdrop);
    document.removeEventListener("keydown", onKeyDown);
  }
  function onKeyDown(e) {
    if (e.key === "Escape") close();
  }

  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKeyDown);
  input.addEventListener("input", runSearch);

  document.body.appendChild(backdrop);
  input.focus();

  buildSearchIndex()
    .then((idx) => { searchIndex = idx; runSearch(); })
    .catch((err) => { indexError = err; runSearch(); });
}

/* ---------- Edit mode + inline "add date card" ---------- */

const CLOUD_NAME = "jz2djjuo";
const UPLOAD_PRESET = "nyangmission029";
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const EDIT_SECRET = "nyangmi";

function isEditMode() {
  return new URLSearchParams(location.search).get("edit") === EDIT_SECRET;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function makeCardId(name) {
  const m = name.trim().match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const slug = slugify(name);
  return slug || `card-${Date.now()}`;
}

function addCardTile(cat, yr) {
  return el("button", { class: "card add-card", type: "button" }, [
    el("span", { class: "add-card-plus" }, "+"),
    el("span", { class: "add-card-label" }, "New Date"),
  ]).also((btn) => btn.addEventListener("click", () => openAddCardModal(cat, yr)));
}

Element.prototype.also = function (fn) { fn(this); return this; };

function openAddCardModal(cat, yr) {
  let coverUrl = "";
  let uploading = false;

  const nameInput = el("input", { type: "text", placeholder: "21.08.2024" });
  const labelInput = el("input", { type: "text", placeholder: "Incheon Airport" });
  const linkInput = el("input", { type: "text", placeholder: "https://mega.nz/folder/..." });
  const fileInput = el("input", { type: "file", accept: "image/*", hidden: "" });
  const preview = el("img", { class: "modal-preview", hidden: "" });
  const dropInner = el("div", { class: "modal-drop-inner" }, [
    el("p", { class: "upload-hint" }, "Kéo thả ảnh vào đây, hoặc"),
    el("button", { type: "button", class: "pick-btn" }, "Chọn ảnh từ máy"),
  ]);
  const dropZone = el("div", { class: "upload-box modal-dropzone" }, [fileInput, dropInner, preview]);
  const statusEl = el("p", { class: "cc-upload-status" }, "");
  const outputBox = el("div", { class: "cc-output", hidden: "" });
  const outputHint = el("p", { class: "cc-output-hint" }, "");
  const outputJson = el("textarea", { class: "cc-output-json", readonly: "", rows: "7" });
  const copyBtn = el("button", { type: "button", class: "copy-btn" }, "Copy");
  outputBox.appendChild(outputHint);
  outputBox.appendChild(el("div", { class: "result-url-row" }, [outputJson, copyBtn]));

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    dropInner.hidden = true;
    statusEl.classList.remove("is-error");
    statusEl.textContent = "Đang tải ảnh lên…";
    uploading = true;
    coverUrl = "";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    fetch(UPLOAD_URL, { method: "POST", body: formData })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = (data && data.error && data.error.message) || `mã lỗi ${res.status}`;
          throw new Error(msg);
        }
        return data;
      })
      .then((data) => { coverUrl = data.secure_url; statusEl.textContent = "✓ Ảnh bìa đã sẵn sàng"; uploading = false; })
      .catch((err) => { statusEl.classList.add("is-error"); statusEl.textContent = `✗ Lỗi tải ảnh: ${err.message}`; uploading = false; });
  }

  dropInner.querySelector("button").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  ["dragenter", "dragover"].forEach((evt) => dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add("is-dragover"); }));
  ["dragleave", "drop"].forEach((evt) => dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove("is-dragover"); }));
  dropZone.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });

  const generateBtn = el("button", { type: "button", class: "pick-btn cc-generate-btn" }, "Tạo card");
  generateBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) { alert("Điền mã ngày cho card (VD: 21.08.2024 hoặc 240821)."); return; }
    if (uploading) { alert("Ảnh bìa đang tải lên, đợi 1-2 giây rồi bấm lại nhé."); return; }
    const entry = {
      id: makeCardId(name),
      label: labelInput.value.trim(),
      cover: coverUrl || "images/covers/REPLACE_ME.jpg",
      link: linkInput.value.trim() || "https://mega.nz/folder/YOUR_LINK_HERE",
    };
    const fileName = yr.file || "(chưa có file cho mục này — tạo mới trong thư mục data/)";
    const hintLocation = yr.nestedYear
      ? `mảng "dates" của năm "${yr.name}" bên trong file "${fileName}"`
      : `MẢNG trong file "${fileName}"`;
    outputHint.textContent = `Dán đoạn dưới vào ${hintLocation} (không phải data.json):`;
    outputJson.value = JSON.stringify(entry, null, 2) + ",";
    outputBox.hidden = false;
    if (!coverUrl) {
      statusEl.classList.add("is-error");
      statusEl.textContent = "⚠️ Chưa có ảnh bìa — nhớ tự điền lại đường dẫn cover trong JSON.";
    }
  });

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(outputJson.value).then(() => {
      copyBtn.textContent = "Đã copy!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    });
  });

  const closeBtn = el("button", { type: "button", class: "modal-close", "aria-label": "Đóng" }, "×");
  const titleText = cat.name === yr.name ? `Thêm mới — ${cat.name}` : `Thêm ngày mới — ${cat.name} / ${yr.name}`;
  const modalBox = el("div", { class: "modal-box" }, [
    closeBtn,
    el("h3", { class: "modal-title" }, titleText),
    el("label", { class: "cc-field" }, [el("span", {}, "Mã ngày — dùng làm id (VD: 21.08.2024 hoặc 240821)"), nameInput]),
    el("label", { class: "cc-field" }, [el("span", {}, "Label — tên hiển thị trên card"), labelInput]),
    el("label", { class: "cc-field" }, [el("span", {}, "Link kho ảnh gốc — không bắt buộc"), linkInput]),
    el("div", { class: "cc-field" }, [el("span", {}, "Ảnh bìa"), dropZone, statusEl]),
    generateBtn,
    outputBox,
  ]);

  const backdrop = el("div", { class: "modal-backdrop" }, [modalBox]);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) document.body.removeChild(backdrop); });
  closeBtn.addEventListener("click", () => document.body.removeChild(backdrop));
  document.body.appendChild(backdrop);
}

function header() {
  return el("header", { class: "site-header" }, [
    el("div", { class: "wrap site-header-row" }, [
      el("div", { class: "site-header-text" }, [
        el("h1", { class: "site-title" }, [el("a", { href: "#/" }, DATA.siteName)]),
        el("p", { class: "site-subtitle" }, DATA.siteSubtitle || ""),
      ]),
      el("div", { class: "site-header-icons" }, [
        makeMenuButton("header-icon-btn"),
        makeSearchButton("header-icon-btn"),
      ]),
    ]),
    divider(),
  ]);
}

// Only these top-level routes show the full hero (photo + title + horizontal nav).
// Everything else (year/date pages, and Gallery-hub categories' own top page) uses
// the plain header() instead.
const HERO_TOP_LEVEL_CATEGORY_IDS = ["fancam", "dm-media"];

// Returns the array of nodes to prepend for a page: [heroBanner, divider] or [header].
// Spread this into app.replaceChildren(...pageShell(useHero), mainEl, footer()).
function pageShell(useHero) {
  return useHero ? [heroBanner(), divider()] : [header()];
}

function footer() {
  return el("footer", { class: "site-footer" }, [
    divider(),
    el("div", { class: "wrap site-footer-row" }, [
      el("p", { class: "footer-copyright" }, `© ${new Date().getFullYear()} — All images belong to their respective owners. No copyright infringement intended.`),
    ]),
  ]);
}

function emptyState(text) {
  return el("div", { class: "empty-state" }, text);
}

function renderHome() {
  document.title = DATA.siteName;
  const grid = el("div", { class: "grid" });
  DATA.categories.forEach((cat) => {
    grid.appendChild(
      card({
        href: `#/${cat.id}`,
        cover: cat.cover,
        eyebrow: cat.years ? `${cat.years.length} year${cat.years.length === 1 ? "" : "s"}` : undefined,
        title: cat.name,
        extraClass: "card-category",
      })
    );
  });
  app.replaceChildren(
    heroBanner(),
    divider(),
    el("main", { class: "wrap", id: "collections" }, [
      el("div", { class: "section-head" }, [
        el("h2", {}, "Collections"),
        el("span", { class: "section-count" }, `${DATA.categories.length} total`),
      ]),
      DATA.categories.length ? grid : emptyState("No values yet — add one in data.json"),
    ]),
    footer()
  );
}

// Renders the "3-level" category page: a grid of year cards.
function renderCategoryYears(cat) {
  document.title = `${cat.name} — ${DATA.siteName}`;
  const sortedYears = [...cat.years].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
  );
  const grid = el("div", { class: "grid" });
  sortedYears.forEach((yr) => {
    grid.appendChild(
      card({
        href: `#/${cat.id}/${yr.id}`,
        cover: yr.cover,
        title: yr.name,
        extraClass: "card-year",
      })
    );
  });
  app.replaceChildren(
    ...pageShell(HERO_TOP_LEVEL_CATEGORY_IDS.includes(cat.id)),
    el("main", { class: "wrap" }, [
      breadcrumb([{ label: "Home", href: "#/" }, { label: cat.name }]),
      el("div", { class: "section-head" }, [
        el("h2", {}, cat.name),
        el("span", { class: "section-count" }, `${sortedYears.length} total`),
      ]),
      sortedYears.length ? grid : emptyState("No years added yet — add one in data.json"),
    ]),
    footer()
  );
}

// Renders a "dates" grid directly from an already-available array (no fetching).
// Shared by: fetch-then-render flows below, and any future synchronous case.
function renderDatesGrid({ dates, breadcrumbParts, heading, editContext }) {
  document.title = `${heading} — ${DATA.siteName}`;
  const sortedDates = [...dates].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
  );
  const grid = el("div", { class: "grid" });
  sortedDates.forEach((d) => {
    grid.appendChild(
      card({
        href: d.link,
        target: "_blank",
        external: true,
        cover: d.cover,
        eyebrow: d.id,
        title: d.label || d.id,
        extraClass: "card-date",
      })
    );
  });
  if (isEditMode()) grid.appendChild(addCardTile(editContext.cat, editContext.yr));

  app.replaceChildren(
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb(breadcrumbParts),
      el("div", { class: "section-head" }, [
        el("h2", {}, heading),
        el("span", { class: "section-count" }, `${sortedDates.length} total`),
      ]),
      sortedDates.length || isEditMode() ? grid : emptyState("No sets added yet — add one in this data file"),
    ]),
    footer()
  );
}

// Fetches a year's own file (source.file), then hands off to renderDatesGrid.
// Used for: a 3-level category's specific year, and a flat 2-level category (its own file IS the dates array).
async function renderDatesPage({ source, breadcrumbParts, heading, routeKey, editContext }) {
  document.title = `${heading} — ${DATA.siteName}`;

  app.replaceChildren(
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb(breadcrumbParts),
      el("div", { class: "section-head" }, [el("h2", {}, heading)]),
      emptyState("Đang tải…"),
    ]),
    footer()
  );

  let dates;
  try {
    dates = await loadYearDates(source);
  } catch (err) {
    app.querySelector(".empty-state").textContent = `Không tải được dữ liệu: ${err.message}`;
    return;
  }

  if (location.hash.replace(/^#\/?/, "") !== routeKey) return;

  renderDatesGrid({ dates, breadcrumbParts, heading, editContext });
}

// Renders the year-cards grid for a 3-level-in-one-file category
// (content already fetched via loadCategoryFile — no further requests needed).
function renderYearGridFromFile(cat, years) {
  document.title = `${cat.name} — ${DATA.siteName}`;
  const sortedYears = [...years].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
  );
  const grid = el("div", { class: "grid" });
  sortedYears.forEach((yr) => {
    grid.appendChild(
      card({
        href: `#/${cat.id}/${yr.id}`,
        cover: yr.cover,
        title: yr.name,
        extraClass: "card-year",
      })
    );
  });
  app.replaceChildren(
    ...pageShell(HERO_TOP_LEVEL_CATEGORY_IDS.includes(cat.id)),
    el("main", { class: "wrap" }, [
      breadcrumb([{ label: "Home", href: "#/" }, { label: cat.name }]),
      el("div", { class: "section-head" }, [
        el("h2", {}, cat.name),
        el("span", { class: "section-count" }, `${sortedYears.length} total`),
      ]),
      sortedYears.length ? grid : emptyState("No years added yet — add one in this data file"),
    ]),
    footer()
  );
}

// Renders a flat "gallery" category (e.g. DM MEDIA): each entry opens an
// on-site lightbox (openGalleryModal) instead of linking to an external archive.
function renderGalleryGrid(cat, entries) {
  document.title = `${cat.name} — ${DATA.siteName}`;
  const sortedEntries = [...entries].sort((a, b) =>
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
  );
  const grid = el("div", { class: "grid" });
  sortedEntries.forEach((entry) => {
    grid.appendChild(galleryCard(entry));
  });
  app.replaceChildren(
    ...pageShell(HERO_TOP_LEVEL_CATEGORY_IDS.includes(cat.id)),
    el("main", { class: "wrap" }, [
      breadcrumb([{ label: "Home", href: "#/" }, { label: cat.name }]),
      el("div", { class: "section-head" }, [
        el("h2", {}, cat.name),
        el("span", { class: "section-count" }, `${sortedEntries.length} total`),
      ]),
      sortedEntries.length ? grid : emptyState("No sets added yet — add one via admin.html"),
    ]),
    footer()
  );
}

async function renderCategory(catId) {
  const cat = DATA.categories.find((c) => c.id === catId);
  if (!cat) return renderNotFound();

  if (cat.years) {
    return renderCategoryYears(cat);
  }

  if (!cat.file) return renderNotFound();

  const useHero = HERO_TOP_LEVEL_CATEGORY_IDS.includes(cat.id);
  document.title = `${cat.name} — ${DATA.siteName}`;
  app.replaceChildren(
    ...pageShell(useHero),
    el("main", { class: "wrap" }, [
      breadcrumb([{ label: "Home", href: "#/" }, { label: cat.name }]),
      el("div", { class: "section-head" }, [el("h2", {}, cat.name)]),
      emptyState("Đang tải…"),
    ]),
    footer()
  );

  let content;
  try {
    content = await loadCategoryFile(cat);
  } catch (err) {
    app.querySelector(".empty-state").textContent = `Không tải được dữ liệu: ${err.message}`;
    return;
  }

  if (location.hash.replace(/^#\/?/, "") !== cat.id) return;

  if (Array.isArray(content)) {
    if (cat.isGallery) {
      // Flat gallery category (e.g. DM MEDIA): each entry has "images" and opens
      // a lightbox on-site instead of linking out.
      renderGalleryGrid(cat, content);
      return;
    }
    // Flat 2-level category (e.g. OTHERS): the file itself IS the array of leaf entries.
    renderDatesGrid({
      dates: content,
      breadcrumbParts: [{ label: "Home", href: "#/" }, { label: cat.name }],
      heading: cat.name,
      editContext: { cat, yr: { name: cat.name, file: cat.file } },
    });
    return;
  }

  if (content && Array.isArray(content.years)) {
    // Nested 3-level-in-one-file category (e.g. CONCERT, FANCAM).
    renderYearGridFromFile(cat, content.years);
    return;
  }

  renderNotFound();
}

async function renderYear(catId, yearId) {
  const cat = DATA.categories.find((c) => c.id === catId);
  if (!cat) return renderNotFound();

  // 3-level category with per-year files (e.g. OFFSTAGE, EVENT)
  if (cat.years) {
    const yr = cat.years.find((y) => y.id === yearId);
    if (!yr) return renderNotFound();
    return renderDatesPage({
      source: yr,
      breadcrumbParts: [
        { label: "Home", href: "#/" },
        { label: cat.name, href: `#/${cat.id}` },
        { label: yr.name },
      ],
      heading: `${cat.name} — ${yr.name}`,
      routeKey: `${catId}/${yearId}`,
      editContext: { cat, yr },
    });
  }

  // 3-level-in-one-file category (e.g. CONCERT, FANCAM): the year lives inside
  // the already-cached (or freshly fetched) category file — no extra request needed.
  if (cat.file) {
    document.title = `${cat.name} — ${DATA.siteName}`;
    app.replaceChildren(
      header(),
      el("main", { class: "wrap" }, [
        breadcrumb([
          { label: "Home", href: "#/" },
          { label: cat.name, href: `#/${cat.id}` },
          { label: yearId },
        ]),
        el("div", { class: "section-head" }, [el("h2", {}, cat.name)]),
        emptyState("Đang tải…"),
      ]),
      footer()
    );

    let content;
    try {
      content = await loadCategoryFile(cat);
    } catch (err) {
      app.querySelector(".empty-state").textContent = `Không tải được dữ liệu: ${err.message}`;
      return;
    }

    if (location.hash.replace(/^#\/?/, "") !== `${catId}/${yearId}`) return;

    const yr = content && Array.isArray(content.years) && content.years.find((y) => y.id === yearId);
    if (!yr) return renderNotFound();

    renderDatesGrid({
      dates: yr.dates || [],
      breadcrumbParts: [
        { label: "Home", href: "#/" },
        { label: cat.name, href: `#/${cat.id}` },
        { label: yr.name },
      ],
      heading: `${cat.name} — ${yr.name}`,
      editContext: { cat, yr: { id: yr.id, name: yr.name, file: cat.file, nestedYear: true } },
    });
    return;
  }

  return renderNotFound();
}

// "Gallery" nav item: a curated view showing only a subset of categories
// (not every category — FANCAM and DM MEDIA have their own direct nav links).
function renderGalleryHub() {
  document.title = `Gallery — ${DATA.siteName}`;
  const cats = GALLERY_HUB_CATEGORY_IDS
    .map((id) => DATA.categories.find((c) => c.id === id))
    .filter(Boolean);
  const grid = el("div", { class: "grid" });
  cats.forEach((cat) => {
    grid.appendChild(
      card({
        href: `#/${cat.id}`,
        cover: cat.cover,
        eyebrow: cat.years ? `${cat.years.length} year${cat.years.length === 1 ? "" : "s"}` : undefined,
        title: cat.name,
        extraClass: "card-category",
      })
    );
  });
  app.replaceChildren(
    heroBanner(),
    divider(),
    el("main", { class: "wrap" }, [
      el("div", { class: "section-head" }, [
        el("h2", {}, "Gallery"),
        el("span", { class: "section-count" }, `${cats.length} total`),
      ]),
      cats.length ? grid : emptyState("No collections yet"),
    ]),
    footer()
  );
}

function renderNotFound() {
  app.replaceChildren(
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb([{ label: "Home", href: "#/" }, { label: "Not found" }]),
      emptyState("That page doesn't exist."),
    ]),
    footer()
  );
}

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  if (parts.length === 0) return renderHome();
  if (parts.length === 1 && decodeURIComponent(parts[0]) === "gallery") return renderGalleryHub();
  if (parts.length === 1) return renderCategory(decodeURIComponent(parts[0]));
  return renderYear(decodeURIComponent(parts[0]), decodeURIComponent(parts[1]));
}

window.addEventListener("hashchange", route);

loadData()
  .then(route)
  .catch((err) => {
    app.replaceChildren(el("div", { class: "wrap" }, `Lỗi tải dữ liệu: ${err.message}`));
  });
