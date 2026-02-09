# Tóm Tắt Chỉnh Sửa (tính đến 2026-02-03)

Dưới đây là bản tóm tắt toàn bộ thay đổi tôi đã thực hiện trong workspace (chủ yếu liên quan modal Tạo Đơn Hàng Sản Xuất, tab Chờ duyệt, xuất Excel và xử lý upload maquette).

## Tổng quan
- Mục tiêu chính: Thêm tab "Chờ duyệt tạo đơn" vào modal `Tạo Đơn Hàng Sản Xuất`, cho phép gom các báo giá thành các "đơn chờ duyệt" (grouped orders) — nhiều người dùng có thể thêm báo giá, duyệt, xem chi tiết, xuất Excel, xóa, và lưu thành đơn sản xuất.
- Bổ sung tính năng upload ảnh maquette: chỉ cho 1 ảnh, khi thay thế sẽ xóa URL / file cũ trên bucket.
- Cập nhật chức năng xuất Excel cho các đơn chờ duyệt giống hệt quy cách xuất Excel trong modal Quản lý sản xuất (có cột `Đơn giá` và `Thành tiền`).

## Files chính đã thay đổi
- `index.html` — Thêm UI/HTML cho:
  - Tab trong modal `production-order-modal`: nút `Chọn Báo Giá` và `Chờ Duyệt Tạo Đơn` (badge `#pending-count`).
  - Nội dung tab `production-tab-content-pending` hiển thị danh sách các đơn chờ duyệt (summary rows).
  - Modal mới `pending-order-detail-modal` để xem chi tiết 1 đơn (danh sách báo giá trong đơn) với nút `X` để xóa từng báo giá, và nút `Chọn thêm` để mở modal chọn báo giá.
  - Cột "Khu vực" đã được thêm vào bảng danh sách đơn chờ duyệt (hiển thị các khu vực có trong đơn, ghép các area của quotes).
  - Cập nhật version string hiển thị (bump trong giao diện).

- `_deploy/js/app.js` — Thay đổi/Thêm logic chính:
  - Dữ liệu: chuyển từ `pendingProductionQuotes` sang `pendingOrders` (mỗi order: `{id, createdBy, createdAt, quotes:[], totalPoints, totalAmount}`) để hỗ trợ nhiều người dùng và grouping.
  - Thêm/Chỉnh sửa các hàm liên quan:
    - `switchProductionTab(tabName)` — chuyển giữa tab `select` và `pending`, khi qua tab `pending` gọi `renderPendingOrdersList()`.
    - `addToPendingList()` — khi người dùng chọn báo giá và nhấn "Thêm Vào Chờ Duyệt": tạo 1 `pendingOrder` mới (gán `id`, `createdBy` = tên user), tính `totalPoints`/`totalAmount`, thêm vào `pendingOrders`, và REMOVE các quote đã thêm khỏi `currentQuotes`/filter lists để không còn thấy ở tab chọn.
    - `renderPendingOrdersList()` — render danh sách đơn chờ duyệt (STT, Số điểm, Tổng tiền, Khu vực (unique areas), Người tạo, Ngày giờ, Actions).
    - `openPendingOrderDetailModal(orderId)` & `renderPendingOrderDetail(order)` — mở modal chi tiết đơn, hiển thị list các báo giá như dạng chọn báo giá (có nút X để xóa từng báo giá khỏi đơn).
    - `removePendingOrder(orderId)` và `clearPendingList()` — xóa đơn (hoặc tất cả), đồng thời trả các báo giá về danh sách `currentQuotes` để người khác có thể chọn lại.
    - `savePendingAsProductionOrder()` — gom tất cả quotes từ `pendingOrders` và gọi lại `saveToManagement()` (hệ thống lưu vào quản lý).
    - `saveSinglePendingOrder(orderId)` — lưu một đơn chờ duyệt đơn lẻ (tương tự `savePendingAsProductionOrder` nhưng cho 1 order).
    - `exportPendingOrderToExcel(orderId)` — xuất Excel cho 1 pending order, format giống hệt `exportGenerateOrderExcel` / modal Quản lý sản xuất: header chứa `Đơn giá` và `Thành tiền`, áp dụng merge rows và định dạng số (`#,##0`) cho các cột tiền.
    - `setupProductionModalTabHandlers()` — bind event listeners cho các nút tab, tìm kiếm pending, nút Clear All, Back, Save, export per-order, view detail, delete order.
    - `createProductionList()` — sửa để gọi `addToPendingList()` (không tạo order ngay lập tức), tương thích với luồng 2-tab.
  - Bổ sung xử lý tìm kiếm/filtration cho tab pending (`pending-search`), cập nhật badge đếm tổng điểm (`pending-count`).

- Maquette / upload images:
  - Thêm biến `maquetteUploadQuoteCode` (tên có thể khác trong code) để lưu cố định mã báo giá được dùng khi upload ảnh, tránh tình trạng mã pre-generated bị tăng và gây mismatch folder (ví dụ: upload vào folder 2600770 nhưng báo giá sau cùng lưu mã 2600768).
  - Khi upload maquette: chỉ cho phép upload 1 ảnh duy nhất (thay thế file cũ). Khi thay ảnh mới, code gọi API xóa file cũ trên bucket trước khi upload file mới.
  - Khi submit báo giá: ưu tiên sử dụng mã đã lưu trong `maquetteUploadQuoteCode` để đảm bảo folder ảnh trùng với mã báo giá lưu.

## Hành vi mới (user-facing)
- Khi chọn nhiều báo giá ở tab "Chọn Báo Giá" và nhấn "Thêm Vào Chờ Duyệt":
  - Một đơn chờ duyệt mới được tạo (gồm các báo giá đã chọn), các báo giá này biến mất khỏi tab chọn.
  - Trong tab "Chờ Duyệt Tạo Đơn" sẽ hiển thị dòng tóm tắt cho từng đơn: `STT | Số điểm | Tổng tiền | Khu vực | Người tạo | Ngày giờ | [Xem Chi Tiết] [Xuất Excel] [Lưu Đơn Này] [Xóa]`.
  - `Xem Chi Tiết` mở modal liệt kê chi tiết các báo giá trong đơn (giao diện giống danh sách chọn báo giá), mỗi hàng có nút `X` để xóa báo giá khỏi đơn.
  - `Chọn thêm` trong modal chi tiết mở modal chọn báo giá (giữ nguyên modal hiện tại) để thêm báo giá vào đơn đó.
  - `Xuất Excel` xuất file theo đúng format quy ước sản xuất (có `Đơn giá` và `Thành tiền`).

## Vấn đề gốc về folder maquette mismatch và cách đã fix
- Nguyên nhân: mã báo giá (`quote_code`) được sinh tự động nhiều lần (hàm `getNextQuoteSequence()` tăng counter mỗi lần gọi). Nếu `newQuoteCodePreGenerated` bị tạo lại trước/hoặc sau khi upload ảnh thì folder trên bucket có thể mang mã khác so với mã cuối cùng khi lưu báo giá.
- Giải pháp thực hiện:
  1. Khi upload ảnh maquette lần đầu cho báo giá mới, lưu mã sử dụng để đặt folder vào `maquetteUploadQuoteCode` và KHÔNG để mã này bị ghi đè trong luồng upload.
  2. Khi submit form lưu báo giá, ưu tiên sử dụng `maquetteUploadQuoteCode` nếu tồn tại để đảm bảo folder ảnh trùng với mã đã upload.
  3. Khi thay ảnh (replace), code sẽ xóa file cũ trên bucket trước khi upload file mới.
  4. Clear `maquetteUploadQuoteCode` sau khi lưu thành công hoặc khi reset form.

## Các hàm/biến quan trọng (tham khảo trong `_deploy/js/app.js`)
- `pendingOrders`, `renderPendingOrdersList()`, `renderPendingOrderDetail()`, `addToPendingList()`, `removePendingOrder()`, `clearPendingList()`, `savePendingAsProductionOrder()`, `saveSinglePendingOrder()`, `exportPendingOrderToExcel()`.
- `setupProductionModalTabHandlers()`, `switchProductionTab()`.
- `maquetteUploadQuoteCode` (biến lưu mã báo giá dùng cho upload maquette) và hàm xóa ảnh `qcagDeleteImage()` (đã thêm/chưa có tùy môi trường backend) — cần đảm bảo API xóa file trên bucket tồn tại và được gọi trước upload.

## Lưu ý triển khai / testing
- Kiểm tra flow tạo báo giá mới: mở modal tạo báo giá → đảm bảo `newQuoteCodePreGenerated` chỉ được generate 1 lần cho session tạo (hoặc `maquetteUploadQuoteCode` được set khi upload) → upload maquette → submit → xác nhận folder trên bucket khớp mã báo giá.
- Kiểm tra multi-user: khi nhiều người cùng thao tác, `pendingOrders` hiện đang giữ data trên client; nếu cần đồng bộ đa-client thì phải lưu server-side (tương lai).
- Kiểm tra chức năng xóa file trên bucket: cần có endpoint backend hoặc sử dụng signed URL / admin SDK để xóa file.

## Next steps tôi có thể làm nếu bạn muốn
- (1) Chạy tự động/đoạn test UI để xác nhận hành vi chọn → thêm → xem → lưu.
- (2) Tích hợp gọi API xóa file thật sự (nếu chưa có) để đảm bảo ảnh cũ được remove khỏi bucket.
- (3) Commit thay đổi và upload toàn bộ `_deploy/js/app.js` + `index.html` lên bucket (hiện tôi đã cập nhật file cục bộ; nếu muốn tôi có thể chạy `gsutil cp` với headers no-cache).

---
Nếu bạn muốn, tôi sẽ tiếp tục: (A) commit các thay đổi vào git, (B) chạy upload lên bucket ngay bây giờ, hoặc (C) điều chỉnh UX (ví dụ: gộp nhiều quote thành một đơn có thể gắn tên do user nhập). Bạn chọn bước tiếp theo.
