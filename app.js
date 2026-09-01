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

function breadcrumb(parts) {
  const wrap = el("nav", { class: "floor-guide", "aria-label": "Breadcrumb" });
  parts.forEach((p, i) => {
    if (i > 0) wrap.appendChild(el("span", { class: "sep" }, "/"));
    if (p.href) wrap.appendChild(el("a", { href: p.href }, p.label));
    else wrap.appendChild(el("span", { class: "current" }, p.label));
  });
  return wrap;
}

const ICON_MENU = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const ICON_MAIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 6.5l8 6.5 8-6.5"/></svg>`;
const ICON_X = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.53 3H20.8l-7.14 8.16L22 21h-6.53l-5.12-6.7L4.5 21H1.23l7.64-8.73L2 3h6.7l4.63 6.13L17.53 3zm-1.14 16.17h1.8L7.7 4.73H5.76l10.63 14.44z"/></svg>`;
const ICON_FACEBOOK = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8.1h2.72l.41-3.15H13.5V7.75c0-.91.25-1.53 1.56-1.53h1.67V3.42C16.44 3.29 15.44 3.2 14.29 3.2c-2.4 0-4.04 1.46-4.04 4.15v2.4H7.5v3.15h2.75V21h3.25z"/></svg>`;

// Fill in the actual links here — this is the only part you need to edit.
const CONTACT_LINKS = {
  email: "mailto:youremail@gmail.com",
  x: "https://x.com/your_handle",
  facebook: "https://facebook.com/your_page",
};

// Reusable icon buttons — used both on the hero (home page) and the plain
// header (every other page), so Menu + Search work everywhere.
function makeMenuButton(btnClass) {
  const btn = el("button", { class: btnClass, "aria-label": "Menu", html: ICON_MENU });
  btn.addEventListener("click", openMenuModal);
  return btn;
}
function makeSearchButton(btnClass) {
  const btn = el("button", { class: btnClass, "aria-label": "Search", html: ICON_SEARCH });
  btn.addEventListener("click", openSearchModal);
  return btn;
}

function heroBanner() {
  const hero = DATA.hero || {};
  return el("div", { class: "hero" }, [
    hero.image ? (() => {
      const img = el("img", { class: "hero-img", src: hero.image, alt: hero.title || DATA.siteName, loading: "eager" });
      img.addEventListener("error", () => { img.style.display = "none"; }, { once: true });
      return img;
    })() : null,
    el("div", { class: "hero-topbar" }, [
      makeMenuButton("hero-icon-btn"),
      makeSearchButton("hero-icon-btn"),
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

/* ---------- Menu (list of categories, opens from any page) ---------- */

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

  const homeLink = el("a", { href: "#/", class: "menu-list-item" }, "Home");
  homeLink.addEventListener("click", close);
  list.appendChild(homeLink);

  DATA.categories.forEach((cat) => {
    const link = el("a", { href: `#/${cat.id}`, class: "menu-list-item" }, cat.name);
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
    const haystack = normalizeText(`${catName} ${yrLabel || ""} ${d.name} ${d.label || ""}`);
    index.push({ catName, yrLabel, d, haystack });
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
        // Flat 2-level category (e.g. OTHERS)
        content.forEach((d) => pushEntry(cat.name, null, d));
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
      grid.appendChild(
        card({
          href: item.d.link,
          target: "_blank",
          external: true,
          cover: item.d.cover,
          eyebrow: item.yrLabel ? `${item.catName} / ${item.yrLabel}` : item.catName,
          title: item.d.label || item.d.name,
          sub: item.d.label ? item.d.name : null,
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
      .then((res) => { if (!res.ok) throw new Error(`mã lỗi ${res.status}`); return res.json(); })
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
    if (!name) { alert("Điền tên hiển thị cho card (VD: 21.08.2024)."); return; }
    if (uploading) { alert("Ảnh bìa đang tải lên, đợi 1-2 giây rồi bấm lại nhé."); return; }
    const entry = {
      id: makeCardId(name),
      name,
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
    el("label", { class: "cc-field" }, [el("span", {}, "Tên hiển thị (VD: 21.08.2024)"), nameInput]),
    el("label", { class: "cc-field" }, [el("span", {}, "Mô tả ngắn — không bắt buộc"), labelInput]),
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

function footer() {
  const contactRow = el("div", { class: "footer-contact" }, [
    el("a", { href: CONTACT_LINKS.email, class: "footer-icon-btn", "aria-label": "Email", target: "_blank", html: ICON_MAIL }),
    el("a", { href: CONTACT_LINKS.x, class: "footer-icon-btn", "aria-label": "X", target: "_blank", rel: "noopener noreferrer", html: ICON_X }),
    el("a", { href: CONTACT_LINKS.facebook, class: "footer-icon-btn", "aria-label": "Facebook", target: "_blank", rel: "noopener noreferrer", html: ICON_FACEBOOK }),
  ]);
  return el("footer", { class: "site-footer" }, [
    divider(),
    el("div", { class: "wrap site-footer-row" }, [
      el("p", { class: "footer-copyright" }, `© ${new Date().getFullYear()} — All images belong to their respective owners. No copyright infringement intended.`),
      contactRow,
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
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb([{ label: "HOME", href: "#/" }, { label: cat.name }]),
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
        eyebrow: d.name,
        title: d.label || d.name,
        sub: d.label ? d.name : null,
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
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb([{ label: "HOME", href: "#/" }, { label: cat.name }]),
      el("div", { class: "section-head" }, [
        el("h2", {}, cat.name),
        el("span", { class: "section-count" }, `${sortedYears.length} total`),
      ]),
      sortedYears.length ? grid : emptyState("No years added yet — add one in this data file"),
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

  document.title = `${cat.name} — ${DATA.siteName}`;
  app.replaceChildren(
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb([{ label: "HOME", href: "#/" }, { label: cat.name }]),
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
    // Flat 2-level category (e.g. OTHERS): the file itself IS the array of leaf entries.
    renderDatesGrid({
      dates: content,
      breadcrumbParts: [{ label: "HOME", href: "#/" }, { label: cat.name }],
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
        { label: "HOME", href: "#/" },
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
          { label: "HOME", href: "#/" },
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

function renderNotFound() {
  app.replaceChildren(
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb([{ label: "HOME", href: "#/" }, { label: "Not found" }]),
      emptyState("That page doesn't exist."),
    ]),
    footer()
  );
}

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  if (parts.length === 0) return renderHome();
  if (parts.length === 1) return renderCategory(decodeURIComponent(parts[0]));
  return renderYear(decodeURIComponent(parts[0]), decodeURIComponent(parts[1]));
}

window.addEventListener("hashchange", route);

loadData()
  .then(route)
  .catch((err) => {
    app.replaceChildren(el("div", { class: "wrap" }, `Lỗi tải dữ liệu: ${err.message}`));
  });
