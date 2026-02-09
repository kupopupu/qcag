# QCAG Frontend v1.7.5 (PRODUCTION)

Frontend web app cho hệ thống quản lý báo giá QCAG.

## 📍 Vị Trí
```
G:\10. Code\QCAG Version 1.7.5\
```

## 🌐 Production URL
```
https://storage.googleapis.com/qcag-483014-qcag-frontend/index.html
```

## 📦 Cấu Trúc Files

```
QCAG Version 1.7.5/
├── README.md              # File này
├── index.html             # Main HTML (2399 dòng)
├── _deploy/
│   ├── js/
│   │   └── app.js         # Main logic (16864 dòng) ⭐
│   └── css/
│       └── styles.css
├── _sdk/
│   ├── data_sdk.js        # Backend API wrapper
│   └── element_sdk.js     # DOM helpers
├── assets/
│   ├── logo-qcag-2.0.ico
│   ├── hvn-logo.svg
│   ├── qcag-logo.svg
│   └── qcag-1.0.png
├── config/
│   └── areas.json         # Area configuration
├── css/
│   └── additional.css
└── ui/
    └── modals.html        # Modal templates
```

## 🚀 Deploy

### Deploy Toàn Bộ
```powershell
cd 'G:\10. Code\QCAG Version 1.7.2'
gsutil -m rsync -r -d . gs://qcag-483014-qcag-frontend/
```

### Deploy app.js Riêng (Nhanh)
```powershell
cd 'G:\10. Code\QCAG Version 1.7.2'
gsutil -m cp _deploy/js/app.js gs://qcag-483014-qcag-frontend/_deploy/js/
```

### Deploy index.html
```powershell
gsutil cp index.html gs://qcag-483014-qcag-frontend/
```

### Xóa Cache CDN (nếu có)
```powershell
gcloud compute url-maps invalidate-cdn-cache qcag-frontend --path="/*"
```

## 🔧 Configuration

### API Backend URL (index.html line 18)
```javascript
window.API_BASE_URL = 'https://qcag-backend-493469512136.asia-southeast1.run.app';
```

**Override local:**
```javascript
// Browser console
localStorage.setItem('qcag_api_base_url', 'http://localhost:3000');
// Reload page
```

### Limits (index.html line 20-22)
```javascript
window.QCAG_QUOTATION_LIMIT = 5000;      // Max items to fetch
window.QCAG_QUOTATION_PAGE_SIZE = 100;   // Items per page
```

## 📝 Code Structure: app.js (16864 dòng)

### Core Functions

**Data Sync:**
- Line 1-150: Local dataSdk fallback (localStorage)
- Line 150-250: Offline mode toggle
- Line 250-350: API helpers (qcagGetApiBaseUrl, qcagShouldUseBackend)

**Image Upload:**
- Line 239-260: `qcagUploadImageDataUrl()` - Upload base64 to backend
- Line 11102-11125: `qcagFetchWithRetries()` - Retry logic cho 429 errors ⭐

**Status Logic:**
- Line 260-300: `computeQCAGStatus()` - Tính trạng thái QCAG
- Line 300-350: `classifySPOStatus()` - Phân loại SPO status

**Quote Management:**
- Line 2000-2100: Create/update quote helpers
- Line 2100-2200: Delete quote
- Line 2200-2300: Production order creation

**Acceptance (Nghiệm Thu):**
- Line 1001-1060: `addAcceptanceImage()` - Upload vào `acceptance-images/`, lưu `acceptance_images` field ⭐
- Line 1061-1075: `handleAcceptanceImageFile()` - Handle file upload
- Line 1317-1450: `renderAcceptanceDetailModal()` - Đọc từ `acceptance_images` → fallback `images` ⭐
- Line 13497-13900: `renderAcceptanceImages()` - Render với backward compatibility ⭐

**Quote Images Gallery:**
- Line 10776-10850: `collectQuoteImagesForGallery()` - Collect entries
- Line 12066-12150: `openQuoteImagesModal()` - Open gallery modal
- Line 16300-16500: `exportSelectedQuoteImages()` - Export JPG/PDF

**Production Orders:**
- Line 6000-6500: Production order management
- Line 6500-7000: Order filtering (overdue, normal, full)

## 🐛 Recent Fixes (30/01/2026)

### 1. ✅ Revert Acceptance về V1.5 Logic
**Files:**
- `addAcceptanceImage()` (line 1001)
- `renderAcceptanceDetailModal()` (line 1317)
- `renderAcceptanceImages()` (line 13497)

**Changes:**
```javascript
// OLD (1.7.2 initial):
// Lưu vào order.acceptanceImages riêng
order.acceptanceImages = {...}

// NEW (reverted to 1.5):
// Lưu trực tiếp vào quote.images
addImageToQuote(quoteKey, dataUrl, name)
```

**Lý do:** Đơn giản hóa, tương thích với data cũ

### 2. ✅ Fix 429 Rate Limit Errors
**Function:** `qcagFetchWithRetries()` (line 11102)

```javascript
async function qcagFetchWithRetries(url, opts) {
  const MAX_RETRIES = 4;
  const BASE_DELAY = 400; // ms
  // Exponential backoff on 429/503
}
```

**Applied to:**
- `loadImageWithFallback()` (line 11127)
- `dataUrlToBlob()` in export functions (line 16333)
- Acceptance image downloads (line 1606, 1627)

### 3. ✅ Fix Thumbnails Không Hiển Thị
**Location:** `renderAcceptanceImages()` line 13531

**Error:**
```javascript
// Missing declaration
imagesSource: imagesSource  // ❌ undefined
```

**Fix:**
```javascript
const imagesSource = 'quote'; // ✅ Defined
```

## 🔧 Changelog bổ sung (01/02/2026)

- **Bugfix:** Khi xác nhận (confirm) một `production order`, hệ thống chỉ đánh dấu `is_confirmed` trên production order nhưng **không cập nhật** trường `qcag_status` và `qcag_order_number` của các `quote` gốc (ví dụ: mã báo giá `2600461` vẫn giữ `qcag_status: "Chờ tạo đơn"` mặc dù đã nằm trong đơn sản xuất được xác nhận).

- **File đã sửa:** `_deploy/js/app.js`

- **Mô tả hành động:** Khi thực hiện xác nhận đơn (`action === 'confirm'`), thêm bước parse `items` từ production order, tìm các quote tương ứng trong `currentQuotes` (ghép theo `outlet_code + sale_name`) và cập nhật:
  - `qcag_status` → `Đã ra đơn` (trừ các quote có trạng thái `Hủy` hoặc `Ra lại đơn hàng`)
  - `qcag_order_number` → số SPO tương ứng

- **Lý do:** Trước đây chỉ cập nhật `qcag_status` khi trường `spo_number` thay đổi; confirm không trigger cập nhật này dẫn tới trạng thái không đồng bộ và có nguy cơ chọn lại quote đã sản xuất.

- **Hướng dẫn kiểm thử nhanh:**
  1. Refresh trang (Ctrl+F5) để load `_deploy/js/app.js` mới.
 2. Mở modal quản lý `Production Orders` → chọn một order chứa một hoặc nhiều quote.
 3. Click `Xác nhận` cho order đó.
 4. Mở `quotes` list (Danh sách báo giá) và tìm mã quote đã nằm trong order; kiểm tra `qcag_status` phải là `Đã ra đơn` và `qcag_order_number` chứa số SPO.
 5. Kiểm tra DevTools Console sẽ thấy log dạng: `[QCAG] Confirm: Updated qcag_status for X quotes in production order 324`.

Nếu cần, tôi có thể thêm một unit-test mô phỏng dữ liệu `productionOrders`/`currentQuotes` để tự động kiểm tra hành vi này.

## 📊 Key Data Structures

### Quote Object
```javascript
{
  id: 123,
  __backendId: 123,
  quote_code: "AG-CT-240130-001",
  outlet_name: "Outlet ABC",
  outlet_code: "ABC123",
  area: "Miền Tây",
  sale_name: "Nguyễn Văn A",
  spo_number: "SPO123",
  spo_status: "Area Sales Manager Approved...",
  qcag_status: "Đã ra đơn",
  qcag_order_number: "SPO123",
  images: '[{"data": "https://...", "name": "img1.jpg"}]',  // JSON string
  notes: '[{"text": "Note 1", "date": "2026-01-30", "user": "User"}]',
  created_at: "2026-01-30T10:00:00Z",
  updated_at: "2026-01-30T11:00:00Z"
}
```

### Production Order Object
```javascript
{
  id: 456,
  area: "PRODUCTION",
  sale_name: "Đơn hàng sản xuất",
  spo_number: "SPO123",
  items: '[{quote1}, {quote2}, ...]',  // JSON string chứa quotes
  created_at: "2026-01-30T10:00:00Z"
}
```

### Image Object
```javascript
{
  data: "https://qcag-backend.../images/v/abc123",  // URL or dataURL
  name: "design_outlet_abc.jpg"
}
```

## 🎯 Common Tasks

### 1. Sửa Logic Tính Trạng Thái QCAG
**File:** `app.js` line 260-350
```javascript
function computeQCAGStatus(quote) {
  // Modify logic here
}
```

### 2. Thêm Filter Mới cho Production Orders
**File:** `app.js` line 6500-7000
```javascript
// Add new filter type in applySelectionFilters()
```

### 3. Thay Đổi Layout Modal
**File:** `index.html` hoặc `ui/modals.html`
```html
<!-- Modify modal structure -->
```

### 4. Thêm Field Mới vào Quote
**File:** `app.js` line 2000-2100
```javascript
function createQuote() {
  const quote = {
    // Add new field here
  };
}
```

## 🔍 Debugging

### Browser Console Errors
1. **Mở DevTools** (F12)
2. **Console tab** - JavaScript errors?
3. **Network tab** - API calls failing?
4. **Application tab** - localStorage data?

### Check API Connection
```javascript
// Browser console
console.log(window.API_BASE_URL);
fetch(window.API_BASE_URL + '/health').then(r => r.text()).then(console.log);
```

### Check Images Format
```javascript
// Browser console
const quote = currentQuotes[0];
console.log('images:', quote.images);
console.log('parsed:', JSON.parse(quote.images || '[]'));
```

### Force Reload Data
```javascript
// Browser console
localStorage.removeItem('qcag_local_datasdk_items_v1');
location.reload();
```

## 📦 Dependencies (CDN)

### CSS
- Tailwind CSS 3.x
- FontAwesome 6.x (icons)

### JS Libraries
- xlsx (SheetJS) - Excel export
- html2canvas - Image export
- jsPDF - PDF export
- QRious - QR code generation

**Loaded dynamically when needed** (không bundle)

## 🎨 Styling

### Tailwind Classes Quan Trọng
- `.acceptance-thumb-hover` - Thumbnail hover effect
- `.quote-gallery-*` - Gallery text styles
- `.spo-confirmed` - SPO confirmed input state
- `.bg-gradient-to-br` - Gradient backgrounds

### Custom CSS
**File:** `css/additional.css`
- Print styles
- Custom modal animations
- Responsive overrides

## 🔄 Version History

### v1.7.2 (Current - 30/01/2026)
- ✅ **NEW:** Acceptance images upload vào folder riêng `acceptance-images/`
- ✅ **NEW:** Lưu field `acceptance_images` tách biệt với `images` (maquette)
- ✅ **Backward compatible:** Đọc được ảnh cũ từ `quote.images` (legacy)
- ✅ Fixed: Acceptance thumbnails rendering
- ✅ Fixed: 429 rate limit errors with retry mechanism
- ✅ Data cũ: Giữ nguyên 100%, không bị ảnh hưởng

### v1.7.1
- Production order improvements
- Filter enhancements

### v1.7.0
- Major refactor of production orders
- Acceptance modal redesign

### v1.5
- Reference implementation (stable)
- Simple acceptance image handling

## 🚨 Known Issues

### 1. Cache Problems
**Issue:** Frontend không cập nhật sau deploy  
**Fix:**
```powershell
# Hard refresh: Ctrl + Shift + R
# Or clear localStorage
localStorage.clear();
location.reload();
```

### 2. Images Load Slow
**Issue:** Nhiều ảnh load chậm  
**Fix:** Đã thêm retry mechanism (30/01/2026)

### 3. Modal Z-index Conflicts
**Issue:** Modal bị che bởi elements khác  
**Fix:** Check `z-index` in modal styles

## 📚 References

- **Backend API:** See `qcag-backend/README.md`
- **Version 1.5:** Reference implementation in `QCAG Version 1.5/`
- **Main README:** See `G:\10. Code\README.md`

---

**Version:** 1.7.2  
**Deployed:** GCS Static Hosting  
**Last Updated:** 30/01/2026

_Active development branch - deploy with care!_
