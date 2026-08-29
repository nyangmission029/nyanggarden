# Tính năng upload ảnh từ máy — hướng dẫn

Trang `admin.html` cho phép bạn chọn ảnh từ máy tính/điện thoại, ảnh sẽ được
tải lên **Cloudinary** (dịch vụ lưu trữ ảnh miễn phí), và bạn nhận về 1 link
để dán vào `data.json` (vào các trường `cover`, `hero.image`...).

Vì trang web này là **web tĩnh** (không có server/database riêng), nó không
thể tự "lưu" ảnh bạn chọn — mọi web tĩnh (Netlify, Vercel, GitHub Pages...)
đều cần một dịch vụ lưu trữ ảnh bên ngoài như thế này.

## Thiết lập lần đầu (khoảng 5 phút, chỉ làm 1 lần)

1. Vào https://cloudinary.com → **Sign up for free** (không cần thẻ tín dụng).
2. Sau khi đăng nhập, ở trang Dashboard, copy giá trị **Cloud name**
   (hiện ngay đầu trang).
3. Vào **Settings** (icon bánh răng) → tab **Upload** → mục
   **Upload presets** → **Add upload preset**.
   - Đặt **Signing Mode** = **Unsigned**
   - Đặt tên preset dễ nhớ, ví dụ `nyang_garden_uploads`
   - Bấm **Save**
4. Mở file `admin.js`, sửa 2 dòng đầu:

   ```js
   const CLOUD_NAME = "dán-cloud-name-của-bạn-vào-đây";
   const UPLOAD_PRESET = "dán-tên-preset-của-bạn-vào-đây";
   ```

5. Deploy lại toàn bộ thư mục (kéo-thả lên Netlify Drop như bình thường).
   Từ giờ, mở `[link-web-của-bạn]/admin.html` để upload ảnh bất cứ lúc nào —
   không cần deploy lại mỗi lần thêm ảnh, vì ảnh nằm trên Cloudinary, còn
   `data.json` bạn chỉ cần sửa link rồi deploy lại (hoặc dùng cùng cách
   deploy bạn vẫn hay dùng).

## Cách dùng hằng ngày

1. Mở `admin.html` trên web đã deploy.
2. Kéo-thả ảnh vào ô, hoặc bấm **Chọn ảnh từ máy** (chọn được nhiều ảnh
   cùng lúc).
3. Đợi vài giây, mỗi ảnh sẽ hiện link riêng — bấm **Copy**.
4. Mở `data.json`, dán link đó vào đúng chỗ (`cover`, `hero.image`...).
5. Deploy lại project lên Netlify để trang chính cập nhật.

## Lưu ý

- `admin.html` không có mật khẩo bảo vệ — về bản chất ai biết link
  `/admin.html` cũng upload được ảnh lên Cloudinary của bạn (không sửa
  được `data.json` từ xa, chỉ upload ảnh). Nếu không muốn công khai, đừng
  chia sẻ link này, hoặc gỡ file này ra khỏi thư mục deploy khi không dùng.
- Gói Cloudinary free: 25GB lưu trữ + 25GB băng thông/tháng — thoải mái
  cho ảnh bìa của một trang fanpage.
