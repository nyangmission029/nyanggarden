/* =========================================================
   NYANG GARDEN — router + renderer
   Reads data.json (site structure) + data/*.json (dates per year, loaded on demand).
   Routes:  #/                      -> categories (home)
            #/{categoryId}          -> years in that category
            #/{categoryId}/{yearId} -> dates in that year (cards link out)
   ========================================================= */

const app = document.getElementById("app");
let DATA = null;
const yearDatesCache = {}; // file path -> parsed array, so revisiting a year doesn't re-fetch

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
  // parts: [{label, href}] last one has no href (current)
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

function heroBanner() {
  const hero = DATA.hero || {};
  const searchBtn = el("button", { class: "hero-icon-btn", "aria-label": "Tìm kiếm", html: ICON_SEARCH });
  searchBtn.addEventListener("click", openSearchModal);
  return el("div", { class: "hero" }, [
    hero.image ? (() => {
      const img = el("img", { class: "hero-img", src: hero.image, alt: hero.title || DATA.siteName, loading: "eager" });
      img.addEventListener("error", () => { img.style.display = "none"; }, { once: true });
      return img;
    })() : null,
    el("div", { class: "hero-topbar" }, [
      el("button", { class: "hero-icon-btn", "aria-label": "Menu", html: ICON_MENU }),
      searchBtn,
    ]),
    el("div", { class: "hero-body" }, [
      el("h1", { class: "hero-title" }, hero.title || DATA.siteName),
      hero.subtitle ? el("p", { class: "hero-subtitle" }, hero.subtitle) : null,
    ]),
  ]);
}

/* ---------- Divider (Yarndings 20 symbol row, replaces plain border lines) ---------- */

const DIVIDER_TEXT = "fahbzfhdcefjhmyffahbzfhdcefjhmyffahbzfhdcefjhmyfahbzfbahjfahbzf";
function divider() {
  return el("div", { class: "divider", "aria-hidden": "true" }, DIVIDER_TEXT);
}

/* ---------- Search (home page hero search icon) ----------
   Dates now live in separate data/*.json files (lazy-loaded per year), so
   search has to fetch every year's file once (in parallel) before it can
   filter across everything. Already-visited years are served from
   yearDatesCache instead of being re-fetched. ---------- */

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
  DATA.categories.forEach((cat) => {
    cat.years.forEach((yr) => yearRefs.push({ cat, yr }));
  });

  await Promise.all(
    yearRefs.map(async ({ cat, yr }) => {
      let dates;
      try {
        dates = await loadYearDates(yr);
      } catch (err) {
        return; // skip years whose file failed to load, don't block the rest
      }
      dates.forEach((d) => {
        const haystack = normalizeText(`${cat.name} ${yr.name} ${d.name} ${d.label || ""}`);
        index.push({ cat, yr, d, haystack });
      });
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
          eyebrow: `${item.cat.name} / ${item.yr.name}`,
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
const EDIT_SECRET = "nyangmi"; // đổi chuỗi này nếu muốn dùng "mật khẩu" khác trong link

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

// small helper so we can chain an event listener right after el() without a temp var
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
    const fileName = yr.file || "(chưa có file cho năm này — tạo mới trong thư mục data/)";
    outputHint.textContent = `Dán đoạn dưới vào MẢNG trong file "${fileName}" (không phải data.json):`;
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
  const modalBox = el("div", { class: "modal-box" }, [
    closeBtn,
    el("h3", { class: "modal-title" }, `Thêm ngày mới — ${cat.name} / ${yr.name}`),
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
    el("div", { class: "wrap" }, [
      el("h1", { class: "site-title" }, [el("a", { href: "#/" }, DATA.siteName)]),
      el("p", { class: "site-subtitle" }, DATA.siteSubtitle || ""),
    ]),
    divider(),
  ]);
}

function footer() {
  return el("footer", { class: "site-footer" }, [
    divider(),
    el("div", { class: "wrap" }, `© ${new Date().getFullYear()} — All images belong to their respective owners. No copyright infringement intended.`),
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
        eyebrow: `${cat.years.length} year${cat.years.length === 1 ? "" : "s"}`,
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

function renderCategory(catId) {
  const cat = DATA.categories.find((c) => c.id === catId);
  if (!cat) return renderNotFound();
  document.title = `${cat.name} — ${DATA.siteName}`;
  const grid = el("div", { class: "grid" });
  cat.years.forEach((yr) => {
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
      breadcrumb([{ label: "Home", href: "#/" }, { label: cat.name }]),
      el("div", { class: "section-head" }, [
        el("h2", {}, cat.name),
        el("span", { class: "section-count" }, `${cat.years.length} total`),
      ]),
      cat.years.length ? grid : emptyState("No years added yet — add one in data.json"),
    ]),
    footer()
  );
}

async function renderYear(catId, yearId) {
  const cat = DATA.categories.find((c) => c.id === catId);
  const yr = cat && cat.years.find((y) => y.id === yearId);
  if (!cat || !yr) return renderNotFound();
  document.title = `${cat.name} ${yr.name} — ${DATA.siteName}`;

  // Show a loading state immediately, then swap in the real grid once the
  // per-year dates file has loaded.
  app.replaceChildren(
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb([
        { label: "Home", href: "#/" },
        { label: cat.name, href: `#/${cat.id}` },
        { label: yr.name },
      ]),
      el("div", { class: "section-head" }, [el("h2", {}, `${cat.name} — ${yr.name}`)]),
      emptyState("Đang tải…"),
    ]),
    footer()
  );

  let dates;
  try {
    dates = await loadYearDates(yr);
  } catch (err) {
    app.querySelector(".empty-state").textContent = `Không tải được dữ liệu năm này: ${err.message}`;
    return;
  }

  // If the user has since navigated away while this was loading, don't render stale data.
  if (location.hash.replace(/^#\/?/, "") !== `${catId}/${yearId}`) return;

  const grid = el("div", { class: "grid" });
  dates.forEach((d) => {
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
  if (isEditMode()) grid.appendChild(addCardTile(cat, yr));

  app.replaceChildren(
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb([
        { label: "Home", href: "#/" },
        { label: cat.name, href: `#/${cat.id}` },
        { label: yr.name },
      ]),
      el("div", { class: "section-head" }, [
        el("h2", {}, `${cat.name} — ${yr.name}`),
        el("span", { class: "section-count" }, `${dates.length} total`),
      ]),
      dates.length || isEditMode() ? grid : emptyState("No sets added yet — add one in this year's data file"),
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
  if (parts.length === 1) return renderCategory(decodeURIComponent(parts[0]));
  return renderYear(decodeURIComponent(parts[0]), decodeURIComponent(parts[1]));
}

window.addEventListener("hashchange", route);

loadData()
  .then(route)
  .catch((err) => {
    app.replaceChildren(el("div", { class: "wrap" }, `Lỗi tải dữ liệu: ${err.message}`));
  });
