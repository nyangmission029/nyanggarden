/* =========================================================
   IDOL ARCHIVE — router + renderer
   Reads data.json. No build step needed.
   Routes:  #/                      -> categories (home)
            #/{categoryId}          -> years in that category
            #/{categoryId}/{yearId} -> dates in that year (cards link out)
   ========================================================= */

const app = document.getElementById("app");
let DATA = null;

async function loadData() {
  const res = await fetch("data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load data.json");
  DATA = await res.json();
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

function card({ href, cover, eyebrow, title, sub, external = false, target = "_self" }) {
  const a = el("a", { class: "card" + (external ? " is-external" : ""), href, target });
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
  return el("div", { class: "hero" }, [
    hero.image ? (() => {
      const img = el("img", { class: "hero-img", src: hero.image, alt: hero.title || DATA.siteName, loading: "eager" });
      img.addEventListener("error", () => { img.style.display = "none"; }, { once: true });
      return img;
    })() : null,
    el("div", { class: "hero-topbar" }, [
      el("button", { class: "hero-icon-btn", "aria-label": "Menu", html: ICON_MENU }),
      el("button", { class: "hero-icon-btn", "aria-label": "Search", html: ICON_SEARCH }),
    ]),
    el("div", { class: "hero-body" }, [
      el("h1", { class: "hero-title" }, hero.title || DATA.siteName),
      hero.subtitle ? el("p", { class: "hero-subtitle" }, hero.subtitle) : null,
    ]),
  ]);
}

function header() {
  return el("header", { class: "site-header" }, [
    el("div", { class: "wrap" }, [
      el("h1", { class: "site-title" }, [el("a", { href: "#/" }, DATA.siteName)]),
      el("p", { class: "site-subtitle" }, DATA.siteSubtitle || ""),
    ]),
  ]);
}

function footer() {
  return el("footer", { class: "site-footer" }, [
    el("div", { class: "wrap" }, `© ${new Date().getFullYear()} — ${DATA.siteName}`),
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
      })
    );
  });
  app.replaceChildren(
    heroBanner(),
    el("main", { class: "wrap", id: "collections" }, [
      el("div", { class: "section-head" }, [
        el("h2", {}, "Collections"),
        el("span", { class: "section-count" }, `${DATA.categories.length} total`),
      ]),
      DATA.categories.length ? grid : emptyState("No collections yet — add one in data.json"),
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
        eyebrow: `${yr.dates.length} set${yr.dates.length === 1 ? "" : "s"}`,
        title: yr.name,
      })
    );
  });
  app.replaceChildren(
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb([{ label: "Exhibition", href: "#/" }, { label: cat.name }]),
      el("div", { class: "section-head" }, [
        el("h2", {}, cat.name),
        el("span", { class: "section-count" }, `${cat.years.length} total`),
      ]),
      cat.years.length ? grid : emptyState("No years added yet — add one in data.json"),
    ]),
    footer()
  );
}

function renderYear(catId, yearId) {
  const cat = DATA.categories.find((c) => c.id === catId);
  const yr = cat && cat.years.find((y) => y.id === yearId);
  if (!cat || !yr) return renderNotFound();
  document.title = `${cat.name} ${yr.name} — ${DATA.siteName}`;
  const grid = el("div", { class: "grid" });
  yr.dates.forEach((d) => {
    grid.appendChild(
      card({
        href: d.link,
        target: "_blank",
        external: true,
        cover: d.cover,
        eyebrow: d.name,
        title: d.label || d.name,
        sub: d.label ? d.name : null,
      })
    );
  });
  app.replaceChildren(
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb([
        { label: "Exhibition", href: "#/" },
        { label: cat.name, href: `#/${cat.id}` },
        { label: yr.name },
      ]),
      el("div", { class: "section-head" }, [
        el("h2", {}, `${cat.name} — ${yr.name}`),
        el("span", { class: "section-count" }, `${yr.dates.length} total`),
      ]),
      yr.dates.length ? grid : emptyState("No sets added yet — add one in data.json"),
    ]),
    footer()
  );
}

function renderNotFound() {
  app.replaceChildren(
    header(),
    el("main", { class: "wrap" }, [
      breadcrumb([{ label: "Exhibition", href: "#/" }, { label: "Not found" }]),
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
