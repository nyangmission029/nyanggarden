/* =========================================================
   NYANG GARDEN — Admin uploader
   Chọn ảnh từ máy -> upload lên Cloudinary (miễn phí) -> nhận link
   để dán vào data.json. Web tĩnh không có server nên bắt buộc
   phải dùng 1 dịch vụ lưu trữ ảnh bên ngoài (Cloudinary).

   BẮT BUỘC ĐIỀN 2 DÒNG DƯỚI ĐÂY trước khi dùng
   (xem hướng dẫn lấy giá trị trong README-admin.md):
   ========================================================= */
const CLOUD_NAME = "jz2djjuo";       // ví dụ: "dabc123xy"
const UPLOAD_PRESET = "nyangmission029"; // ví dụ: "nyang_garden_uploads"

/* ========================================================= */

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

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
    if (!file.type.startsWith("image/")) return;
    uploadFile(file);
  });
}

function uploadFile(file) {
  const item = createResultItem(file);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  fetch(UPLOAD_URL, { method: "POST", body: formData })
    .then((res) => {
      if (!res.ok) throw new Error(`Upload thất bại (mã lỗi ${res.status})`);
      return res.json();
    })
    .then((data) => markSuccess(item, data.secure_url))
    .catch((err) => markError(item, err.message));
}

function createResultItem(file) {
  const wrap = document.createElement("div");
  wrap.className = "result-item is-pending";

  const thumb = document.createElement("img");
  thumb.className = "result-thumb";
  thumb.src = URL.createObjectURL(file);
  thumb.alt = file.name;

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
  item.status.textContent = "✓ Xong — copy link bên dưới và dán vào data.json";

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

/* ---------- Card creator (new date card form) ---------- */

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

let ccData = null;
let ccCoverUrl = "";
let ccUploading = false;

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

ccCategory.addEventListener("change", () => {
  const cat = ccData && ccData.categories.find((c) => c.id === ccCategory.value);
  if (!cat) {
    ccYear.innerHTML = '<option value="">— Chọn danh mục trước —</option>';
    ccYear.disabled = true;
    return;
  }
  ccYear.disabled = false;
  ccYear.innerHTML = '<option value="">— Chọn năm —</option>';
  cat.years.forEach((yr) => {
    const opt = document.createElement("option");
    opt.value = yr.id;
    opt.textContent = yr.name;
    ccYear.appendChild(opt);
  });
});

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
    .then((res) => {
      if (!res.ok) throw new Error(`mã lỗi ${res.status}`);
      return res.json();
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
  const yearId = ccYear.value;
  const cat = ccData && ccData.categories.find((c) => c.id === catId);
  const yr = cat && cat.years.find((y) => y.id === yearId);
  const name = ccName.value.trim();

  if (!cat || !yr) {
    alert("Chọn danh mục và năm trước đã.");
    return;
  }
  if (!name) {
    alert("Điền tên hiển thị cho card (VD: 21.08.2024).");
    return;
  }
  if (ccUploading) {
    alert("Ảnh bìa đang tải lên, đợi 1-2 giây rồi bấm lại nhé.");
    return;
  }

  const entry = {
    id: ccMakeId(name),
    name: name,
    label: ccLabel.value.trim(),
    cover: ccCoverUrl || "images/covers/REPLACE_ME.jpg",
    link: ccLink.value.trim() || "https://mega.nz/folder/YOUR_LINK_HERE",
  };

  ccOutputHint.textContent = `Dán đoạn dưới vào mảng "dates" của "${cat.name}" → "${yr.name}" trong data.json:`;
  ccOutputJson.value = JSON.stringify(entry, null, 2) + ",";
  ccOutput.hidden = false;
  ccOutput.scrollIntoView({ behavior: "smooth", block: "center" });

  if (!ccCoverUrl) {
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
