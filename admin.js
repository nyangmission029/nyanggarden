/* =========================================================
   NYANG GARDEN — Admin uploader
   Chọn ảnh từ máy -> upload lên Cloudinary (miễn phí) -> nhận link
   để dán vào file dữ liệu tương ứng. Web tĩnh không có server nên
   bắt buộc phải dùng 1 dịch vụ lưu trữ ảnh bên ngoài (Cloudinary).

   BẮT BUỘC ĐIỀN 2 DÒNG DƯỚI ĐÂY trước khi dùng
   (xem hướng dẫn lấy giá trị trong README-admin.md):
   ========================================================= */
const CLOUD_NAME = "jz2djjuo";       // ví dụ: "dabc123xy"
const UPLOAD_PRESET = "nyangmission029";

/* ========================================================= */

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
function cloudinaryUploadUrl(file) {
  const isMedia = file.type.startsWith("video/") || file.type.startsWith("audio/");
  return `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${isMedia ? "video" : "image"}/upload`;
}
const fileInput = document.getElementById("fileInput");
const pickBtn = document.getElementById("pickBtn");
const dropZone = document.getElementById("dropZone");
const results = document.getElementById("results");
const configWarning = document.getElementById("configWarning");

if (CLOUD_NAME === "YOUR_CLOUD_NAME" || UPLOAD_PRESET === "YOUR_UPLOAD_PRESET") {
  configWarning.hidden = false;
}

pickBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  handleFiles(e.target.files);
  fileInput.value = ""; // allow picking the same file again
});

["dragenter", "dragover"].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add("is-dragover");
  })
);

["dragleave", "drop"].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove("is-dragover");
  })
);

dropZone.addEventListener("drop", (e) => {
  const files = e.dataTransfer.files;
  if (files && files.length) handleFiles(files);
});

function handleFiles(fileList) {
  if (CLOUD_NAME === "YOUR_CLOUD_NAME" || UPLOAD_PRESET === "YOUR_UPLOAD_PRESET") {
    configWarning.hidden = false;
    configWarning.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  [...fileList].forEach((file) => {
    const isSupported = file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/");
    if (!isSupported) return;
    uploadFile(file);
  });
}

function uploadFile(file) {
  const item = createResultItem(file);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  fetch(cloudinaryUploadUrl(file), { method: "POST", body: formData })
    .then(async (res) => {
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || `mã lỗi ${res.status}`;
        throw new Error(msg);
      }
      return data;
    })
    .then((data) => markSuccess(item, data.secure_url))
    .catch((err) => markError(item, err.message));
}

function createResultItem(file) {
  const wrap = document.createElement("div");
  wrap.className = "result-item is-pending";

  let thumb;
  if (file.type.startsWith("video/")) {
    thumb = document.createElement("video");
    thumb.className = "result-thumb";
    thumb.src = URL.createObjectURL(file);
    thumb.muted = true;
  } else if (file.type.startsWith("audio/")) {
    thumb = document.createElement("div");
    thumb.className = "result-thumb result-thumb-audio";
    thumb.textContent = "🎵";
  } else {
    thumb = document.createElement("img");
    thumb.className = "result-thumb";
    thumb.src = URL.createObjectURL(file);
    thumb.alt = file.name;
  }

  const body = document.createElement("div");
  body.className = "result-body";

  const filename = document.createElement("p");
  filename.className = "result-filename";
  filename.textContent = file.name;

  const status = document.createElement("p");
  status.className = "result-status";
  status.textContent = "Đang tải lên…";

  body.appendChild(filename);
  body.appendChild(status);
  wrap.appendChild(thumb);
  wrap.appendChild(body);
  results.prepend(wrap);

  return { wrap, status, body };
}

function markSuccess(item, url) {
  item.wrap.classList.remove("is-pending");
  item.status.textContent = "✓ Xong — copy link bên dưới và dán vào file dữ liệu tương ứng";

  const row = document.createElement("div");
  row.className = "result-url-row";

  const input = document.createElement("input");
  input.className = "result-url-input";
  input.type = "text";
  input.readOnly = true;
  input.value = url;

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.type = "button";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(url).then(() => {
      copyBtn.textContent = "Đã copy!";
      copyBtn.classList.add("is-copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("is-copied");
      }, 1500);
    });
  });

  row.appendChild(input);
  row.appendChild(copyBtn);
  item.body.appendChild(row);
}

function markError(item, message) {
  item.wrap.classList.remove("is-pending");
  item.wrap.classList.add("is-error");
  item.status.classList.add("is-error");
  item.status.textContent = `✗ Lỗi: ${message}`;
}

/* ---------- Card creator (new date card form) ----------
   Supports THREE category shapes:
   - 3-level, per-year files: category has "years" (each year has its own "file")
   - 2-level, flat file: category has "file" directly, and that file is a plain array
   - 3-level, one shared file: category has "file" directly, but that file is
     { years: [{ id, name, cover, dates: [...] }] } — years live inside it
   Plus a special "gallery" shape (isGallery: true, e.g. DM MEDIA): entries have
   "images": [{url, note}] instead of a single "link" — filled via the multi-image
   upload section below instead of the link field. ---------- */

const ccCategory = document.getElementById("ccCategory");
const ccYear = document.getElementById("ccYear");
const ccName = document.getElementById("ccName");
const ccLabel = document.getElementById("ccLabel");
const ccLink = document.getElementById("ccLink");
const ccDropZone = document.getElementById("ccDropZone");
const ccDropInner = document.getElementById("ccDropInner");
const ccFileInput = document.getElementById("ccFileInput");
const ccPickBtn = document.getElementById("ccPickBtn");
const ccPreview = document.getElementById("ccPreview");
const ccUploadStatus = document.getElementById("ccUploadStatus");
const ccGenerateBtn = document.getElementById("ccGenerateBtn");
const ccOutput = document.getElementById("ccOutput");
const ccOutputHint = document.getElementById("ccOutputHint");
const ccOutputJson = document.getElementById("ccOutputJson");
const ccCopyBtn = document.getElementById("ccCopyBtn");
const ccGallerySection = document.getElementById("ccGallerySection");
const ccGalleryDropZone = document.getElementById("ccGalleryDropZone");
const ccGalleryFileInput = document.getElementById("ccGalleryFileInput");
const ccGalleryPickBtn = document.getElementById("ccGalleryPickBtn");
const ccGalleryList = document.getElementById("ccGalleryList");

let ccData = null;
let ccCoverUrl = "";
let ccUploading = false;
let ccYearMode = ""; // "years-inline" | "flat-file" | "nested-file"
let ccIsGallery = false;
let ccGalleryImages = []; // [{ url, note, id, pending, error }]

fetch("data.json", { cache: "no-store" })
  .then((res) => res.json())
  .then((data) => {
    ccData = data;
    ccCategory.innerHTML = '<option value="">— Chọn danh mục —</option>';
    data.categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      ccCategory.appendChild(opt);
    });
  })
  .catch(() => {
    ccCategory.innerHTML = '<option value="">Không tải được data.json</option>';
  });

ccCategory.addEventListener("change", async () => {
  const cat = ccData && ccData.categories.find((c) => c.id === ccCategory.value);
  ccYearMode = "";
  ccIsGallery = !!(cat && cat.isGallery);
  ccGallerySection.hidden = !ccIsGallery;
  ccLink.closest(".cc-field").hidden = ccIsGallery;
  if (ccIsGallery) { ccGalleryImages = []; ccGalleryList.replaceChildren(); }

  if (!cat) {
    ccYear.innerHTML = '<option value="">— Chọn danh mục trước —</option>';
    ccYear.disabled = true;
    return;
  }

  if (cat.years) {
    // 3-level, per-year files: let the user pick a year straight from data.json
    ccYearMode = "years-inline";
    ccYear.disabled = false;
    ccYear.innerHTML = '<option value="">— Chọn năm —</option>';
    cat.years.forEach((yr) => {
      const opt = document.createElement("option");
      opt.value = yr.id;
      opt.textContent = yr.name;
      ccYear.appendChild(opt);
    });
    return;
  }

  if (cat.file) {
    // Could be a flat file OR a nested { years: [...] } file — have to fetch it to know.
    ccYear.disabled = true;
    ccYear.innerHTML = '<option value="">— Đang kiểm tra file... —</option>';
    try {
      const res = await fetch(cat.file, { cache: "no-store" });
      if (!res.ok) throw new Error(`mã lỗi ${res.status}`);
      const content = await res.json();

      if (Array.isArray(content)) {
        ccYearMode = "flat-file";
        ccYear.innerHTML = '<option value="__self__">— Mục này không có năm, bấm Tạo card luôn —</option>';
        ccYear.disabled = true;
      } else if (content && Array.isArray(content.years)) {
        ccYearMode = "nested-file";
        ccYear.disabled = false;
        ccYear.innerHTML = '<option value="">— Chọn năm —</option>';
        content.years.forEach((yr) => {
          const opt = document.createElement("option");
          opt.value = yr.id;
          opt.textContent = yr.name;
          ccYear.appendChild(opt);
        });
      } else {
        ccYear.innerHTML = '<option value="">Không nhận diện được cấu trúc file</option>';
      }
    } catch (err) {
      ccYear.innerHTML = '<option value="">Không tải được file dữ liệu</option>';
    }
  }
});

/* ---------- Cover image upload (single image, used by every category shape) ---------- */

ccPickBtn.addEventListener("click", () => ccFileInput.click());

ccFileInput.addEventListener("change", (e) => {
  if (e.target.files && e.target.files[0]) ccHandleFile(e.target.files[0]);
  ccFileInput.value = "";
});

["dragenter", "dragover"].forEach((evt) =>
  ccDropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    ccDropZone.classList.add("is-dragover");
  })
);
["dragleave", "drop"].forEach((evt) =>
  ccDropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    ccDropZone.classList.remove("is-dragover");
  })
);
ccDropZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) ccHandleFile(file);
});

function ccHandleFile(file) {
  if (!file.type.startsWith("image/")) return;
  if (CLOUD_NAME === "YOUR_CLOUD_NAME" || UPLOAD_PRESET === "YOUR_UPLOAD_PRESET") {
    configWarning.hidden = false;
    configWarning.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  ccPreview.src = URL.createObjectURL(file);
  ccPreview.hidden = false;
  ccDropInner.hidden = true;
  ccUploadStatus.classList.remove("is-error");
  ccUploadStatus.textContent = "Đang tải ảnh lên…";
  ccUploading = true;
  ccCoverUrl = "";

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
    .then((data) => {
      ccCoverUrl = data.secure_url;
      ccUploadStatus.textContent = "✓ Ảnh bìa đã sẵn sàng";
      ccUploading = false;
    })
    .catch((err) => {
      ccUploadStatus.classList.add("is-error");
      ccUploadStatus.textContent = `✗ Lỗi tải ảnh: ${err.message}`;
      ccUploading = false;
    });
}

/* ---------- Gallery multi-image upload (DM MEDIA only, isGallery: true) ---------- */

ccGalleryPickBtn.addEventListener("click", () => ccGalleryFileInput.click());

ccGalleryFileInput.addEventListener("change", (e) => {
  [...e.target.files].forEach((file) => ccUploadGalleryImage(file));
  ccGalleryFileInput.value = "";
});

["dragenter", "dragover"].forEach((evt) =>
  ccGalleryDropZone.addEventListener(evt, (e) => { e.preventDefault(); ccGalleryDropZone.classList.add("is-dragover"); })
);
["dragleave", "drop"].forEach((evt) =>
  ccGalleryDropZone.addEventListener(evt, (e) => { e.preventDefault(); ccGalleryDropZone.classList.remove("is-dragover"); })
);
ccGalleryDropZone.addEventListener("drop", (e) => {
  [...(e.dataTransfer.files || [])].forEach((file) => ccUploadGalleryImage(file));
});

function ccUploadGalleryImage(file) {
  const isVideo = file.type.startsWith("video/");
  if (!file.type.startsWith("image/") && !isVideo) return;
  if (CLOUD_NAME === "YOUR_CLOUD_NAME" || UPLOAD_PRESET === "YOUR_UPLOAD_PRESET") {
    configWarning.hidden = false;
    configWarning.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const item = { url: "", note: "", pending: true, isVideo, id: `g${Date.now()}${Math.random().toString(36).slice(2, 6)}` };
  ccGalleryImages.push(item);

  const row = document.createElement("div");
  row.className = "cc-gallery-item is-pending";
  const thumb = document.createElement(isVideo ? "video" : "img");
  thumb.className = "cc-gallery-thumb";
  thumb.src = URL.createObjectURL(file);
  if (isVideo) thumb.muted = true;
  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.className = "cc-gallery-note-input";
  noteInput.placeholder = "Ghi chú cho ảnh này — không bắt buộc";
  noteInput.addEventListener("input", () => { item.note = noteInput.value; });
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "cc-gallery-remove-btn";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => {
    ccGalleryImages = ccGalleryImages.filter((i) => i.id !== item.id);
    row.remove();
  });
  row.appendChild(thumb);
  row.appendChild(noteInput);
  row.appendChild(removeBtn);
  ccGalleryList.appendChild(row);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  fetch(cloudinaryUploadUrl(file), { method: "POST", body: formData })
    .then(async (res) => {
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || `mã lỗi ${res.status}`;
        throw new Error(msg);
      }
      return data;
    })
    .then((data) => {
      item.url = data.secure_url;
      item.pending = false;
      row.classList.remove("is-pending");
    })
    .catch((err) => {
      item.error = true;
      row.classList.remove("is-pending");
      row.classList.add("is-error");
      row.title = err.message;
    });
}

/* ---------- Generate the JSON snippet to paste into the right data file ---------- */

function ccSlugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ccMakeId(name) {
  const m = name.trim().match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const slug = ccSlugify(name);
  return slug || `card-${Date.now()}`;
}

ccGenerateBtn.addEventListener("click", () => {
  const catId = ccCategory.value;
  const cat = ccData && ccData.categories.find((c) => c.id === catId);

  if (!cat) {
    alert("Chọn danh mục trước đã.");
    return;
  }

  // Resolve the target "year-like" object depending on category shape.
  let yr;
  let targetLabel;
  let nestedYear = false;

  if (ccYearMode === "years-inline") {
    const yearId = ccYear.value;
    yr = cat.years.find((y) => y.id === yearId);
    if (!yr) {
      alert("Chọn năm trước đã.");
      return;
    }
    targetLabel = `"${cat.name}" → "${yr.name}"`;
  } else if (ccYearMode === "nested-file") {
    const yearId = ccYear.value;
    if (!yearId) {
      alert("Chọn năm trước đã.");
      return;
    }
    const selectedOption = ccYear.options[ccYear.selectedIndex];
    yr = { id: yearId, name: selectedOption ? selectedOption.textContent : yearId, file: cat.file };
    nestedYear = true;
    targetLabel = `"${cat.name}" → "${yr.name}"`;
  } else if (ccYearMode === "flat-file") {
    yr = { name: cat.name, file: cat.file };
    targetLabel = `"${cat.name}"`;
  } else {
    alert("Chọn danh mục (và năm, nếu có) trước đã.");
    return;
  }

  const name = ccName.value.trim();
  if (!name) {
    alert("Điền tên hiển thị cho card (VD: 21.08.2024).");
    return;
  }
  if (ccUploading) {
    alert("Ảnh bìa đang tải lên, đợi 1-2 giây rồi bấm lại nhé.");
    return;
  }

  let entry;
  if (ccIsGallery) {
    const readyImages = ccGalleryImages.filter((i) => i.url && !i.error);
    if (ccGalleryImages.some((i) => i.pending)) {
      alert("Còn ảnh đang tải lên, đợi 1-2 giây rồi bấm lại nhé.");
      return;
    }
    entry = {
      id: ccMakeId(name),
      label: ccLabel.value.trim(),
      cover: ccCoverUrl || (readyImages[0] ? readyImages[0].url : "images/covers/REPLACE_ME.jpg"),
      images: readyImages.map((i) => ({ url: i.url, note: i.note || "" })),
    };
  } else {
    entry = {
      id: ccMakeId(name),
      label: ccLabel.value.trim(),
      cover: ccCoverUrl || "images/covers/REPLACE_ME.jpg",
      link: ccLink.value.trim() || "https://mega.nz/folder/YOUR_LINK_HERE",
    };
  }

  const ccFileName = yr.file || "(chưa có file cho mục này — tạo file mới trong thư mục data/)";
  const hintLocation = nestedYear
    ? `mảng "dates" của năm "${yr.name}" bên trong file "${ccFileName}"`
    : `MẢNG trong file "${ccFileName}"`;
  ccOutputHint.textContent = `Dán đoạn dưới vào ${hintLocation} (mục ${targetLabel}, không phải data.json):`;
  ccOutputJson.value = JSON.stringify(entry, null, 2) + ",";
  ccOutput.hidden = false;
  ccOutput.scrollIntoView({ behavior: "smooth", block: "center" });

  if (!ccIsGallery && !ccCoverUrl) {
    ccUploadStatus.classList.add("is-error");
    ccUploadStatus.textContent = "⚠️ Chưa có ảnh bìa — nhớ tự điền lại đường dẫn cover trong JSON.";
  }
});

ccCopyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(ccOutputJson.value).then(() => {
    ccCopyBtn.textContent = "Đã copy!";
    ccCopyBtn.classList.add("is-copied");
    setTimeout(() => {
      ccCopyBtn.textContent = "Copy";
      ccCopyBtn.classList.remove("is-copied");
    }, 1500);
  });
});
