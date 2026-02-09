// ===== SCRIPT LẤY THÔNG TIN BACKEND CHO PENDING ORDERS =====
// Chạy script này trong console của trình duyệt để lấy thông tin cần thiết

(function() {
  console.log('====== THÔNG TIN BACKEND ======');
  
  // 1. API Base URL
  console.log('1. API_BASE_URL:', window.API_BASE_URL || '(không có)');
  
  // 2. DataSdk methods
  console.log('2. dataSdk methods:', window.dataSdk ? Object.keys(window.dataSdk) : '(không có dataSdk)');
  
  // 3. Test endpoint /pending-orders
  const baseUrl = (window.API_BASE_URL || '').replace(/\/+$/, '');
  if (baseUrl) {
    console.log('3. Đang test endpoint /pending-orders...');
    
    // Test GET
    fetch(baseUrl + '/pending-orders', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json().catch(() => ({ error: 'Parse error', status: res.status })))
    .then(data => {
      console.log('   GET /pending-orders response:', data);
    })
    .catch(err => {
      console.log('   GET /pending-orders error:', err.message);
    });
    
    // Test POST (dry run - empty)
    fetch(baseUrl + '/pending-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    })
    .then(res => res.json().catch(() => ({ error: 'Parse error', status: res.status })))
    .then(data => {
      console.log('   POST /pending-orders response:', data);
    })
    .catch(err => {
      console.log('   POST /pending-orders error:', err.message);
    });
  } else {
    console.log('3. Không có API_BASE_URL để test');
  }
  
  // 4. Kiểm tra dataSdk có method nào liên quan pending không
  if (window.dataSdk) {
    console.log('4. dataSdk.getAllPendingOrders:', typeof window.dataSdk.getAllPendingOrders);
    console.log('   dataSdk.getPendingOrders:', typeof window.dataSdk.getPendingOrders);
    console.log('   dataSdk.listPendingOrders:', typeof window.dataSdk.listPendingOrders);
  }
  
  // 5. Thông tin user hiện tại
  console.log('5. Auth user:', window.__qcagAuthUser || '(không có)');
  
  console.log('====== KẾT THÚC ======');
  console.log('Vui lòng copy toàn bộ output này và gửi cho tôi.');
})();
