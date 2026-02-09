# Tóm tắt thay đổi — Maquette upload & giữ hình sau reload

**Ngày:** 2026-02-03

## Mục tiêu
- Sửa tình trạng khi người dùng upload ảnh maquette rồi bấm `Submit` nhanh (ảnh đôi khi chưa kịp upload lên bucket dẫn tới mất hình sau reload).
- Đảm bảo ảnh maquette được upload, URL được lưu vào bản ghi báo giá và hiển thị sau khi reload.

## Files đã chỉnh
- [_deploy/js/app.js](_deploy/js/app.js)

## Các thay đổi chi tiết
- Thêm cơ chế persist maquette URL sau khi tạo báo giá:
  - Sau khi `window.dataSdk.create` trả về kết quả tạo báo giá thành công, gọi `saveQuoteImages(finalQuoteCode, window.currentQuoteImages, { render: false })` để ghi `images` (URL) vào record vừa tạo. (Tránh lưu dataURL nếu upload chưa hoàn tất.)

- Thêm trạng thái theo dõi upload để ngăn submit trước khi upload hoàn tất:
  - Khởi tạo cờ `window.maquetteUploadInProgress = false` cùng các state khác.
  - Khi bắt đầu upload trong `processQuoteImageFiles()` đặt `window.maquetteUploadInProgress = true`; khi upload hoàn tất hoặc thất bại đặt lại `false`.
  - Trong handler submit (`document.getElementById('quote-form').addEventListener('submit', ...)`) nếu thấy `window.maquetteUploadInProgress === true` sẽ đợi (poll) đến khi upload hoàn tất (poll 200ms, tối đa ~30s) trước khi thực hiện lưu báo giá. Giao diện sẽ hiển thị loading tương ứng.

- Cập nhật `processQuoteImageFiles()` (maquette):
  - Giới hạn chỉ 1 ảnh (maquette chỉ cho 1 ảnh) và luôn replace.
  - Khi upload, dùng `quoteKey = currentEditingQuoteKey || newQuoteCodePreGenerated || 'temp_<timestamp>'` và lưu cờ `maquetteUploadQuoteCode` cho phiên tạo mới.
  - Trước khi upload ảnh mới, xóa `oldImageUrl` (nếu là URL hợp lệ) bằng `qcagDeleteImage(oldImageUrl)` (nếu backend hỗ trợ).
  - Gọi `qcagUploadImageDataUrl(dataUrl, entry.name, { folder: 'maquette', quoteKey })` để upload và thay `entry.data` bằng URL trả về khi upload xong.

- Sửa logic submit để ưu tiên folder/quoteCode đúng:
  - Khi tạo mới: ưu tiên `existingQuote?.quote_code || maquetteUploadQuoteCode || newQuoteCodePreGenerated || generateQuoteCode()`.
  - Sau tạo thành công, clear `newQuoteCodePreGenerated` và `maquetteUploadQuoteCode`.

## Lý do và hiệu quả
- Nguyên nhân: nếu user bấm `Submit` trước khi upload hoàn tất, database sẽ nhận `images` đang là dataURL (hoặc không đúng URL), dẫn tới khi reload không hiển thị hình từ bucket.
- Hiệu quả: frontend giờ sẽ đợi upload xong trước khi lưu, và sẽ ghi URL thật vào record sau khi backend tạo quote → ảnh hiển thị ổn định sau reload.

## Hướng dẫn test
1. Mở modal tạo báo giá.
2. Upload ảnh maquette (1 ảnh) cho 3 báo giá khác nhau (mỗi báo giá upload 1 ảnh riêng).
3. Ở mỗi modal bấm `Submit` ngay (không chờ). Ứng dụng sẽ tự đợi upload xong rồi mới submit.
4. Sau khi nhận thông báo tạo thành công, reload trang chính. Cả 3 báo giá phải giữ được ảnh maquette.

## Ghi chú & next steps
- Cần confirm backend endpoint `/images/upload` và `/images/delete` hoạt động và user có quyền xóa file (nếu muốn xóa ảnh cũ).
- Hiện `pendingOrders` và các trạng thái liên quan vẫn là client-side; nếu cần multi-user persistence thì cần mở API server-side để lưu `pendingOrders`.

--
Người sửa: GitHub Copilot (thực hiện chỉnh sửa trong `_deploy/js/app.js` và upload file lên bucket).