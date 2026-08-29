# Idol Archive — Website showroom ảnh idol

Website tĩnh (không cần backend), điều hướng 3 tầng:
**Trang chủ → Danh mục (AIRPORT, AWARD...) → Năm → Ngày (bấm vào mở link kho ảnh gốc).**

## Cấu trúc file

```
idol-showroom/
├── index.html      ← không cần sửa
├── style.css       ← sửa ở đây để đổi màu sắc, font, giao diện
├── app.js          ← logic điều hướng, không cần sửa trừ khi muốn đổi cách hiển thị
├── data.json       ← SỬA FILE NÀY MỖI KHI THÊM ẢNH/ALBUM MỚI
└── images/
    └── covers/     ← để ảnh bìa (cover) vào đây
```

## Cách thêm 1 album ảnh mới

Mở `data.json`, đây là file duy nhất bạn cần sửa thường xuyên.

1. Bỏ ảnh bìa đẹp (1 ảnh đại diện) vào `images/covers/`, đặt tên dễ nhớ, ví dụ:
   `airport-2025-01-05-cover.jpg`

2. Trong `data.json`, tìm đúng category → đúng năm → thêm 1 object vào mảng `"dates"`:

```json
{
  "id": "2025-01-05",
  "name": "05.01.2025",
  "label": "Incheon Airport",
  "cover": "images/covers/airport-2025-01-05-cover.jpg",
  "link": "https://drive.google.com/..."
}
```

- `id`: mã nội bộ, không trùng nhau trong cùng 1 năm
- `name`: text hiển thị (thường là ngày)
- `label`: mô tả ngắn (địa điểm, tên sự kiện...) — có thể bỏ trống `""`
- `cover`: đường dẫn tới ảnh bìa
- `link`: link Google Drive / URL ảnh gốc / bất kỳ đâu chứa ảnh chất lượng cao — khi bấm vào card này sẽ mở tab mới tới đây

### Thêm 1 năm mới trong category có sẵn

Thêm object vào mảng `"years"` của category đó:

```json
{
  "id": "2026",
  "name": "2026",
  "cover": "images/covers/airport-2026-cover.jpg",
  "dates": []
}
```

### Thêm 1 category mới (ví dụ: FANMEETING)

Thêm object vào mảng `"categories"` ở ngoài cùng:

```json
{
  "id": "fanmeeting",
  "name": "FANMEETING",
  "cover": "images/covers/fanmeeting-cover.jpg",
  "years": []
}
```

> Lưu ý: `link` trong mục ngày là **link ra ngoài** (Google Drive, ổ lưu trữ ảnh gốc...). Web này **không lưu ảnh chất lượng gốc**, chỉ lưu ảnh bìa nhỏ để hiển thị đẹp — vì vậy web luôn nhẹ và load nhanh dù bạn có hàng nghìn ảnh gốc ở nơi khác.

