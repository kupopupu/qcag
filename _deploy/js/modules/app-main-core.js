
        function createProductionList() {
            // Changed: Now adds to pending list instead of creating immediately
            addToPendingList();
        }

        function renderProductionList(groupedBySale) {
            const container = document.getElementById('production-list-content');
            let html = '';
            let globalIndex = 0; // Số thứ tự liên tục cho toàn bộ danh sách

            Object.keys(groupedBySale).forEach(saleKey => {
                        const quotes = groupedBySale[saleKey];
                        const totalAmount = quotes.reduce((sum, q) => sum + q.total_amount, 0);

                        html += `
          <div class="mb-8">
            <!-- Cấp 1: Individual Sale Header -->
            <h2 class="text-2xl font-bold text-gray-800 mb-6">${saleKey} (${quotes.length} báo giá - ${formatCurrency(totalAmount)})</h2>
            <div class="space-y-4">
              ${quotes.map((quote) => {
                globalIndex++; // Tăng số thứ tự liên tục
                const items = JSON.parse(quote.items || '[]');
                return `
                  <!-- Cấp 2: Quote Summary (1 hàng duy nhất) -->
                  <div class="border border-gray-300 rounded-lg overflow-hidden">
                    <div class="bg-gray-100 px-3 py-2 flex items-center justify-between text-sm">
                      <div class="flex items-center gap-3 min-w-0">
                        <span class="font-bold text-blue-600">${globalIndex}</span>
                        <span class="font-semibold text-gray-800 truncate max-w-[220px]">${quote.outlet_name}</span>
                        <span class="text-gray-600 whitespace-nowrap">| ${quote.outlet_code}</span>
                        ${quote.spo_number ? `<span class="text-gray-700 whitespace-nowrap">| ${quote.spo_number}</span>` : ''}
                        ${quote.address && quote.address !== 'Địa chỉ sẽ hiển thị tự động khi nhập' ? `<span class="text-gray-500 truncate max-w-[260px]">| ${quote.address}</span>` : ''}
                      </div>
                      <span class="font-bold text-blue-600 whitespace-nowrap">${formatCurrency(quote.total_amount)}</span>
                    </div>
                    
                    <!-- Cấp 3: Items Detail -->
                    <div class="p-3">
                      <table class="w-full text-sm">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Code</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Nội dung</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Brand</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Kích thước</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">SL</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">ĐVT</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Đơn giá</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                          ${items.map(item => `
                            <tr class="hover:bg-gray-50">
                              <td class="px-3 py-2 font-medium text-gray-900">${item.code}</td>
                              <td class="px-3 py-2 text-gray-700">${item.content}</td>
                              <td class="px-3 py-2 text-gray-600">${item.brand || '-'}</td>
                              <td class="px-3 py-2 text-gray-600">
                                ${item.width && item.height ? `${item.width}m × ${item.height}m` : '-'}
                              </td>
                              <td class="px-3 py-2 text-gray-900">${item.quantity}</td>
                              <td class="px-3 py-2 text-gray-600">${item.unit}</td>
                              <td class="px-3 py-2 text-gray-900">${formatCurrency(parseMoney(item.price) || 0)}</td>
                              <td class="px-3 py-2 font-semibold text-blue-600">${item.total}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      });
      
      container.innerHTML = html;
    }

    // Bind controls for the production list modal once
    function setupProductionListHandlersOnce() {
      const saveBtn = document.getElementById('save-to-management');
      if (saveBtn && !saveBtn._bound) {
        saveBtn._bound = true;
        saveBtn.addEventListener('click', () => {
          // save the currentProductionData as a production order
          saveToManagement();
        });
      }

      const exportExcelBtn = document.getElementById('export-production-list-excel');
      if (exportExcelBtn && !exportExcelBtn._bound) {
        exportExcelBtn._bound = true;
        exportExcelBtn.addEventListener('click', async() => {
          try {
            if (!currentProductionData || !currentProductionData.length) {
              showToast('Không có dữ liệu để xuất');
              return;
            }
            // Sort currentProductionData so earliest quote/code appears first
            let sortedCurrentProduction = Array.isArray(currentProductionData) ? currentProductionData.slice() : [];
            try {
              const quoteKeySort = function(q) {
                try {
                  if (typeof extractSequenceFromQuoteCode === 'function') {
                    const s = extractSequenceFromQuoteCode(q && (q.quote_code || q.quoteCode));
                    if (Number.isFinite(s)) return s;
                  }
                } catch (e) {}
                try { if (q && q.created_at) return new Date(q.created_at).getTime(); } catch (e) {}
                return 0;
              };
              sortedCurrentProduction.sort((a,b) => (quoteKeySort(a) || 0) - (quoteKeySort(b) || 0));
            } catch (e) { /* ignore */ }
            const tmpOrder = {
              spo_number: 'Chua_co',
              address: '',
              due_date: '',
              items: JSON.stringify(sortedCurrentProduction)
            };
            await exportGenerateOrderExcel(tmpOrder);
          } catch (e) {
            console.error('export-production-list-excel error', e);
            showToast('Không thể xuất Excel');
          }
        });
      }

      const xinPhepBtn = document.getElementById('open-xinphep-from-production');
      if (xinPhepBtn && !xinPhepBtn._bound) {
        xinPhepBtn._bound = true;
        xinPhepBtn.addEventListener('click', function(){
          try { if (typeof window.xinphepRefreshFromProduction === 'function') window.xinphepRefreshFromProduction(); } catch(e){}
          try { if (typeof window.openXinphepModal === 'function') window.openXinphepModal(); else document.getElementById('xinphep-btn').click(); } catch (e) {}
        });
      }

      const closeBtn = document.getElementById('close-production-list-modal');
      if (closeBtn && !closeBtn._bound) {
        closeBtn._bound = true;
        closeBtn.addEventListener('click', () => closeProductionListModal());
      }
      const backBtn = document.getElementById('back-to-selection');
      if (backBtn && !backBtn._bound) {
        backBtn._bound = true;
          backBtn.addEventListener('click', () => {
          closeProductionListModal();
          // reopen selection without preserving search/filters so UI resets
          openProductionOrderModal({ preserveSelection: false });
        });
      }
    }

    function closeProductionListModal() {
      const modal = document.getElementById('production-list-modal');
      if (!modal) return;
      modal.classList.add('hidden');
      ensureScrollLock();
    }

    // Open saved production order details in a modal
    window.openSavedProductionOrderModal = function(backendId) {
      const order = productionOrders.find(o => o.__backendId === backendId);
      if (!order) return;

      // Title
      const titleEl = document.getElementById('saved-order-title');
      const orderNo = order.spo_number && order.spo_number !== 'Chưa nhập số đơn hàng' ? order.spo_number : '(Chưa có số đơn hàng)';
      titleEl.textContent = `Đơn Hàng: ${orderNo} — Đơn vị: ${order.address || 'Chưa nhập đơn vị thi công'} — Hạn: ${order.due_date || 'Chưa nhập hạn thi công'}`;

      // Content
      const container = document.getElementById('saved-order-content');
      let html = '';
      let quotes = [];
      try {
        quotes = JSON.parse(order.items || '[]');
      } catch (e) {
        quotes = [];
      }

      if (!Array.isArray(quotes) || quotes.length === 0) {
        html = '<p class="text-gray-500">Không có dữ liệu chi tiết</p>';
      } else {
        let idx = 0;
        html += '<div class="space-y-4">';
        quotes.forEach((quote) => {
          idx++;
          let items = [];
          try { items = JSON.parse(quote.items || '[]'); } catch (e) { items = []; }
          html += `
            <div class="border border-gray-200 rounded-lg overflow-hidden">
              <div class="bg-gray-100 px-3 py-2 flex items-center justify-between text-sm">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="font-bold text-blue-600">${idx}</span>
                  <span class="font-semibold text-gray-800 truncate max-w-[240px]">${quote.outlet_name || '-'}</span>
                  <span class="text-gray-600 whitespace-nowrap">| ${quote.outlet_code || '-'}</span>
                  ${quote.spo_number ? `<span class="text-gray-700 whitespace-nowrap">| ${quote.spo_number}</span>` : ''}
                  ${quote.address && quote.address !== 'Địa chỉ sẽ hiển thị tự động khi nhập' ? `<span class="text-gray-500 truncate max-w-[300px]">| ${quote.address}</span>` : ''}
                </div>
                <span class="font-bold text-blue-600 whitespace-nowrap">${formatCurrency(parseMoney(quote.total_amount) || 0)}</span>
              </div>
              <div class="p-3">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Code</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Nội dung</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Brand</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Kích thước</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">SL</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">ĐVT</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Đơn giá</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    ${items.map(item => `
                      <tr>
                        <td class="px-3 py-2 font-medium text-gray-900">${item.code || '-'}</td>
                        <td class="px-3 py-2 text-gray-700">${item.content || '-'}</td>
                        <td class="px-3 py-2 text-gray-600">${item.brand || '-'}</td>
                        <td class="px-3 py-2 text-gray-600">${item.width && item.height ? `${item.width}m × ${item.height}m` : '-'}</td>
                        <td class="px-3 py-2 text-gray-900">${item.quantity || '-'}</td>
                        <td class="px-3 py-2 text-gray-600">${item.unit || '-'}</td>
                        <td class="px-3 py-2 text-gray-900">${formatCurrency(parseMoney(item.price) || 0)}</td>
                        <td class="px-3 py-2 font-semibold text-blue-600">${item.quantity ? formatCurrencyExact((parseMoney(item.price) || 0) * (parseNumber(item.quantity) || 0)) : '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        });
        html += '</div>';
      }

      container.innerHTML = html;
      document.getElementById('saved-production-order-modal').classList.remove('hidden');
      const closeBtn = document.getElementById('close-saved-order-modal');
      closeBtn.onclick = function() {
        document.getElementById('saved-production-order-modal').classList.add('hidden');
        ensureScrollLock();
      };
      ensureScrollLock();
    };
    function exportProductionExcel() {
      if (!currentProductionData || currentProductionData.length === 0) {
        showToast('Không có dữ liệu để xuất');
        return;
      }
      
      const selectedQuotesList = currentProductionData;
      
      // Prepare data for Excel export
      const excelData = [];
      
      // Group by sale type
      const groupedBySale = {};
      selectedQuotesList.forEach(quote => {
        const saleKey = quote.sale_type === 'TBA' ? 'TBA' : 'Sale (SR)';
        if (!groupedBySale[saleKey]) {
          groupedBySale[saleKey] = [];
        }
        groupedBySale[saleKey].push(quote);
      });
      
      let globalIndex = 0; // Số thứ tự liên tục cho Excel
      
      Object.keys(groupedBySale).forEach(saleKey => {
        const quotes = groupedBySale[saleKey];
        
        // Add individual sale header
        excelData.push([`=== ${saleKey} ===`, '', '', '', '', '', '', '']);
        excelData.push(['STT', 'Outlet Code', 'Tên Outlet', 'SPO', 'Sale', 'Tổng Tiền', 'Khu Vực', 'Trạng Thái']);
        
        quotes.forEach((quote) => {
          globalIndex++; // Tăng số thứ tự liên tục
          // Add quote summary
          excelData.push([
            globalIndex,
            quote.outlet_code,
            quote.outlet_name,
            quote.spo_number || '',
            quote.sale_name || '',
            parseMoney(quote.total_amount) || 0,
            quote.area,
            quote.spo_status
          ]);
          
          // Add items detail header
          excelData.push(['', 'Code', 'Nội dung', 'Brand', 'Kích thước', 'SL', 'ĐVT', 'Đơn giá', 'Thành tiền']);
          
          // Add items
          const items = JSON.parse(quote.items || '[]');
          items.forEach(item => {
            excelData.push([
              '',
              item.code,
              item.content,
              item.brand || '',
              item.width && item.height ? `${item.width}m × ${item.height}m` : '',
              item.quantity,
              item.unit,
              parseMoney(item.price) || 0,
              parseMoney(item.total) || 0
            ]);
          });
          
          excelData.push(['', '', '', '', '', '', '', '', '']); // Empty row
        });
        
        excelData.push(['', '', '', '', '', '', '', '', '']); // Empty row between sale types
      });
      
      // Create and download Excel file
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      // Apply number format for money columns: Tổng Tiền (5), Đơn giá (7), Thành tiền (8)
      try {
        const lastRow = excelData.length - 1;
              for (let r = 1; r <= lastRow; r++) {
          [5, 7, 8].forEach(c => {
            const cellRef = XLSX.utils.encode_cell({ c, r });
            if (ws[cellRef] && ws[cellRef].t === 'n') ws[cellRef].z = '#,##0';
          });
        }
      } catch (e) { /* ignore */ }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Danh Sách Sản Xuất');
      
      const fileName = `DanhSachSanXuat_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      showToast('Đã xuất file Excel thành công!');
    }

    // Manage Production Orders Functions
    function openManageProductionOrdersModal() {
      document.getElementById('manage-production-orders-modal').classList.remove('hidden');
      renderProductionOrdersList(productionOrders);
      setupManageProductionHandlers();
      ensureScrollLock();
    }

    function setupManageProductionHandlers() {
      // Close modal handler
      document.getElementById('close-manage-production-modal').addEventListener('click', closeManageProductionModal);
      
      // Search handler
      const _ms = document.getElementById('manage-search');
      if (_ms) {
        _ms.addEventListener('input', debounce(filterManageProductionOrders, 250));
      }
      
  // Removed: sample production orders button handler
      // Export toolbar handlers
      const exportBtn = document.getElementById('manage-export-btn');
      const cbOrder = document.getElementById('ex-type-order');
      const cbProduction = document.getElementById('ex-type-production');
      const cbContractor = document.getElementById('ex-type-contractor');

      function updateExportEnable() {
        if (!exportBtn) return;
        exportBtn.disabled = selectedManageOrders.size === 0 || (!cbOrder.checked && !cbProduction.checked && !cbContractor.checked);
      }

      [cbOrder, cbProduction, cbContractor].forEach(cb => cb && cb.addEventListener('change', updateExportEnable));

      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          if (exportBtn.disabled) return;
          const ids = Array.from(selectedManageOrders);
          const variants = [];
            if (cbOrder.checked) variants.push('order');
            if (cbProduction.checked) variants.push('production');
            if (cbContractor.checked) variants.push('contractor');
          exportMultipleVariants(ids, variants);
        });
      }
      updateExportEnable();
    }

    // Export multiple variants
    function exportMultipleVariants(selectedIds, variants) {
      variants.forEach(v => exportManageOrdersExcel(v, selectedIds));
    }

    // Export selected orders (single variant)
    function exportManageOrdersExcel(variant, selectedIds) {
      try {
        const chosen = productionOrders.filter(o => selectedIds.includes(String(o.__backendId)));
        if (chosen.length === 0) {
          showToast('Không có đơn hàng đã chọn');
          return;
        }

        let aoa = [];
        const _manage_group_records = []; // { start, value }

        if (variant === 'order') {
          // Chi tiết: mỗi đơn hàng, rồi từng quote, rồi items có giá
          let globalIndex = 0;
          chosen.forEach(order => {
            aoa.push([`=== Đơn hàng: ${order.spo_number || '(chưa có)'} — Hạn: ${order.due_date || '(chưa)'} — Đơn vị: ${order.address || '(chưa)'} ===`]);
            let quotes = [];
            try { quotes = JSON.parse(order.items || '[]'); } catch (e) { quotes = []; }
            quotes.forEach(q => {
              globalIndex++;
              aoa.push(['']);
              aoa.push(['#', 'Outlet Code', 'Tên Outlet', 'SPO', 'Địa chỉ']);
              const startIdx = aoa.length;
              // push empty first cell for merged columns; record to set only start cell later
              aoa.push([
                '',
                q.outlet_code || '',
                q.outlet_name || '',
                q.spo_number || '',
                (q.address && !q.address.startsWith('Địa chỉ sẽ')) ? q.address : ''
              ]);
              _manage_group_records.push({ start: startIdx, value: globalIndex });
              let items = [];
              try { items = JSON.parse(q.items || '[]'); } catch (e) { items = []; }
              aoa.push(['', 'Code', 'Nội dung', 'Kích thước', 'SL', 'ĐVT', 'Đơn giá', 'Thành tiền']);
              items.forEach(it => {
                const size = (it.width && it.height) ? `${it.width}m × ${it.height}m` : '';
                const priceNum = parseMoney(it.price) || 0;
                const qtyNum = parseNumber(it.quantity) || 0;
                const parsedT = parseMoney(it.total) || 0;
                const computedT = priceNum * qtyNum;
                const finalTotal = (parsedT > 0 && Math.abs(parsedT - computedT) / (computedT || 1) <= 0.1) ? parsedT : computedT;
                aoa.push(['', it.code || '', it.content || '', size, it.quantity || '', it.unit || '', priceNum, finalTotal || 0]);
              });
            });
            aoa.push(['']);
          });
  } else if (variant === 'production' || variant === 'contractor') {
          // Build header counts
          const counts = countSpecialItems(chosen);
          aoa.push(['Tổng hợp số lượng']);
          aoa.push(['Trụ 90 (8.1)', counts.tru90]);
          aoa.push(['Trụ 114 (S8.3)', counts.tru114]);
          aoa.push(['Sắt chỏi (S8.4)', counts.satChoi]);
          aoa.push(['Đèn Pha', counts.denPha]);
          aoa.push(['']);

          let globalIndex = 0;
          chosen.forEach((order, orderIdx) => {
            aoa.push([`=== Đơn hàng: ${order.spo_number || '(chưa có)'} — Hạn: ${order.due_date || '(chưa)'} — Đơn vị: ${order.address || '(chưa)'} ===`]);
            let quotes = [];
            try { quotes = JSON.parse(order.items || '[]'); } catch (e) { quotes = []; }
            quotes.forEach(q => {
              globalIndex++;
              // Cấp 2: quote summary
              aoa.push(['']);
              aoa.push(['#', 'Outlet Code', 'Tên Outlet', 'SPO', 'Địa chỉ']);
              const startIdx = aoa.length;
              aoa.push([
                '',
                q.outlet_code || '',
                q.outlet_name || '',
                q.spo_number || '',
                (q.address && !q.address.startsWith('Địa chỉ sẽ')) ? q.address : ''
              ]);
              _manage_group_records.push({ start: startIdx, value: globalIndex });

              // Cấp 3: items
              let items = [];
              try { items = JSON.parse(q.items || '[]'); } catch (e) { items = []; }
              // Remove items containing 'Giấy phép'
              items = items.filter(it => !String(it.content || '').toLowerCase().includes('giấy phép'));
              if (variant === 'production') {
                aoa.push(['', 'Code', 'Nội dung', 'Kích thước', 'SL', 'ĐVT']);
              } else {
                aoa.push(['', 'Code', 'Nội dung', 'Kích thước', 'SL', 'ĐVT', 'Đơn giá', 'Thành tiền']);
              }
              items.forEach(it => {
                const size = (it.width && it.height) ? `${it.width}m × ${it.height}m` : '';
                if (variant === 'production') {
                  aoa.push(['', it.code || '', it.content || '', size, it.quantity || '', it.unit || '']);
                } else {
                  const price = 0; // placeholder until pricing provided
                  const qty = parseNumber(it.quantity) || 0;
                  const total = Math.round(price * qty);
                  aoa.push(['', it.code || '', it.content || '', size, it.quantity || '', it.unit || '', price, total]);
                }
              });
            });
            aoa.push(['']);
          });
        } else {
          showToast('Loại xuất không hợp lệ');
          return;
        }

        // Process recorded groups: determine end row, clear non-start cells for merged columns, then create merges
        const merges = [];
        _manage_group_records.forEach(rec => {
          let j = rec.start + 1;
          while (j < aoa.length && Array.isArray(aoa[j]) && aoa[j][0] === '' && typeof aoa[j][1] !== 'undefined') {
            j++;
          }
          const end = j - 1;
          if (end >= rec.start) {
            const mergeCols = [0,1,2,3,4];
            // set start cell value
            if (!aoa[rec.start]) aoa[rec.start] = [];
            aoa[rec.start][0] = rec.value;
            // clear other rows in merged columns
            for (let r = rec.start + 1; r <= end; r++) {
              if (!aoa[r]) continue;
              mergeCols.forEach(c => aoa[r][c] = '');
            }
            merges.push({ s: { r: rec.start, c: 0 }, e: { r: end, c: 0 } });
            merges.push({ s: { r: rec.start, c: 1 }, e: { r: end, c: 1 } });
            merges.push({ s: { r: rec.start, c: 2 }, e: { r: end, c: 2 } });
            merges.push({ s: { r: rec.start, c: 3 }, e: { r: end, c: 3 } });
            merges.push({ s: { r: rec.start, c: 4 }, e: { r: end, c: 4 } });
          }
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'] = ws['!merges'].concat(merges);
        // Apply number formats for money columns in manage export
        try {
          const lastRow = aoa.length - 1;
          if (variant === 'order') {
            // item Đơn giá (6), Thành tiền (7), and quote total may be at col 5 in summary rows
            for (let r = 1; r <= lastRow; r++) {
              [6, 7].forEach(c => {
                const cellRef = XLSX.utils.encode_cell({ c, r });
                if (ws[cellRef] && ws[cellRef].t === 'n') ws[cellRef].z = '#,##0';
              });
            }
          } else {
            // production/contractor: possible money columns at 6/7 as well
            for (let r = 1; r <= lastRow; r++) {
              [6, 7].forEach(c => {
                const cellRef = XLSX.utils.encode_cell({ c, r });
                if (ws[cellRef] && ws[cellRef].t === 'n') ws[cellRef].z = '#,##0';
              });
            }
          }
        } catch (e) { /* ignore */ }
        const wb = XLSX.utils.book_new();
  const sheetName = variant === 'order' ? 'Ra Don Hang' : (variant === 'production' ? 'San Xuat & Thi Cong' : 'Thau Phu');
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = variant === 'order'
          ? `DonHang_${dateStr}.xlsx`
          : (variant === 'production' ? `SanXuat_ThiCong_${dateStr}.xlsx` : `ThauPhu_${dateStr}.xlsx`);
        XLSX.writeFile(wb, fileName);
        // Mark orders as exported and persist (for 'order' variant)
        if (variant === 'order') {
          const now = new Date().toISOString();
          chosen.forEach(order => {
            order.is_exported = true;
            order.exported_at = now;
            order.qcag_status = 'Đã ra đơn';
            if (window.dataSdk && typeof window.dataSdk.update === 'function') {
              try { window.dataSdk.update(order); } catch (e) { /* ignore */ }
            }
          });
          renderProductionOrdersList(productionOrders);
        }
        showToast('Đã xuất Excel thành công');
      } catch (e) {
        console.error('Export error:', e);
        showToast('Lỗi khi xuất Excel');
      }
    }

    function safeCountConstructionPoints(order) {
      try {
        const pd = JSON.parse(order.items || '[]');
        return Array.isArray(pd) ? pd.length : parseInt(order.phone) || 0;
      } catch (e) {
        return parseInt(order.phone) || 0;
      }
    }

    function countSpecialItems(orders) {
      const result = { tru90: 0, tru114: 0, satChoi: 0, denPha: 0 };
      orders.forEach(order => {
        let quotes = [];
        try { quotes = JSON.parse(order.items || '[]'); } catch (e) { quotes = []; }
        quotes.forEach(q => {
          let items = [];
          try { items = JSON.parse(q.items || '[]'); } catch (e) { items = []; }
          items.forEach(it => {
            const code = String(it.code || '').toUpperCase();
            const content = String(it.content || '').toLowerCase();
            const qty = parseNumber(it.quantity) || 0;
            if (code === '8.1') result.tru90 += qty;
            if (code === 'S8.3') result.tru114 += qty;
            if (code === 'S8.4') result.satChoi += qty;
            if (content.includes('đèn pha') || code === 'DENPHA' || code === 'DP') result.denPha += qty;
          });
        });
      });
      return result;
    }

    // Placeholder contractor price lookup
    const contractorPriceTable = {
      // 'Thau A': { '1.1': 400000, '2.1': 700000 },
      // 'Thau B': { '1.1': 420000 }
    };
    function lookupContractorPrice(contractor, item) {
      if (!contractor || !contractorPriceTable[contractor]) return 0;
      const map = contractorPriceTable[contractor];
      const code = String(item.code || '').toUpperCase();
      return Number(map[code] || 0);
    }

    function closeManageProductionModal() {
      document.getElementById('manage-production-orders-modal').classList.add('hidden');
      ensureScrollLock();
    }

    function filterManageProductionOrders() {
      const searchTerm = document.getElementById('manage-search').value.toLowerCase();
      
      if (searchTerm === '') {
        filteredProductionOrders = productionOrders;
      } else {
        filteredProductionOrders = productionOrders.filter(order =>
          (order.spo_number && String(order.spo_number).toLowerCase().includes(searchTerm)) ||
          (order.address && String(order.address).toLowerCase().includes(searchTerm)) ||
          (order.due_date && String(order.due_date).toLowerCase().includes(searchTerm))
        );
      }
      
      renderProductionOrdersList(filteredProductionOrders);
    }

    function renderProductionOrdersList(orders) {
      const container = document.getElementById('production-orders-list');
      
      if (!Array.isArray(orders) || orders.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Chưa có đơn hàng sản xuất nào</p>';
        return;
      }

      const sortedOrders = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // ===== Người phụ trách helpers (local-only; no new backend/API) =====
      const escapeHtmlLocal = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const authUser = (typeof window !== 'undefined' && window.__qcagAuthUser) ? window.__qcagAuthUser : null;
      const currentUsername = authUser && authUser.username ? String(authUser.username).trim() : '';
      const currentIsAdmin = currentUsername === 'adminqcag' || (authUser && !!authUser.is_admin);

      const getResponsibleAccountOptions = () => {
        const list = [{ username: 'adminqcag', name: 'adminqcag' }];
        try {
          const raw = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem('qcag_registered_users') : null;
          const users = raw ? JSON.parse(raw) : [];
          if (Array.isArray(users)) {
            users.forEach(u => {
              const username = u && u.username ? String(u.username).trim() : '';
              const name = u && u.name ? String(u.name).trim() : '';
              // only include active/approved users
              if (!username) return;
              if (u && typeof u.approved !== 'undefined' && !u.approved) return;
              list.push({ username, name: name || username });
            });
          }
        } catch (e) { /* ignore */ }

        const map = new Map();
        list.forEach(u => {
          if (!u || !u.username) return;
          if (!map.has(u.username)) map.set(u.username, { username: u.username, name: u.name || u.username });
        });
        return Array.from(map.values()).sort((a, b) => String(a.name || a.username).localeCompare(String(b.name || b.username), 'vi', { sensitivity: 'base' }));
      };

      const responsibleAccounts = getResponsibleAccountOptions();
      const accountNameByUsername = (() => {
        const m = new Map();
        responsibleAccounts.forEach(u => m.set(String(u.username), String(u.name || u.username)));
        return m;
      })();

      const getDisplayNameByUsername = (username, order) => {
        if (!username) return '';
        const key = String(username);
        if (accountNameByUsername.has(key)) return accountNameByUsername.get(key);
        try {
          if (order && order.created_by && String(order.created_by) === key && order.created_by_name) {
            return String(order.created_by_name);
          }
        } catch (e) { /* ignore */ }
        return key;
      };

      const parseResponsiblesJson = (raw) => {
        try {
          const arr = JSON.parse(raw || '[]');
          return Array.isArray(arr) ? arr.map(x => String(x || '').trim()).filter(Boolean) : [];
        } catch (e) {
          return [];
        }
      };

      const normalizeResponsiblesDraft = (creatorUsername, list) => {
        const creator = creatorUsername ? String(creatorUsername).trim() : '';
        let next = Array.isArray(list) ? list.map(x => String(x || '').trim()).filter(Boolean) : [];
        if (creator) {
          next = next.filter(u => String(u) !== String(creator));
          next.unshift(creator);
        }
        return Array.from(new Set(next));
      };

      const buildResponsiblesCellHtml = (order, draftJson, { isEditable, canAdd, canRemove, creatorUsername }) => {
        const draft = normalizeResponsiblesDraft(creatorUsername, parseResponsiblesJson(draftJson));
        const normalizedJson = JSON.stringify(draft);
        const excludedUsernames = new Set(draft.map(u => String(u)));
        const creatorLabel = creatorUsername ? (getDisplayNameByUsername(creatorUsername, order) || '-') : '-';
        const creatorPlus = (isEditable && canAdd)
          ? `<button type="button" class="ml-1 w-4 h-4 rounded border border-gray-300 text-gray-700 text-[11px] leading-none hover:bg-gray-50" data-resp-plus data-id="${order.__backendId}" title="Thêm người phụ trách">+</button>`
          : '';

        const creatorChip = `
          <div class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]">
            <div class="flex items-center gap-1">
              <div class="text-[11px] font-semibold text-gray-800 leading-tight">${escapeHtmlLocal(creatorLabel)}</div>
              <div class="text-[9px] italic text-gray-500 leading-tight">người tạo</div>
            </div>
            ${isEditable ? creatorPlus : ''}
          </div>
        `;

        const otherChips = draft
          .filter(u => !creatorUsername || String(u) !== String(creatorUsername))
          .map(u => {
            const label = getDisplayNameByUsername(u, order) || String(u);
            const removeBtn = (isEditable && canRemove)
              ? `<button type="button" class="ml-1 text-gray-500 hover:text-red-600 text-[11px]" data-resp-remove data-id="${order.__backendId}" data-username="${String(u).replace(/"/g, '&quot;')}" title="Xóa">×</button>`
              : '';
            return `
              <div class="inline-flex items-center rounded px-1.5 py-0.5 text-[11px]">
                <div class="text-[11px] font-medium text-gray-800 truncate max-w-[120px]">${escapeHtmlLocal(label)}</div>
                ${isEditable ? removeBtn : ''}
              </div>
            `;
          }).join('');

        const dropdown = (isEditable && canAdd)
          ? `
            <div class="hidden absolute left-0 mt-1 w-48 max-h-56 overflow-auto bg-white border border-gray-200 rounded shadow-lg z-50" data-resp-dropdown data-id="${order.__backendId}">
              ${responsibleAccounts.filter(u => !excludedUsernames.has(String(u.username))).map(u => {
                const uname = String(u.username);
                const label = String(u.name || u.username);
                return `<button type="button" class="block w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 truncate" data-resp-pick data-id="${order.__backendId}" data-username="${uname.replace(/"/g, '&quot;')}">${escapeHtmlLocal(label)}</button>`;
              }).join('')}
            </div>
          `
          : '';

        return `
          <div class="relative" data-resp-root data-id="${order.__backendId}">
            <div class="flex flex-col items-start gap-2" data-resp-chips data-id="${order.__backendId}">${creatorChip}${otherChips}</div>
            <input type="hidden" class="inline-edit" data-id="${order.__backendId}" data-field="responsibles" data-original='${normalizedJson}' value='${normalizedJson}' />
            ${dropdown}
          </div>
        `;
      };

      container.innerHTML = `
        <div class="w-full overflow-x-auto">
          <table class="min-w-full table-fixed border-separate border-spacing-0 divide-y divide-gray-200">
            <colgroup>
              <col style="width:48px;">
              <col style="width:180px;">
              <col style="width:120px;">
              <col style="width:120px;">
              <col style="width:160px;">
              <col style="width:220px;">
              <col style="width:260px;">
              <col style="width:120px;">
            </colgroup>
            <thead class="bg-gray-50">
              <tr>
                <th class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
                <th class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số Đơn Hàng</th>
                <th class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày tạo đơn hàng</th>
                <th class="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Số lượng điểm</th>
                <th class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hạn thi công</th>
                <th class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Đơn Vị Thi Công</th>
                <th class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người phụ trách</th>
                <th class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${sortedOrders.map((order, index) => {
                let constructionPointsCount = 0;
                try {
                  const pd = JSON.parse(order.items || '[]');
                  constructionPointsCount = Array.isArray(pd) ? pd.length : parseInt(order.phone) || 0;
                } catch (e) {
                  constructionPointsCount = parseInt(order.phone) || 0;
                }
                const displayOrderNo = (order.spo_number && order.spo_number !== 'Chưa nhập số đơn hàng') ? order.spo_number : '';
                const displayDue = order.due_date && order.due_date !== 'Chưa nhập hạn thi công' ? order.due_date : '';
                const displayUnit = order.address && order.address !== 'Chưa nhập đơn vị thi công' ? order.address : '';
                const checked = selectedManageOrders.has(String(order.__backendId)) ? 'checked' : '';
                const isConfirmed = !!order.is_confirmed;
                const isEditing = !!order.is_editing;
                const disableInputs = isConfirmed && !isEditing ? 'disabled' : '';

                // Người phụ trách UI: show +/× only when allowed by current lock/edit state
                const isEditable = (!isConfirmed) || isEditing;
                const rawResp = (typeof order.responsibles === 'string') ? order.responsibles : JSON.stringify(order.responsibles || []);
                const rawArr = parseResponsiblesJson(rawResp);
                const creatorUsername = order && order.created_by ? String(order.created_by).trim() : '';
                const effectiveCreator = creatorUsername || (rawArr[0] || '');
                const normalizedDraft = JSON.stringify(normalizeResponsiblesDraft(effectiveCreator, rawArr));
                const draftArr = parseResponsiblesJson(normalizedDraft);
                const canAdd = isEditable && !!currentUsername;
                const canRemove = isEditable && !!currentUsername;
                const responsiblesCell = buildResponsiblesCellHtml(order, normalizedDraft, { isEditable, canAdd, canRemove, creatorUsername: effectiveCreator });
                const actionCell = (() => {
                  if (isEditing) {
                    return `<div class=\"flex items-center gap-2\">
                      <button class=\"px-3 py-1 text-xs bg-green-600 text-white rounded\" data-row-action=\"confirm\" data-id=\"${order.__backendId}\">Xác nhận</button>
                      <button class=\"px-3 py-1 text-xs bg-gray-300 text-gray-800 rounded\" data-row-action=\"cancel\" data-id=\"${order.__backendId}\">Hủy</button>
                    </div>`;
                  }
                  const wrench = `<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"w-5 h-5\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M21 16l-4-4m0 0l-4-4m4 4L7 21H3v-4l9-10\"/></svg>`;
                  const editBtn = `<button class=\"px-2 py-1 text-xs bg-blue-600 text-white rounded inline-flex items-center gap-1\" title=\"Chỉnh sửa\" data-row-action=\"edit\" data-id=\"${order.__backendId}\">${wrench}</button>`;
                  if (isConfirmed) {
                    return `<div class=\"flex items-center gap-2 whitespace-nowrap\">${editBtn}<button class=\"px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded\" data-row-action=\"export-production\" data-id=\"${order.__backendId}\">Thi công</button>\n                    <button class=\"px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded\" data-row-action=\"export-generate\" data-id=\"${order.__backendId}\">Ra Đơn Hàng</button><button class=\"px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded\" data-row-action=\"export-generate-excel\" data-id=\"${order.__backendId}\">Xuất Excel</button></div>`;
                  }
                  // Only block confirm when required fields are missing.
                  const missing = [];
                  if (!displayOrderNo) missing.push('Số đơn hàng');
                  if (!displayDue) missing.push('Hạn thi công');
                  if (!displayUnit) missing.push('Đơn vị thi công');
                  const disableAttr = missing.length ? `data-disabled=\"true\" data-missing=\"${missing.join(', ')}\"` : '';
                  return `<div class=\"flex items-center gap-2 whitespace-nowrap\">\n                    <button class=\"px-3 py-1 text-xs bg-green-600 text-white rounded\" data-row-action=\"confirm\" data-id=\"${order.__backendId}\" ${disableAttr}>Xác nhận</button>\n                    <button class=\"px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded\" data-row-action=\"export-production\" data-id=\"${order.__backendId}\">Thi công</button>\n                    <button class=\"px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded\" data-row-action=\"export-generate\" data-id=\"${order.__backendId}\">Ra Đơn Hàng</button><button class=\"px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded\" data-row-action=\"export-generate-excel\" data-id=\"${order.__backendId}\">Xuất Excel</button>\n                  </div>`;
                })();
                return `
                  <tr class="hover:bg-gray-50" data-id="${order.__backendId}">
                    <td class="px-2 py-3 whitespace-nowrap text-sm text-gray-900 align-top">${index + 1}</td>
                    <td class="px-2 py-3 whitespace-nowrap text-sm align-top">
                      <input 
                        type="text"
                        class="inline-edit w-44 px-3 py-1.5 border border-gray-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+ Nhập số đơn hàng"
                        value="${displayOrderNo}"
                        data-id="${order.__backendId}"
                        data-field="spo_number"
                        data-original="${displayOrderNo}"
                        ${disableInputs}
                      />
                    </td>
                    <td class="px-2 py-3 whitespace-nowrap text-sm align-top">${new Date(order.created_at).toLocaleString('vi-VN')}</td>
                    <td class="px-2 py-3 whitespace-nowrap text-sm text-center align-top">
                      <button class="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded" title="Xem chi tiết" onclick="openManageOrderDetailsModal('${order.__backendId}')">${constructionPointsCount}</button>
                    </td>
                    <td class="px-2 py-3 whitespace-nowrap text-sm align-top">
                      <input 
                        type="date"
                        class="inline-edit w-36 px-3 py-1.5 border border-gray-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+ Nhập hạn thi công"
                        value="${displayDue}"
                        data-id="${order.__backendId}"
                        data-field="due_date"
                        data-original="${displayDue}"
                        ${disableInputs}
                      />
                    </td>
                    <td class="px-2 py-3 whitespace-nowrap text-sm align-top">
                      <input 
                        type="text"
                        class="inline-edit w-56 px-3 py-1.5 border border-gray-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+ Nhập đơn vị thi công"
                        value="${displayUnit}"
                        data-id="${order.__backendId}"
                        data-field="address"
                        data-original="${displayUnit}"
                        ${disableInputs}
                      />
                    </td>
                    <td class="px-2 py-3 whitespace-nowrap text-sm align-top" data-resp-cell data-id="${order.__backendId}">${responsiblesCell}</td>
                    <td class="px-2 py-3 whitespace-nowrap text-sm align-top action-cell">${actionCell}</td>
                  </tr>
                  ${isEditing ? `<tr id="manage-history-${order.__backendId}"><td colspan=\"8\" class=\"px-4 pb-4 bg-yellow-50\">${buildOrderHistoryHTML(order)}</td></tr>` : ''}
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Inject admin delete buttons for confirmed orders when current user is admin
      try {
        if (currentIsAdmin) {
          const rows = container.querySelectorAll('tr[data-id]');
          rows.forEach(tr => {
            try {
              const id = tr.getAttribute('data-id');
              if (!id) return;
              const order = productionOrders.find(o => String(o.__backendId) === String(id));
              if (!order || !order.is_confirmed) return;
              const actionCell = tr.querySelector('.action-cell > div');
              if (!actionCell) return;
              if (actionCell.querySelector('button[data-row-action="admin-delete"]')) return;
              const btn = document.createElement('button');
              btn.className = 'px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded';
              btn.setAttribute('data-row-action', 'admin-delete');
              btn.setAttribute('data-id', id);
              btn.title = 'Xóa (Admin)';
              btn.textContent = 'Xóa';
              actionCell.appendChild(btn);
            } catch (e) { /* ignore per-row errors */ }
          });
        }
      } catch (e) { /* ignore injection errors */ }

      // Ensure action buttons do not wrap – keep them on one line
      container.querySelectorAll('.action-cell').forEach(td => {
        td.style.whiteSpace = 'nowrap';
        const inner = td.querySelector('div');
        if (inner) { inner.style.flexWrap = 'nowrap'; inner.style.whiteSpace = 'nowrap'; }
      });
      // Bind inline edit events and row-level confirm/enable
      container.querySelectorAll('input.inline-edit').forEach((input) => {
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
          }
        });
        const original = input.getAttribute('data-original') || input.value;
        input.addEventListener('input', () => {
          const row = input.closest('tr');
          const orderId = row?.dataset.id;
          if (!orderId) return;
          const btn = container.querySelector(`button[data-row-action="confirm"][data-id="${orderId}"]`);
          if (btn) btn.removeAttribute('data-disabled');
        });
      });

      // ===== Người phụ trách interactions (draft only; saved on Confirm) =====
      const closeAllRespDropdowns = () => {
        container.querySelectorAll('[data-resp-dropdown]').forEach(el => {
          el.classList.add('hidden');
          el.style.left = '';
          el.style.top = '';
          el.style.zIndex = '';
        });
      };

      if (!window.__qcagRespPickerBound) {
        window.__qcagRespPickerBound = true;
        document.addEventListener('click', (e) => {
          try {
            const root = document.getElementById('production-orders-list');
            if (!root) return;
            if (e && e.target && e.target.closest && e.target.closest('[data-resp-root]')) return;
            root.querySelectorAll('[data-resp-dropdown]').forEach(el => el.classList.add('hidden'));
          } catch (_) { /* ignore */ }
        });
      }

      const updateRespChipsFromHidden = (backendId) => {
        const root = container.querySelector(`[data-resp-root][data-id="${backendId}"]`);
        if (!root) return;
        const chips = root.querySelector('[data-resp-chips]');
        const hidden = root.querySelector('input.inline-edit[data-field="responsibles"]');
        if (!chips || !hidden) return;

        const idx = productionOrders.findIndex(o => String(o.__backendId) === String(backendId));
        const order = idx >= 0 ? productionOrders[idx] : null;
        const isConfirmed = order ? !!order.is_confirmed : false;
        const isEditing = order ? !!order.is_editing : false;
        const isEditable = (!isConfirmed) || isEditing;

        const creatorUsername = order && order.created_by ? String(order.created_by).trim() : '';
        const currentDraftArr = parseResponsiblesJson(hidden.value || '[]');
        const effectiveCreator = creatorUsername || (currentDraftArr[0] || '');
        const normalized = JSON.stringify(normalizeResponsiblesDraft(effectiveCreator, currentDraftArr));
        hidden.value = normalized;

        const draftArr = parseResponsiblesJson(normalized);
        const canAdd = isEditable && !!currentUsername;
        const canRemove = isEditable && !!currentUsername;

        const tmp = document.createElement('div');
        tmp.innerHTML = buildResponsiblesCellHtml(order || {}, normalized, { isEditable, canAdd, canRemove, creatorUsername: effectiveCreator });
        const newChips = tmp.querySelector('[data-resp-chips]');
        if (newChips) chips.innerHTML = newChips.innerHTML;

        const dropdown = root.querySelector('[data-resp-dropdown]');
        const newDropdown = tmp.querySelector('[data-resp-dropdown]');
        if (dropdown && newDropdown) dropdown.innerHTML = newDropdown.innerHTML;
      };

      // Use event delegation so newly-rendered chips keep working
      if (!container.__qcagRespDelegationBound) {
        container.__qcagRespDelegationBound = true;
        container.addEventListener('click', (e) => {
          const plusBtn = e.target && e.target.closest ? e.target.closest('button[data-resp-plus]') : null;
          if (plusBtn && container.contains(plusBtn)) {
            e.stopPropagation();
            const id = plusBtn.dataset.id;
            if (!id) return;
            const dropdown = container.querySelector(`[data-resp-dropdown][data-id="${id}"]`);
            if (!dropdown) return;
            // compute position so dropdown appears to the right of the + button
            closeAllRespDropdowns();
            try {
              const rootEl = container.querySelector(`[data-resp-root][data-id="${id}"]`) || dropdown.closest('[data-resp-root]');
              const rootRect = rootEl ? rootEl.getBoundingClientRect() : { left: 0, top: 0 };
              const btnRect = plusBtn.getBoundingClientRect();
              const leftPx = Math.round(btnRect.right - rootRect.left + 6); // 6px gap
              const topPx = Math.round(btnRect.top - rootRect.top);
              dropdown.style.left = leftPx + 'px';
              dropdown.style.top = topPx + 'px';
              dropdown.style.zIndex = '9999';
            } catch (err) { /* ignore positioning errors */ }
            dropdown.classList.remove('hidden');
            return;
          }

          const pickBtn = e.target && e.target.closest ? e.target.closest('button[data-resp-pick]') : null;
          if (pickBtn && container.contains(pickBtn)) {
            e.stopPropagation();
            const id = pickBtn.dataset.id;
            const username = pickBtn.dataset.username;
            if (!id || !username) return;
            const root = container.querySelector(`[data-resp-root][data-id="${id}"]`);
            if (!root) return;
            const hidden = root.querySelector('input.inline-edit[data-field="responsibles"]');
            if (!hidden) return;
            const idx = productionOrders.findIndex(o => String(o.__backendId) === String(id));
            const order = idx >= 0 ? productionOrders[idx] : null;
            const creatorUsername = order && order.created_by ? String(order.created_by).trim() : '';
            const curArr = parseResponsiblesJson(hidden.value || '[]');
            const effectiveCreator = creatorUsername || (curArr[0] || '');
            const draft = normalizeResponsiblesDraft(effectiveCreator, curArr);
            if (!draft.includes(String(username))) {
              const next = [...draft, String(username)];
              hidden.value = JSON.stringify(normalizeResponsiblesDraft(effectiveCreator, next));
              const confirmBtn = container.querySelector(`button[data-row-action="confirm"][data-id="${id}"]`);
              if (confirmBtn) confirmBtn.removeAttribute('data-disabled');
            }
            updateRespChipsFromHidden(id);
            return;
          }

          const removeBtn = e.target && e.target.closest ? e.target.closest('button[data-resp-remove]') : null;
          if (removeBtn && container.contains(removeBtn)) {
            e.stopPropagation();
            const id = removeBtn.dataset.id;
            const username = removeBtn.dataset.username;
            if (!id || !username) return;
            const root = container.querySelector(`[data-resp-root][data-id="${id}"]`);
            if (!root) return;
            const hidden = root.querySelector('input.inline-edit[data-field="responsibles"]');
            if (!hidden) return;
            const idx = productionOrders.findIndex(o => String(o.__backendId) === String(id));
            const order = idx >= 0 ? productionOrders[idx] : null;
            const creatorUsername = order && order.created_by ? String(order.created_by).trim() : '';
            const curArr = parseResponsiblesJson(hidden.value || '[]');
            const effectiveCreator = creatorUsername || (curArr[0] || '');
            if (effectiveCreator && String(username) === String(effectiveCreator) && String(currentUsername) !== String(effectiveCreator)) return;
            const draft = normalizeResponsiblesDraft(effectiveCreator, curArr);
            hidden.value = JSON.stringify(draft.filter(u => String(u) !== String(username)));
            const confirmBtn = container.querySelector(`button[data-row-action="confirm"][data-id="${id}"]`);
            if (confirmBtn) confirmBtn.removeAttribute('data-disabled');
            updateRespChipsFromHidden(id);
          }
        });
      }

      // Row-level actions
      container.querySelectorAll('button[data-row-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const action = btn.dataset.rowAction;
          const id = btn.dataset.id;
          if (action === 'edit') {
            setOrderEditing(id, true);
            return;
          }
          // delete and notes actions removed per request
          if (action === 'cancel') {
            // revert values to originals and exit editing
            revertRowValues(id);
            setOrderEditing(id, false);
            return;
          }
          if (action === 'confirm') {
            if (btn.hasAttribute('data-disabled')) {
              const missing = btn.getAttribute('data-missing') || '';
              showToast(missing ? `Vui lòng nhập: ${missing}` : 'Vui lòng nhập đủ thông tin trước khi xác nhận');
              return;
            }

            const __profile = (() => {
              try { return String(localStorage.getItem('QCAG_PROFILE_MANAGE_PRODUCTION_CONFIRM') || '') === '1'; } catch (_) { return false; }
            })();
            const __t0 = __profile && typeof performance !== 'undefined' ? performance.now() : 0;

            const values = collectRowValues(id);
            const finalizedAt = new Date().toISOString();

            // FIX: Update qcag_status of child quotes when confirming production order
            const idxOrder = productionOrders.findIndex(o => String(o.__backendId) === String(id));
            if (idxOrder >= 0) {
              const order = productionOrders[idxOrder];
              const spoNumber = order.spo_number || values.spo_number;
              
              // Parse quotes from items field
              let quotes = [];
              try { 
                quotes = JSON.parse(order.items || '[]'); 
              } catch (e) { 
                console.warn('[QCAG] Failed to parse production order items:', e);
              }
              
              // Update currentQuotes to reflect confirmed status
              if (Array.isArray(quotes) && quotes.length > 0 && spoNumber) {
                const matchSet = new Set(quotes.map(q => `${q.outlet_code || ''}__${q.sale_name || ''}`));
                currentQuotes = currentQuotes.map(q => {
                  const key = `${q.outlet_code || ''}__${q.sale_name || ''}`;
                  if (matchSet.has(key)) {
                    // Update status to "Đã ra đơn" unless it's cancelled or recreate status
                    const shouldUpdate = q.qcag_status !== 'Hủy' && q.qcag_status !== 'Ra lại đơn hàng';
                    return shouldUpdate ? { 
                      ...q, 
                      qcag_status: 'Đã ra đơn',
                      qcag_order_number: spoNumber 
                    } : q;
                  }
                  return q;
                });
                console.log(`[QCAG] Confirm: Updated qcag_status for ${quotes.length} quotes in production order ${spoNumber}`);
              }
            }

            // Save once, then render once (previously: saveRowFields + setOrderConfirmed + setOrderEditing caused 3 renders and 2 updates)
            await saveRowFields(id, values, {
              skipRender: true,
              skipUpdateMainList: true,
              backgroundPersist: true,
              extraUpdates: { is_confirmed: true, last_confirmed_at: finalizedAt, is_editing: false }
            });

            const __t1 = __profile && typeof performance !== 'undefined' ? performance.now() : 0;
            renderProductionOrdersList(productionOrders);
            const __t2 = __profile && typeof performance !== 'undefined' ? performance.now() : 0;

            // Defer heavy main list refresh so the table paints first.
            const __defer = (fn) => {
              try {
                if (typeof requestAnimationFrame === 'function') {
                  requestAnimationFrame(() => setTimeout(fn, 0));
                } else {
                  setTimeout(fn, 0);
                }
              } catch (_) {
                setTimeout(fn, 0);
              }
            };

            if (typeof updateMainList === 'function') {
              __defer(() => {
                const __u0 = __profile && typeof performance !== 'undefined' ? performance.now() : 0;
                try { updateMainList(); } catch (e) { /* ignore */ }
                const __u1 = __profile && typeof performance !== 'undefined' ? performance.now() : 0;
                if (__profile) {
                  console.log('[QCAG] manage-production updateMainList timing', { updateMainListMs: Math.round(__u1 - __u0) });
                }
              });
            }

            if (__profile) {
              console.log('[QCAG] manage-production confirm timing', {
                saveMs: Math.round(__t1 - __t0),
                renderMs: Math.round(__t2 - __t1),
                totalMs: Math.round(__t2 - __t0)
              });
            }
            return;
          }

          if (action === 'admin-delete') {
            // Admin-only: delete a confirmed production order and revert associated quotes
            if (!currentIsAdmin) return;
            if (!confirm('Bạn có chắc chắn muốn xóa đơn hàng này? Hành động sẽ trả các điểm về trạng thái trước khi tạo đơn.')) return;
            const idxOrder = productionOrders.findIndex(o => String(o.__backendId) === String(id));
            if (idxOrder < 0) return;
            const orderToDelete = productionOrders[idxOrder];
            const orderLabel = orderToDelete.spo_number || orderToDelete.outlet_code || orderToDelete.id || '';
            try {
              const quotes = JSON.parse(orderToDelete.items || '[]');
              quotes.forEach(q => {
                const targetKey = q.quote_key || `${q.outlet_code || ''}__${q.sale_name || ''}`;
                const foundIdx = currentQuotes.findIndex(c => {
                  try {
                    if (typeof getQuoteKey === 'function') {
                      const k = getQuoteKey(c);
                      if (k && targetKey && String(k) === String(targetKey)) return true;
                    }
                  } catch (e) {}
                  const k2 = `${c.outlet_code || ''}__${c.sale_name || ''}`;
                  return String(k2) === String(targetKey);
                });
                if (foundIdx >= 0) {
                  try {
                    const old = currentQuotes[foundIdx];
                    const notes = (() => { try { return JSON.parse(old.added_items_notes || '[]') || []; } catch (e) { return []; } })();
                    notes.push(`Đơn Hàng ${orderLabel} đã được admin hủy.`);
                    const updated = { ...old, qcag_status: '', qcag_order_number: '', order_number: '', added_items_notes: JSON.stringify(notes) };
                    currentQuotes[foundIdx] = updated;
                  } catch (e) { /* ignore per-item errors */ }
                }
              });
            } catch (e) { /* ignore parse errors */ }

            const removed = productionOrders.splice(idxOrder, 1);

            // Persist master-quote updates and delete order on backend (if available)
            const mastersToUpdate = [];
            try {
              const quotes = JSON.parse(orderToDelete.items || '[]');
              quotes.forEach(q => {
                const targetKey = q.quote_key || `${q.outlet_code || ''}__${q.sale_name || ''}`;
                try {
                  const foundIdx = currentQuotes.findIndex(c => {
                    try {
                      if (typeof getQuoteKey === 'function') {
                        const k = getQuoteKey(c);
                        if (k && targetKey && String(k) === String(targetKey)) return true;
                      }
                    } catch (e) {}
                    const k2 = `${c.outlet_code || ''}__${c.sale_name || ''}`;
                    return String(k2) === String(targetKey);
                  });
                  if (foundIdx >= 0) {
                    const old = currentQuotes[foundIdx];
                    try {
                      const master = (typeof findQuoteByKey === 'function') ? findQuoteByKey(getQuoteKey(old)) : null;
                      if (master) {
                        mastersToUpdate.push(master);
                      }
                    } catch (e) { /* ignore */ }
                  }
                } catch (e) { /* ignore per-item */ }
              });
            } catch (e) { /* ignore parse */ }

            if (mastersToUpdate.length && window.dataSdk && typeof window.dataSdk.update === 'function') {
              try {
                const results = await Promise.allSettled(mastersToUpdate.map(m => {
                  try { m.qcag_status = ''; m.qcag_order_number = ''; m.order_number = ''; } catch(e){}
                  try {
                    const notes = (() => { try { return JSON.parse(m.added_items_notes || '[]') || []; } catch (e) { return []; } })();
                    notes.push(`Đơn Hàng ${orderLabel} đã được admin hủy.`);
                    m.added_items_notes = JSON.stringify(notes);
                  } catch (e) {}
                  return window.dataSdk.update(m);
                }));
                const failed = results.filter(r => r.status === 'rejected');
                if (failed.length) showToast('Một số thay đổi không lưu được lên backend (kiểm tra quyền).', 'warning');
              } catch (e) {
                console.error('admin-delete: failed updating masters', e);
                showToast('Không lưu được thay đổi lên backend', 'warning');
              }
            }

            if (removed && removed.length && window.dataSdk && typeof window.dataSdk.delete === 'function') {
              try {
                await window.dataSdk.delete(removed[0]);
              } catch (e) {
                console.error('admin-delete: failed deleting order on backend', e);
                showToast('Không xóa được đơn hàng trên backend; kiểm tra quyền.', 'warning');
              }
            }

            try { if (typeof __qcagMarkProductionOrdersDirty === 'function') __qcagMarkProductionOrdersDirty(); } catch (e) { /* ignore */ }

            renderProductionOrdersList(productionOrders);
            try { updateRecentQuotesPreview(); } catch (e) {}
            if (typeof updateMainList === 'function') updateMainList();
            // Also refresh acceptance UI and any open acceptance detail/modal views
            try { window.__filteredAcceptanceOrders = null; } catch (e) {}
            try { if (typeof window.__renderAcceptanceProductionOrders === 'function') window.__renderAcceptanceProductionOrders(); } catch (e) {}
            try { renderAcceptanceImages(); } catch (e) {}
            try { renderProductionOrdersForAcceptance(); } catch (e) {}
            try { renderAcceptanceDetailModal(); } catch (e) {}
            showToast('Đã xóa đơn hàng (Admin) và trả các điểm về trạng thái ban đầu');
            return;
          }

          
          
          if (action === 'export-generate-excel') {
            try {
              const order = productionOrders.find(o => String(o.__backendId) === String(id));
              if (!order) return;
              // prepare pages context for exporter
              const pagesContainer = document.getElementById('manage-order-pages');
              try { pagesContainer._quotes = JSON.parse(order.items || '[]'); } catch (e) { pagesContainer._quotes = []; }
              try { document.getElementById('manage-order-details-title').textContent = `Đơn hàng: ${order.spo_number || '(Chưa có số đơn hàng)'}`; } catch (e) { /* ignore */ }
              try { document.getElementById('manage-order-details-subtitle').textContent = `Đơn vị thi công: ${order.address || 'Chưa có'} • Hạn thi công: ${order.due_date || 'Chưa có'}`; } catch (e) { /* ignore */ }
              // Call same exporter used by "Ra Đơn Hàng" so layout is 100% identical
              await exportGenerateOrderExcel(order);
            } catch (e) {
              console.error('export-generate-excel handler error', e);
            }
            return;
          }

          if (action === 'export-production') {
            try {
              const order = productionOrders.find(o => String(o.__backendId) === String(id));
              if (!order) return;
              // populate manage-order-pages._quotes with order items so exporter reads them
              const pagesContainer = document.getElementById('manage-order-pages');
              try { pagesContainer._quotes = JSON.parse(order.items || '[]'); } catch (e) { pagesContainer._quotes = []; }
              // set title/subtitle so header info is correct for the export
              try { document.getElementById('manage-order-details-title').textContent = `Đơn hàng: ${order.spo_number || '(Chưa có số đơn hàng)'}`; } catch (e) { /* ignore */ }
              try { document.getElementById('manage-order-details-subtitle').textContent = `Đơn vị thi công: ${order.address || 'Chưa có'} • Hạn thi công: ${order.due_date || 'Chưa có'}`; } catch (e) { /* ignore */ }
              // Removed Excel export here per request; only generate PDF for "Thi công"
              if (typeof exportProductionPdf === 'function') exportProductionPdf();
            } catch (e) {
              console.error('export-production handler error', e);
            }
            return;
          }

          if (action === 'export-generate') {
            try {
              const order = productionOrders.find(o => String(o.__backendId) === String(id));
              if (!order) return;
              const pagesContainer = document.getElementById('manage-order-pages');
              try { pagesContainer._quotes = JSON.parse(order.items || '[]'); } catch (e) { pagesContainer._quotes = []; }
              try { document.getElementById('manage-order-details-title').textContent = `Đơn hàng: ${order.spo_number || '(Chưa có số đơn hàng)'}`; } catch (e) { /* ignore */ }
              try { document.getElementById('manage-order-details-subtitle').textContent = `Đơn vị thi công: ${order.address || 'Chưa có'} • Hạn thi công: ${order.due_date || 'Chưa có'}`; } catch (e) { /* ignore */ }
              // Removed Excel export here; keep only PDF generation (Ra Đơn Hàng should no longer export Excel)
              if (typeof exportGenerateOrderPdf === 'function') {
                await exportGenerateOrderPdf();
              }
            } catch (e) {
              console.error('export-generate handler error', e);
            }
            return;
          }
        });
      });


      // Add note buttons
      container.querySelectorAll('button[data-add-note]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const ta = document.getElementById(`note-input-${id}`);
          if (!ta) return;
          const text = ta.value.trim();
          if (!text) return;
          const idx = productionOrders.findIndex(o => String(o.__backendId) === String(id));
          if (idx < 0) return;
          const order = productionOrders[idx];
          const notes = Array.isArray(order.notes) ? order.notes : [];
          const entry = ensureNoteHasAuthor({ text, at: new Date().toISOString() });
          const updated = { ...order, notes: [...notes, entry] };
          productionOrders[idx] = updated;
          if (window.dataSdk && typeof window.dataSdk.update === 'function') {
            try { window.dataSdk.update(updated); } catch (e) { /* ignore */ }
          }
          // Rebuild notes row
          const row = document.getElementById(`manage-notes-${id}`);
          if (row) row.innerHTML = `<td colspan=\"8\" class=\"px-4 pb-4 bg-gray-50\">${buildOrderNotesHTML(updated)}</td>`;
          showToast('Đã thêm ghi chú');
        });
      });
      applyEditingVisual();

      // Selection UI removed (checkbox column was removed)
      updateManageExportButtonState();
      // Normalize per-row export button UI: green background and remove icon
      container.querySelectorAll('button[data-row-action="export-generate-excel"]').forEach(btn => {
        btn.className = 'px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded';
        btn.textContent = 'Xuất Excel';
        btn.title = 'Xuất Excel';
      });
      applyEditingVisual();
    }

    function applyEditingVisual() {
      const container = document.getElementById('production-orders-list');
      if (!container) return;
      const anyEditing = productionOrders.some(o => o.is_editing);
      if (anyEditing) container.classList.add('editing'); else container.classList.remove('editing');
      // Mark editing row
      const editing = productionOrders.find(o => o.is_editing);
      container.querySelectorAll('tbody tr').forEach(tr => tr.classList.remove('is-editing'));
      if (editing) {
        const row = container.querySelector(`tbody tr[data-id="${editing.__backendId}"]`);
        if (row) row.classList.add('is-editing');
      }
    }

    // Toggle details view for a saved production order inline
    window.toggleManageOrderDetails = function(backendId) {
      // Deprecated: replaced by modal view
      openManageOrderDetailsModal(backendId);
    }

    window.toggleManageOrderNotes = function(backendId) {
      const row = document.getElementById(`manage-notes-${backendId}`);
      if (!row) return;
      row.classList.toggle('hidden');
    }

    // Build details HTML similar to "Danh Sách Sản Xuất":
    // Cấp 1: theo sale (sale_type + sale_name)
    // Cấp 2: summary từng outlet
    // Cấp 3: bảng item chi tiết
    function buildOrderDetailsHTML(order) {
      let quotes = [];
      try {
        quotes = JSON.parse(order.items || '[]');
      } catch (e) {
        quotes = [];
      }
      if (!Array.isArray(quotes) || quotes.length === 0) {
        return '<p class="text-gray-500 text-sm">Không có dữ liệu chi tiết</p>';
      }
      // Group by sale
      const groupedBySale = {};
      quotes.forEach(q => {
        const saleType = q.sale_type === 'TBA' ? 'TBA' : 'Sale (SR)';
        const saleName = q.sale_name || 'Không có tên';
        const key = `${saleType} - ${saleName}`;
        if (!groupedBySale[key]) groupedBySale[key] = [];
        groupedBySale[key].push(q);
      });

      let html = '';
      let globalIndex = 0;
      Object.keys(groupedBySale).forEach(saleKey => {
        const list = groupedBySale[saleKey];
        const totalAmount = list.reduce((s, q) => s + (parseMoney(q.total_amount) || 0), 0);
        html += `
          <div class="mb-6">
            <h2 class="text-xl font-bold text-gray-800 mb-3">${saleKey} (${list.length} báo giá - ${formatCurrency(totalAmount)})</h2>
            <div class="space-y-3">
              ${list.map(q => {
                globalIndex++;
                let items = [];
                try { items = JSON.parse(q.items || '[]'); } catch (e) { items = []; }
                return `
                  <div class="border border-gray-200 rounded-lg overflow-hidden">
                    <div class="bg-gray-100 px-3 py-2 flex items-center justify-between text-sm">
                      <div class="flex items-center gap-3 min-w-0">
                        <span class="font-bold text-blue-600">${globalIndex}</span>
                        <span class="font-semibold text-gray-800 truncate max-w-[240px]">${q.outlet_name || '-'}</span>
                        <span class="text-gray-600 whitespace-nowrap">| ${q.outlet_code || '-'}</span>
                        ${q.spo_number ? `<span class="text-gray-700 whitespace-nowrap">| ${q.spo_number}</span>` : ''}
                        ${typeof q.point_order_number !== 'undefined' && q.point_order_number !== '' ? `<span class=\"text-blue-700 whitespace-nowrap text-xs font-semibold\">• Số ĐH của điểm: ${q.point_order_number}</span>` : ''}
                        ${q.address && q.address !== 'Địa chỉ sẽ hiển thị tự động khi nhập' ? `<span class="text-gray-500 truncate max-w-[300px]">| ${q.address}</span>` : ''}
                      </div>
                      <span class="font-bold text-blue-600 whitespace-nowrap">${formatCurrency(parseMoney(q.total_amount) || 0)}</span>
                    </div>
                    <div class="p-3">
                      <table class="w-full text-sm">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Code</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Nội dung</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Brand</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Kích thước</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">SL</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">ĐVT</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Đơn giá</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                          ${items.map(it => `
                            <tr class="hover:bg-gray-50">
                              <td class="px-3 py-2 font-medium text-gray-900">${it.code || ''}</td>
                              <td class="px-3 py-2 text-gray-700">${it.content || ''}</td>
                              <td class="px-3 py-2 text-gray-600">${it.brand || '-'}</td>
                              <td class="px-3 py-2 text-gray-600">${it.width && it.height ? `${it.width}m × ${it.height}m` : '-'}</td>
                              <td class="px-3 py-2 text-gray-900">${it.quantity || ''}</td>
                              <td class="px-3 py-2 text-gray-600">${it.unit || ''}</td>
                              <td class="px-3 py-2 text-gray-900">${formatCurrency(parseMoney(it.price) || 0)}</td>
                              <td class="px-3 py-2 font-semibold text-blue-600">${formatCurrencyExact((parseMoney(it.price) || 0) * (parseNumber(it.quantity) || 0))}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      });
      return html;
    }

    function buildOrderNotesHTML(order) {
      const notes = Array.isArray(order.notes) ? order.notes : [];
      const list = notes.map(n => {
        const author = getNoteAuthorLabel(n);
        const authorHtml = author ? `<div class="text-[11px] text-gray-500 mt-0.5">${escapeHtml(author)}</div>` : '';
        return `<li class="text-gray-700">
          <div><span class="text-gray-500">${new Date(n.at).toLocaleString('vi-VN')}</span>: ${escapeHtml(n.text || '')}</div>
          ${authorHtml}
        </li>`;
      }).join('');
      return `
        <div class="text-sm">
          <div class="font-semibold text-gray-800 mb-2">Ghi chú</div>
          <div class="flex items-start gap-3">
            <div class="flex-1">
              <ul class="space-y-1">${list || '<li class=\"text-gray-500\">Chưa có ghi chú</li>'}</ul>
            </div>
            <div class="w-1/2">
              <textarea id="note-input-${order.__backendId}" class="w-full px-3 py-2 border border-gray-300 rounded" rows="3" placeholder="+ Thêm ghi chú"></textarea>
              <div class="mt-2 flex justify-end"><button class="px-3 py-1 text-xs bg-gray-800 text-white rounded" data-add-note id="add-note-${order.__backendId}" data-id="${order.__backendId}">Thêm ghi chú</button></div>
            </div>
          </div>
        </div>
      `;
    }

    function buildOrderHistoryHTML(order) {
      const history = Array.isArray(order.edit_history) ? [...order.edit_history].reverse() : [];
      if (!history.length) return '<div class="text-sm text-gray-500">Chưa có lịch sử chỉnh sửa</div>';
      const labels = { spo_number: 'Số đơn hàng', due_date: 'Hạn thi công', address: 'Đơn vị thi công' };
      return `
        <div class="text-sm">
          <div class="font-semibold text-gray-800 mb-2">Lịch sử chỉnh sửa</div>
          <ul class="space-y-1">
            ${history.map(h => {
              const label = labels[h.field] || h.field;
              return `<li class="text-gray-700"><span class="text-gray-500">${new Date(h.at).toLocaleString('vi-VN')}</span>: <b>${label}</b> đổi từ "${h.oldValue || ''}" → "${h.newValue || ''}"</li>`;
            }).join('')}
          </ul>
        </div>
      `;
    }

    function updateManageExportButtonState() {
      const btn = document.getElementById('manage-export-btn');
      if (!btn) return;
      const cbOrder = document.getElementById('ex-type-order');
      const cbProduction = document.getElementById('ex-type-production');
      const cbContractor = document.getElementById('ex-type-contractor');
      const anyType = (cbOrder && cbOrder.checked) || (cbProduction && cbProduction.checked) || (cbContractor && cbContractor.checked);
      btn.disabled = selectedManageOrders.size === 0 || !anyType;
    }

    function setOrderEditing(backendId, editing) {
      const idx = productionOrders.findIndex(o => String(o.__backendId) === String(backendId));
      if (idx < 0) return;
      productionOrders[idx] = { ...productionOrders[idx], is_editing: !!editing };
      renderProductionOrdersList(productionOrders);
    }

    function setOrderConfirmed(backendId, confirmed) {
      const idx = productionOrders.findIndex(o => String(o.__backendId) === String(backendId));
      if (idx < 0) return;
      productionOrders[idx] = { ...productionOrders[idx], is_confirmed: !!confirmed, last_confirmed_at: new Date().toISOString() };
      // Best-effort remote persist
      if (window.dataSdk && typeof window.dataSdk.update === 'function') {
        try { window.dataSdk.update(productionOrders[idx]); } catch (e) { /* ignore */ }
      }
      renderProductionOrdersList(productionOrders);
    }

    function revertRowValues(backendId) {
      const row = document.querySelector(`#production-orders-list tr[data-id="${backendId}"]`);
      if (!row) return;
      row.querySelectorAll('input.inline-edit').forEach(input => {
        const original = input.getAttribute('data-original') || '';
        input.value = original;
      });
    }

    function collectRowValues(backendId) {
      const row = document.querySelector(`#production-orders-list tr[data-id="${backendId}"]`);
      if (!row) return {};
      const getVal = (field) => {
        const el = row.querySelector(`input.inline-edit[data-field="${field}"]`);
        return el ? el.value.trim() : '';
      };

      const normalizeResponsibles = (creatorUsername, raw) => {
        let arr = [];
        try {
          arr = JSON.parse(raw || '[]');
          if (!Array.isArray(arr)) arr = [];
        } catch (e) {
          arr = [];
        }
        arr = arr.map(x => String(x || '').trim()).filter(Boolean);
        const creator = creatorUsername ? String(creatorUsername).trim() : '';
        if (creator) {
          arr = arr.filter(u => String(u) !== String(creator));
          arr.unshift(creator);
        }
        return JSON.stringify(Array.from(new Set(arr)));
      };

      const responsiblesRaw = getVal('responsibles');
      const idx = productionOrders.findIndex(o => String(o.__backendId) === String(backendId));
      const current = idx >= 0 ? productionOrders[idx] : null;
      let inferredCreator = current && current.created_by ? String(current.created_by).trim() : '';
      if (!inferredCreator) {
        try {
          const arr = JSON.parse(responsiblesRaw || '[]');
          if (Array.isArray(arr) && arr.length) inferredCreator = String(arr[0] || '').trim();
        } catch (e) { /* ignore */ }
      }
      const responsibles = normalizeResponsibles(inferredCreator, responsiblesRaw);
      return {
        spo_number: getVal('spo_number') || 'Chưa nhập số đơn hàng',
        due_date: getVal('due_date') || 'Chưa nhập hạn thi công',
        address: getVal('address') || 'Chưa nhập đơn vị thi công',
        responsibles
      };
    }

    async function saveRowFields(backendId, updates, options = {}) {
      const idx = productionOrders.findIndex(o => String(o.__backendId) === String(backendId));
      if (idx < 0) return;
      const current = productionOrders[idx];
      const oldValues = { spo_number: current.spo_number, due_date: current.due_date, address: current.address };

      // Build edit history entries only for changed fields
      const changes = [];
      for (const k of ['spo_number', 'due_date', 'address']) {
        if (!(k in updates)) continue;
        const before = String(oldValues[k] || '');
        const after = String(updates[k] || '');
        if (before !== after) {
          changes.push({ field: k, oldValue: oldValues[k] || '', newValue: updates[k] || '', at: new Date().toISOString() });
        }
      }

      const existingHistory = Array.isArray(current.edit_history) ? current.edit_history : [];
      const extraUpdates = (options && typeof options.extraUpdates === 'object' && options.extraUpdates) ? options.extraUpdates : null;
      const updated = extraUpdates
        ? { ...current, ...updates, ...extraUpdates, edit_history: [...existingHistory, ...changes] }
        : { ...current, ...updates, edit_history: [...existingHistory, ...changes] };

      let ok = false;
      const backgroundPersist = !!options.backgroundPersist;

      // Optimistic local update first (so UI can render immediately)
      productionOrders[idx] = updated;
      try { if (typeof __qcagMarkProductionOrdersDirty === 'function') __qcagMarkProductionOrdersDirty(); } catch (e) {}
      ok = true;

      const __profile = (() => {
        try { return String(localStorage.getItem('QCAG_PROFILE_MANAGE_PRODUCTION_CONFIRM') || '') === '1'; } catch (_) { return false; }
      })();

      const persist = async () => {
        if (!(window.dataSdk && typeof window.dataSdk.update === 'function')) return true;
        const p0 = __profile && typeof performance !== 'undefined' ? performance.now() : 0;
        try {
          const res = await window.dataSdk.update(updated);
          const okRemote = !!(res && (res.isOk || res.ok));
          const p1 = __profile && typeof performance !== 'undefined' ? performance.now() : 0;
          if (__profile) console.log('[QCAG] manage-production dataSdk.update timing', { updateMs: Math.round(p1 - p0), ok: okRemote });
          return okRemote;
        } catch (e) {
          const p1 = __profile && typeof performance !== 'undefined' ? performance.now() : 0;
          if (__profile) console.log('[QCAG] manage-production dataSdk.update timing', { updateMs: Math.round(p1 - p0), ok: false, error: String(e && e.message ? e.message : e) });
          return false;
        }
      };

      if (backgroundPersist) {
        // Fire-and-forget sync; only notify on failure.
        persist().then((okRemote) => {
          if (!okRemote) showToast('Đồng bộ thất bại');
        });
      } else {
        const okRemote = await persist();
        ok = okRemote || ok;
      }

      // Propagate order number effects if changed
      if ('spo_number' in updates) {
        const value = updates.spo_number;
        const baseNo = parseInt(value, 10);
        try {
          let quotes = [];
          try { quotes = JSON.parse(updated.items || '[]'); } catch (e) { quotes = []; }
          const newItems = quotes.map((q, i) => {
            const pointNo = Number.isFinite(baseNo) ? (baseNo + i + 1) : '';
            return { ...q, point_order_number: pointNo };
          });
          productionOrders[idx] = { ...productionOrders[idx], items: JSON.stringify(newItems) };
          if (Array.isArray(quotes) && quotes.length) {
            const matchSet = new Set(quotes.map(q => `${q.outlet_code || ''}__${q.sale_name || ''}`));
            currentQuotes = currentQuotes.map(q => {
              const key = `${q.outlet_code || ''}__${q.sale_name || ''}`;
              if (matchSet.has(key)) {
                return { ...q, qcag_status: value ? (q.qcag_status === 'Hủy' || q.qcag_status === 'Ra lại đơn hàng' ? q.qcag_status : 'Đã ra đơn') : (q.qcag_status || ''), qcag_order_number: value || '' };
              }
              return q;
            });
          }
        } catch (e) { /* ignore */ }
      }

      if (!options.skipRender) renderProductionOrdersList(productionOrders);
      if (!options.skipUpdateMainList && typeof updateMainList === 'function') updateMainList();
      showToast(ok ? 'Đã lưu thay đổi' : 'Lưu thất bại');
    }

    async function handleInlineSave(backendId, field, value) {
      const idx = productionOrders.findIndex(o => String(o.__backendId) === String(backendId));
      if (idx < 0) return;
      const current = productionOrders[idx];
      const updated = { ...current, [field]: value };
      let ok = false;
      if (window.dataSdk && typeof window.dataSdk.update === 'function') {
        try {
          const res = await window.dataSdk.update(updated);
          ok = !!res?.isOk;
        } catch (e) {
          ok = false;
        }
      }
      if (!ok) {
        // Local fallback
        productionOrders[idx] = updated;
        ok = true;
      }
      // If editing Số Đơn Hàng, propagate to QCAG status and per-point numbers
      if (field === 'spo_number') {
        const baseNo = parseInt(value, 10);
        // Update QCAG display on main quotes
        try {
          let quotes = [];
          try { quotes = JSON.parse(updated.items || '[]'); } catch (e) { quotes = []; }
          // Compute per-point order numbers and store back into items
          const newItems = quotes.map((q, i) => {
            const pointNo = Number.isFinite(baseNo) ? (baseNo + i + 1) : '';
            return { ...q, point_order_number: pointNo };
          });
          // Save back to productionOrders structure
          productionOrders[idx] = { ...productionOrders[idx], spo_number: value || 'Chưa nhập số đơn hàng', items: JSON.stringify(newItems) };
          // Also update currentQuotes qcag_status to reflect the order number
          if (Array.isArray(quotes) && quotes.length) {
            const matchSet = new Set(quotes.map(q => `${q.outlet_code || ''}__${q.sale_name || ''}`));
            currentQuotes = currentQuotes.map(q => {
              const key = `${q.outlet_code || ''}__${q.sale_name || ''}`;
              if (matchSet.has(key)) {
                return { ...q, qcag_status: value ? (q.qcag_status === 'Hủy' || q.qcag_status === 'Ra lại đơn hàng' ? q.qcag_status : 'Đã ra đơn') : (q.qcag_status || ''), qcag_order_number: value || '' };
              }
              return q;
            });
          }
        } catch (e) {
          console.warn('Failed to propagate order number to QCAG/points', e);
        }
      }
      renderProductionOrdersList(productionOrders);
      // Refresh main list so QCAG column shows order number
      if (typeof updateMainList === 'function') updateMainList();
      showToast(ok ? 'Đã lưu thay đổi' : 'Lưu thất bại');
    }

    // Append edit history entry
    async function appendEditHistory(backendId, field, oldValue, newValue) {
      const idx = productionOrders.findIndex(o => String(o.__backendId) === String(backendId));
      if (idx < 0) return;
      const order = productionOrders[idx];
      const entry = { field, oldValue, newValue, at: new Date().toISOString() };
      const history = Array.isArray(order.edit_history) ? order.edit_history : [];
      const updated = { ...order, edit_history: [...history, entry] };
      productionOrders[idx] = updated;
      // Try remote persist best-effort
      if (window.dataSdk && typeof window.dataSdk.update === 'function') {
        try { await window.dataSdk.update(updated); } catch (e) { /* silent */ }
      }
    }

    // Generate a unique order number
    function generateOrderNumber() {
      const timestamp = Date.now();
      return `DH-${new Date(timestamp).toISOString().slice(0, 10).replace(/-/g, '')}-${String(timestamp).slice(-3)}`;
    }

    // Save production list to management
    async function saveToManagement() {
      // Check if we have production data to save
      if (!currentProductionData || currentProductionData.length === 0) {
        showToast('Không có dữ liệu để lưu. Vui lòng tạo danh sách sản xuất trước.');
        return;
      }

      // Show loading state
      const saveBtn = document.getElementById('save-to-management');
      const originalText = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<div class="loading-spinner mr-2"></div> Đang lưu...';

      try {
        // Count construction points (number of quotes in current production data)
        const constructionPointsCount = currentProductionData.length;
        const timestamp = Date.now();
        
        // Calculate total amount safely
        let totalAmount = 0;
        for (const quote of currentProductionData) {
          const amount = parseMoney(quote.total_amount);
          if (!isNaN(amount) && isFinite(amount)) {
            totalAmount += amount;
          }
        }
        
        // Ensure totalAmount is a valid number
        if (isNaN(totalAmount) || !isFinite(totalAmount)) {
          totalAmount = 0;
        }
        
        // CRITICAL FIX: Create clean production data for storage
        // Only keep essential fields and ensure no nested objects with __backendId
        const cleanProductionData = currentProductionData.map(quote => {
          // Parse items to clean them
          let cleanItems = [];
          try {
            const items = JSON.parse(quote.items || '[]');
            cleanItems = items.map(item => ({
              code: item.code || '',
              content: item.content || '',
              brand: item.brand || '',
              width: item.width || '',
              height: item.height || '',
              quantity: item.quantity || '',
              unit: item.unit || '',
              price: item.price || '',
              total: item.total || ''
            }));
          } catch (e) {
            console.warn('Error parsing items for quote:', quote.id);
            cleanItems = [];
          }
          
          // Return clean quote data without __backendId
          return {
            outlet_code: quote.outlet_code || '',
            outlet_name: quote.outlet_name || '',
            area: quote.area || '',
            sale_type: quote.sale_type || '',
            sale_name: quote.sale_name || '',
            sale_phone: quote.sale_phone || '',
            outlet_phone: quote.outlet_phone || '',
            address: quote.address || '',
            spo_number: quote.spo_number || '',
            spo_status: quote.spo_status || '',
            total_amount: parseMoney(quote.total_amount) || 0,
            // Preserve quote metadata; acceptance images must start empty on new production orders
            quote_code: quote.quote_code || quote.quoteCode || '',
            images: '[]',
            quote_key: (typeof getQuoteKey === 'function' ? getQuoteKey(quote) : (quote.__backendId || quote.id || '')),
            quote_id: quote.__backendId || quote.id || null,
            items: JSON.stringify(cleanItems)
          };
        });
        
        // Create production order data with all required schema fields
        const generatedOrderNo = generateOrderNumber();

        // Creator metadata (local auth)
        const authUser = (typeof window !== 'undefined' && window.__qcagAuthUser) ? window.__qcagAuthUser : null;
        const creatorUsername = authUser && authUser.username ? String(authUser.username).trim() : '';
        const creatorName = authUser && (authUser.name || authUser.full_name) ? String(authUser.name || authUser.full_name).trim() : creatorUsername;
        const productionOrderData = {
          id: `production_${timestamp}`,
          outlet_code: `PROD_${timestamp}`,
          outlet_name: `Đơn hàng sản xuất ${new Date().toLocaleDateString('vi-VN')}`,
          address: 'Chưa nhập đơn vị thi công', // Đơn vị thi công - sẽ được nhập sau
          phone: constructionPointsCount.toString(), // Số lượng điểm thi công
          sale_name: 'Đơn hàng sản xuất',
          area: 'PRODUCTION',
          items: JSON.stringify(cleanProductionData), // Store as JSON string
          // Add quick lookup keys and metadata for acceptance/gallery
          quote_keys: JSON.stringify(cleanProductionData.map(q => q.quote_key).filter(Boolean)),
          total_amount: totalAmount,
          created_at: new Date().toISOString(),
          spo_number: '', // Mặc định trống khi tạo đơn (không tự sinh số SPO)
          // spo_status: 'Đơn hàng sản xuất', // Removed to prevent spo_status change on order creation
          due_date: 'Chưa nhập hạn thi công', // Hạn thi công - sẽ được nhập sau

          // Người phụ trách
          created_by: creatorUsername,
          created_by_name: creatorName,
          responsibles: JSON.stringify(creatorUsername ? [creatorUsername] : [])
        };

        // Validate all required fields
  const requiredFields = ['id', 'outlet_code', 'outlet_name', 'address', 'phone', 'sale_name', 'area', 'items', 'total_amount', 'created_at', 'spo_number'];
        
        for (const field of requiredFields) {
          if (!(field in productionOrderData)) {
            throw new Error(`Missing required field: ${field}`);
          }
          
          const value = productionOrderData[field];
          
          // Check for null/undefined
          if (value === null || value === undefined) {
            throw new Error(`Field ${field} cannot be null or undefined`);
          }
          
          // Check data types - must be primitives only
          const valueType = typeof value;
          if (valueType === 'object') {
            throw new Error(`Field ${field} must be a primitive value, got object`);
          }
          
          // Validate numbers
          if (field === 'total_amount' && (typeof value !== 'number' || !isFinite(value) || isNaN(value))) {
            throw new Error(`Field ${field} must be a valid finite number`);
          }
          
          // Validate strings are not empty for critical fields
          if (['id', 'outlet_code', 'outlet_name', 'sale_name', 'area', 'items', 'created_at', 'spo_status'].includes(field)) {
            if (typeof value === 'string' && value.trim() === '') {
              throw new Error(`Field ${field} cannot be empty`);
            }
          }
        }

        // Final validation: ensure items is valid JSON
        try {
          const parsedItems = JSON.parse(productionOrderData.items);
          if (!Array.isArray(parsedItems)) {
            throw new Error('Items must be an array when parsed');
          }
        } catch (e) {
          throw new Error(`Invalid items JSON: ${e.message}`);
        }

        // Debug logging
        console.log('=== SAVING PRODUCTION ORDER ===');
        console.log('Construction points:', constructionPointsCount);
        console.log('Total amount:', totalAmount);
        console.log('Clean data length:', cleanProductionData.length);
        console.log('Final data keys:', Object.keys(productionOrderData));
        console.log('Items string length:', productionOrderData.items.length);

        // Save to database with graceful fallback when SDK is unavailable
        let result = { isOk: false };
        const canRemoteCreate = window.dataSdk && typeof window.dataSdk.create === 'function';
        if (canRemoteCreate) {
          result = await window.dataSdk.create(productionOrderData);
        } else {
          // Local fallback: insert into in-memory list with synthetic __backendId
          const localOrder = { ...productionOrderData, __backendId: productionOrderData.id };
          productionOrders.unshift(localOrder);
          renderProductionOrdersList(productionOrders);
          result.isOk = true;
        }
        
        if (result.isOk) {
          // determine created order number (remote may return a value)
          const createdOrder = (result && result.data) ? result.data : null;
          const finalOrderNumber = (createdOrder && createdOrder.spo_number) ? createdOrder.spo_number : productionOrderData.spo_number;

          // If remote create returned the created order, ensure it appears immediately in local list
          try {
          if (createdOrder) {
              const createdId = createdOrder.__backendId || createdOrder.id || createdOrder._id || createdOrder.id;
              const exists = productionOrders.some(o => String(o.__backendId || o.id || '') === String(createdId));
              if (!exists) {
                // Merge server response over the client-side productionOrderData so
                // any missing fields returned by the server are filled from the
                // locally constructed object (created_at, outlet_name, items, etc.).
                const base = Object.assign({}, productionOrderData || {});
                const merged = Object.assign({}, base, (createdOrder && typeof createdOrder === 'object') ? createdOrder : {});
                // Ensure __backendId is set to server id when available, otherwise keep local id
                merged.__backendId = createdOrder && (createdOrder.__backendId || createdOrder.id) ? (createdOrder.__backendId || createdOrder.id) : productionOrderData.id;
                // Guarantee items is a JSON string
                try { merged.items = typeof merged.items === 'string' ? merged.items : JSON.stringify(merged.items || []); } catch (e) { merged.items = productionOrderData.items; }
                // Ensure created_at exists
                if (!merged.created_at) merged.created_at = productionOrderData.created_at || new Date().toISOString();
                productionOrders.unshift(merged);
                renderProductionOrdersList(productionOrders);
              }
            }
          } catch (e) { /* ignore */ }

          // Mark all involved quotes as moved to production so they won't appear for selection again
          try {
            const canRemoteUpdate = window.dataSdk && typeof window.dataSdk.update === 'function';
            if (canRemoteUpdate) {
              for (const quote of currentProductionData) {
                // propagate order number and update QCAG status
                const updated = { ...quote, qcag_status: 'Đã ra đơn', order_number: finalOrderNumber };
                // ensure transient recreate flag removed
                if (updated.__recreateRequested) delete updated.__recreateRequested;
                // Best effort update; ignore individual failures
                await window.dataSdk.update(updated).catch(() => {});
              }
            } else {
              // Local fallback: update currentQuotes in-memory using stable key matcher
              const selKeys = new Set(currentProductionData.map(q => (typeof getQuoteKey === 'function' ? getQuoteKey(q) : (q.__backendId || q.id || q.spo_number || q.outlet_code))));
              currentQuotes = currentQuotes.map(q => {
                const key = (typeof getQuoteKey === 'function' ? getQuoteKey(q) : (q.__backendId || q.id || q.spo_number || q.outlet_code));
                if (selKeys.has(String(key))) {
                  const updated = { ...q, qcag_status: 'Đã ra đơn', order_number: finalOrderNumber };
                  if (updated.__recreateRequested) delete updated.__recreateRequested;
                  return updated;
                }
                return q;
              });
              // Refresh main list UI
              if (typeof updateMainList === 'function') updateMainList();
            }
          } catch (e) {
            console.warn('Warning: failed to update some quotes as produced', e);
          }

          showToast('✅ Đã lưu đơn hàng sản xuất thành công!');
          // Automatically load quotes into Xin Phép modal when production order is created
          try { 
            if (typeof window.renderXinphepList === 'function') {
              window.renderXinphepList(cleanProductionData || []); 
            }
          } catch(e) { 
            console.error('Failed to render xinphep list', e); 
          }
          closeProductionListModal();
          // Also refresh main list if not refreshed above
          if (typeof updateMainList === 'function') updateMainList();
          // If the production selection modal is open, refresh its visible list
          try {
            const productionModalEl = document.getElementById('production-order-modal');
            if (productionModalEl && !productionModalEl.classList.contains('hidden') && typeof renderProductionQuotes === 'function') {
              renderProductionQuotes(currentQuotes);
              if (typeof updateSelectedCount === 'function') updateSelectedCount();
              if (typeof updateSelectedSummary === 'function') updateSelectedSummary();
            }
          } catch (e) { console.warn('Failed to refresh production selection after save', e); }
          // Refresh QC Signage modal if it's open so new items appear immediately
          try { const qm = document.getElementById('qc-signage-modal'); if (qm && !qm.classList.contains('hidden') && typeof renderQcSignageModal === 'function') renderQcSignageModal(); } catch(e) {}

          // Refresh Acceptance modal if it's open so thumbnails & filters reflect the newly created order
          try {
            const accModal = document.getElementById('acceptance-image-modal');
            if (accModal && !accModal.classList.contains('hidden')) {
              try { if (typeof window.__renderAcceptanceProductionOrders === 'function') window.__renderAcceptanceProductionOrders(); } catch(e) {}
              // Reset acceptance-order selection so default grid shows all orders
              try { window.__filteredAcceptanceOrders = null; } catch(e) {}
              try { window.__acceptanceSelectedOrderId = null; } catch(e) {}
              try { renderAcceptanceImages(); } catch(e) {}
            }
          } catch (e) { console.warn('Failed to refresh acceptance modal after save', e); }

          // Clear current production data
          currentProductionData = [];
        } else {
          console.error('❌ Error saving production order:', result.error);
          const errorMsg = result.error?.message || result.error?.toString() || 'Lỗi không xác định';
          showToast(`❌ Lỗi khi lưu: ${errorMsg}`);
        }
      } catch (error) {
        console.error('❌ Exception saving production order:', error);
        showToast(`❌ Lỗi: ${error.message}`);
      } finally {
        // Restore button state
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }
    }

    // Renderer for Xin Phép Quảng Cáo list (generate rows from array of quote-like objects)
    window.renderXinphepList = function(quotesArray) {
      try {
        window.__lastXinphepList = Array.isArray(quotesArray) ? quotesArray : [];
        const tbody = document.getElementById('xinphep-list-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!Array.isArray(quotesArray) || quotesArray.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-gray-500">Không có Outlet trong đơn hàng</td></tr>';
          return;
        }
        const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]);
        let rowsAdded = 0;

        // active filters (window.__xinphepFilters) expected to be a Set of group keys: 'camau','cantho','angiang'
        const active = (window.__xinphepFilters && window.__xinphepFilters.size) ? Array.from(window.__xinphepFilters) : [];
        const camauCodes = new Set(['S5','S19']);
        const canthoCodes = new Set(['S4']);

        for (const q of quotesArray) {
          const areaRaw = (q.area || '').toString().trim();
          const area = areaRaw.toUpperCase();

          // If filters active, include only matching groups
          if (active.length > 0) {
            let include = false;
            for (const g of active) {
              if (g === 'camau' && camauCodes.has(area)) { include = true; break; }
              if (g === 'cantho' && canthoCodes.has(area)) { include = true; break; }
              if (g === 'angiang' && !camauCodes.has(area) && !canthoCodes.has(area)) { include = true; break; }
            }
            if (!include) continue;
          }

          let items = [];
          try { items = Array.isArray(q.items) ? q.items : JSON.parse(q.items || '[]'); } catch (_) { items = []; }
          // Prefer master quote data (latest) when available so edited fields reflect across modals
          let masterQ = null;
          try { masterQ = (typeof findQuoteByKey === 'function') ? findQuoteByKey(resolveQuoteKey(q) || q.quote_key || q.quote_code) : null; } catch (e) { masterQ = null; }
          const code = esc((masterQ && (masterQ.quote_code || masterQ.quoteCode)) || q.quote_code || q.quoteCode || '');
          const name = esc((masterQ && masterQ.outlet_name) || q.outlet_name || q.outletName || '');
          const areaDisp = esc((masterQ && masterQ.area) || q.area || '');
          const address = esc((masterQ && masterQ.address) || q.address || [q.house_number, q.street, q.ward, q.district, q.province].filter(Boolean).join(', '));
          // Group items by brand (only branded items considered) and collect sizes + positions
          const brandItems = new Map();
          for (const it of (Array.isArray(items) ? items : [])) {
            const b = (it && it.brand) ? String(it.brand).trim() : '';
            if (!b) continue; // only consider branded items
            const rawW = it && (it.width != null) ? String(it.width).trim().replace(/m$/i, '').trim() : '';
            const rawH = it && (it.height != null) ? String(it.height).trim().replace(/m$/i, '').trim() : '';
            const wNum = (rawW !== '') && !Number.isNaN(parseFloat(rawW)) ? parseFloat(rawW) : null;
            const hNum = (rawH !== '') && !Number.isNaN(parseFloat(rawH)) ? parseFloat(rawH) : null;
            let sizeStr = '';
            if (wNum != null && hNum != null) {
              sizeStr = `${rawW}m x ${rawH}m`;
            } else {
              sizeStr = (it && (it.content || it.code)) ? String(it.content || it.code).trim() : 'Không kích thước';
            }
            if (!brandItems.has(b)) brandItems.set(b, []);
            brandItems.get(b).push({ size: sizeStr, wNum, hNum });
          }
          if (brandItems.size > 0) {
            for (const [brand, entries] of brandItems.entries()) {
              const tr = document.createElement('tr');
              const sizesHtml = entries.map(e => esc(e.size)).join('<br>');
              const positionsHtml = entries.map(e => {
                if (e.wNum != null && e.hNum != null) {
                  if (e.wNum > e.hNum) return 'Mặt tiền quán';
                  if (e.wNum < e.hNum) return 'Áp sát trụ phi cách mép đường 15m';
                  return 'Không xác định';
                }
                return '-';
              }).join('<br>');
              tr.innerHTML = `\n                <td class="p-2 border-b">${code}</td>\n                <td class="p-2 border-b">${areaDisp}</td>\n                <td class="p-2 border-b">${esc(brand)}</td>\n                <td class="p-2 border-b">${name}</td>\n                <td class="p-2 border-b">${address}</td>\n                <td class="p-2 border-b">${sizesHtml}</td>\n                <td class="p-2 border-b">${positionsHtml}</td>\n              `;
              tbody.appendChild(tr);
              rowsAdded++;
            }
          }
        }
        if (rowsAdded === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-gray-500">Không có Outlet có hạng mục brand</td></tr>';
        }
      } catch (e) { console.error('renderXinphepList error', e); }
    };

    // Edit Production Order Number
    window.editProductionOrderNumber = function(backendId) {
      const order = productionOrders.find(o => o.__backendId === backendId);
      if (!order) return;

      const currentValue = (order.spo_number && order.spo_number !== 'Chưa nhập số đơn hàng') ? order.spo_number : '';

      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center';
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 w-96">
          <h3 class="text-lg font-semibold mb-4">Nhập Số Đơn Hàng</h3>
          <input type="text" id="production-order-number-input" value="${currentValue}" 
                 class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
                 placeholder="Nhập số đơn hàng...">
          <div class="flex justify-end space-x-3 mt-4">
            <button id="cancel-order-number" class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded">Hủy</button>
            <button id="save-order-number" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Lưu</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      document.getElementById('production-order-number-input').focus();

      document.getElementById('cancel-order-number').addEventListener('click', () => modal.remove());
      
      document.getElementById('save-order-number').addEventListener('click', async () => {
        const orderNumber = document.getElementById('production-order-number-input').value.trim();
        const updatedOrder = { ...order, spo_number: orderNumber || 'Chưa nhập số đơn hàng' };
        let ok = false;
        if (window.dataSdk && typeof window.dataSdk.update === 'function') {
          const result = await window.dataSdk.update(updatedOrder);
          ok = !!result?.isOk;
        } else {
          const idx = productionOrders.findIndex(o => o.__backendId === backendId);
          if (idx >= 0) {
            productionOrders[idx] = { ...productionOrders[idx], spo_number: updatedOrder.spo_number };
            ok = true;
          }
        }
        renderProductionOrdersList(productionOrders);
        window.__renderAcceptanceProductionOrders && window.__renderAcceptanceProductionOrders();
        showToast(ok ? 'Đã cập nhật số đơn hàng' : 'Lỗi khi cập nhật số đơn hàng');
        
        modal.remove();
      });
    };

    // Edit Construction Unit
    window.editConstructionUnit = function(backendId) {
      const order = productionOrders.find(o => o.__backendId === backendId);
      if (!order) return;

      const currentValue = (order.address && order.address !== 'Chưa nhập đơn vị thi công') ? order.address : '';

      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center';
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 w-96">
          <h3 class="text-lg font-semibold mb-4">Nhập Đơn Vị Thi Công</h3>
          <input type="text" id="construction-unit-input" value="${currentValue}" 
                 class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
                 placeholder="Nhập đơn vị thi công...">
          <div class="flex justify-end space-x-3 mt-4">
            <button id="cancel-construction-unit" class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded">Hủy</button>
            <button id="save-construction-unit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Lưu</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      document.getElementById('construction-unit-input').focus();

      document.getElementById('cancel-construction-unit').addEventListener('click', () => modal.remove());
      
      document.getElementById('save-construction-unit').addEventListener('click', async () => {
        const constructionUnit = document.getElementById('construction-unit-input').value.trim();
        const updatedOrder = { ...order, address: constructionUnit || 'Chưa nhập đơn vị thi công' };
        let ok = false;
        if (window.dataSdk && typeof window.dataSdk.update === 'function') {
          const result = await window.dataSdk.update(updatedOrder);
          ok = !!result?.isOk;
        } else {
          const idx = productionOrders.findIndex(o => o.__backendId === backendId);
          if (idx >= 0) {
            productionOrders[idx] = { ...productionOrders[idx], address: updatedOrder.address };
            ok = true;
          }
        }
        renderProductionOrdersList(productionOrders);
        window.__renderAcceptanceProductionOrders && window.__renderAcceptanceProductionOrders();
        showToast(ok ? 'Đã cập nhật đơn vị thi công' : 'Lỗi khi cập nhật đơn vị thi công');
        
        modal.remove();
      });
    };

    // Edit Construction Deadline (Hạn thi công)
    window.editConstructionDeadline = function(backendId) {
      const order = productionOrders.find(o => o.__backendId === backendId);
      if (!order) return;

      const currentValue = (order.due_date && order.due_date !== 'Chưa nhập hạn thi công') ? order.due_date : '';

      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center';
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 w-96">
          <h3 class="text-lg font-semibold mb-4">Nhập Hạn Thi Công</h3>
          <input type="date" id="construction-deadline-input" value="${currentValue}" 
                 class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
          <div class="flex justify-end space-x-3 mt-4">
            <button id="cancel-construction-deadline" class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded">Hủy</button>
            <button id="save-construction-deadline" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Lưu</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('construction-deadline-input').focus();

      document.getElementById('cancel-construction-deadline').addEventListener('click', () => modal.remove());

      document.getElementById('save-construction-deadline').addEventListener('click', async () => {
        const due = document.getElementById('construction-deadline-input').value.trim();
        const updatedOrder = { ...order, due_date: due || 'Chưa nhập hạn thi công' };

        let ok = false;
        if (window.dataSdk && typeof window.dataSdk.update === 'function') {
          const result = await window.dataSdk.update(updatedOrder);
          ok = !!result?.isOk;
        } else {
          // Fallback: update in-memory and refresh list
          const idx = productionOrders.findIndex(o => o.__backendId === backendId);
          if (idx >= 0) {
            productionOrders[idx] = { ...productionOrders[idx], due_date: updatedOrder.due_date };
            ok = true;
          }
        }
        renderProductionOrdersList(productionOrders);
        window.__renderAcceptanceProductionOrders && window.__renderAcceptanceProductionOrders();
        showToast(ok ? 'Đã cập nhật hạn thi công' : 'Lỗi khi cập nhật hạn thi công');
        modal.remove();
      });
    };

    // Toggle Production Order Details
    window.toggleProductionOrderDetails = function(backendId) {
      const detailsRow = document.getElementById(`production-details-${backendId}`);
      if (detailsRow.classList.contains('hidden')) {
        // Hide all other details first
        document.querySelectorAll('[id^="production-details-"]').forEach(row => {
          row.classList.add('hidden');
        });
        // Show this one
        detailsRow.classList.remove('hidden');
      } else {
        detailsRow.classList.add('hidden');
      }
    };

    // Delete Production Order
    window.deleteProductionOrder = async function(backendId) {
      const order = productionOrders.find(o => o.__backendId === backendId);
      if (!order) return;

      const confirmDiv = document.createElement('div');
      confirmDiv.className = 'fixed bottom-4 right-4 bg-white rounded-lg shadow-xl p-4 border-2 border-red-500 z-50';
      confirmDiv.innerHTML = `
        <p class="text-gray-800 mb-3">Xác nhận xóa đơn hàng sản xuất này?</p>
        <div class="flex space-x-2">
          <button id="confirm-delete-order" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded" title="Xóa"> <svg xmlns=\"http://www.w3.org/2000/svg\" class=\"w-4 h-4 inline-block\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6\"/></svg></button>
          <button id="cancel-delete-order" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded">Hủy</button>
        </div>
      `;
      document.body.appendChild(confirmDiv);

      document.getElementById('confirm-delete-order').addEventListener('click', async function() {
        this.disabled = true;
        this.innerHTML = '<div class="loading-spinner"></div>';
        
        let ok = false;
        if (window.dataSdk && typeof window.dataSdk.delete === 'function') {
          const result = await window.dataSdk.delete(order);
          ok = !!result?.isOk;
        } else {
          const idx = productionOrders.findIndex(o => o.__backendId === backendId);
          if (idx >= 0) {
            productionOrders.splice(idx, 1);
            ok = true;
          }
        }
        renderProductionOrdersList(productionOrders);
        showToast(ok ? 'Đã xóa đơn hàng sản xuất' : 'Lỗi khi xóa đơn hàng sản xuất');
        
        confirmDiv.remove();
      });

      document.getElementById('cancel-delete-order').addEventListener('click', function() {
        confirmDiv.remove();
      });
    };

    // Initialize SDKs
    async function initializeApp() {
      // Show a global loading overlay for initial boot until dataHandler receives data.
      try {
        if (!window.__qcInitialLoadToken && window.QcLoading && typeof window.QcLoading.show === 'function') {
          window.__qcInitialLoadToken = window.QcLoading.show('Đang tải dữ liệu...');
        }
      } catch (e) {}
      
      // Setup realtime listener for pending orders updates from other clients
      try {
        setupPendingOrdersRealtimeListener();
      } catch (e) {
        console.warn('Failed to setup pending orders realtime listener:', e);
      }
      
      // Load pending orders from backend (or fallback to localStorage)
      try {
        await loadPendingOrdersFromStorage();
      } catch (e) {
        console.warn('Failed to load pending orders from storage:', e);
      }
      
      const dataSdkResult = await window.dataSdk.init(dataHandler);
      if (!dataSdkResult.isOk) {
        console.error("Failed to initialize data SDK");
        // If init failed, stop the loading overlay to avoid blocking the UI forever.
        try {
          if (window.__qcInitialLoadToken && window.QcLoading && typeof window.QcLoading.hide === 'function') {
            window.QcLoading.hide(window.__qcInitialLoadToken);
            window.__qcInitialLoadToken = null;
          }
        } catch (e) {}
      }

      if (window.elementSdk) {
        window.elementSdk.init({
          defaultConfig,
          onConfigChange: async (config) => {
            const baseFont = config.font_family || defaultConfig.font_family;
            const baseFontStack = 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
            const baseSize = config.font_size || defaultConfig.font_size;
            
            document.body.style.fontFamily = `${baseFont}, ${baseFontStack}`;
            document.getElementById('app-title').textContent = config.app_title || defaultConfig.app_title;
            document.getElementById('app-title').style.fontSize = `${baseSize * 1.875}px`;
            document.getElementById('app-title').style.color = config.text_color || defaultConfig.text_color;
            
            const createBtn = document.getElementById('create-quote-btn');
            createBtn.textContent = config.button_text || defaultConfig.button_text;
            createBtn.style.backgroundColor = config.primary_color || defaultConfig.primary_color;
            createBtn.style.fontSize = `${baseSize}px`;
            
            document.querySelectorAll('label').forEach(label => {
              label.style.fontSize = `${baseSize * 0.875}px`;
              label.style.color = config.text_color || defaultConfig.text_color;
            });
            
            document.querySelectorAll('input, select').forEach(input => {
              input.style.fontSize = `${baseSize}px`;
            });
          },
          mapToCapabilities: (config) => ({
            recolorables: [
              {
                get: () => config.primary_color || defaultConfig.primary_color,
                set: (value) => {
                  config.primary_color = value;
                  window.elementSdk.setConfig({ primary_color: value });
                }
              },
              {
                get: () => config.secondary_color || defaultConfig.secondary_color,
                set: (value) => {
                  config.secondary_color = value;
                  window.elementSdk.setConfig({ secondary_color: value });
                }
              },
              {
                get: () => config.text_color || defaultConfig.text_color,
                set: (value) => {
                  config.text_color = value;
                  window.elementSdk.setConfig({ text_color: value });
                }
              },
              {
                get: () => config.accent_color || defaultConfig.accent_color,
                set: (value) => {
                  config.accent_color = value;
                  window.elementSdk.setConfig({ accent_color: value });
                }
              },
              {
                get: () => config.surface_color || defaultConfig.surface_color,
                set: (value) => {
                  config.surface_color = value;
                  window.elementSdk.setConfig({ surface_color: value });
                }
              }
            ],
            borderables: [],
            fontEditable: {
              get: () => config.font_family || defaultConfig.font_family,
              set: (value) => {
                config.font_family = value;
                window.elementSdk.setConfig({ font_family: value });
              }
            },
            fontSizeable: {
              get: () => config.font_size || defaultConfig.font_size,
              set: (value) => {
                config.font_size = value;
                window.elementSdk.setConfig({ font_size: value });
              }
            }
          }),
          mapToEditPanelValues: (config) => new Map([
            ["app_title", config.app_title || defaultConfig.app_title],
            ["button_text", config.button_text || defaultConfig.button_text]
          ])
        });
      }
    }

    // Excel Upload Handler
    document.getElementById('excel-upload').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          excelData = jsonData.slice(1).map(row => ({
            code: row[0] ? String(row[0]).trim() : '',
            content: row[1] ? String(row[1]).trim() : '',
            price: row[2] ? parseFloat(row[2]) : 0,
            unit: row[3] ? String(row[3]).trim() : ''
          })).filter(item => item.code && item.code !== '');
          excelLoadedFromFile = true;

          document.getElementById('excel-status').textContent = `Đã tải ${excelData.length} mục từ Excel`;
          document.getElementById('excel-status').classList.add('text-green-600');
          document.getElementById('load-data-btn').classList.remove('hidden');
        } catch (error) {
          document.getElementById('excel-status').textContent = 'Lỗi khi đọc file Excel';
          document.getElementById('excel-status').classList.add('text-red-600');
        }
      };
      reader.readAsArrayBuffer(file);
    });

    // Load Data Button
    document.getElementById('load-data-btn').addEventListener('click', function() {
      document.getElementById('create-quote-btn').disabled = false;
      document.getElementById('load-data-btn').classList.add('hidden');
      showToast('Dữ liệu đã được nạp thành công!');
    });

    function closeModal() {
      closeItemContentDropdown();
      document.getElementById('quote-modal').classList.add('hidden');
      ensureScrollLock();
    }

    function updateSaleTypeUI() {
      const toggle = document.getElementById('sale-type-toggle');
      const knob = document.getElementById('sale-type-knob');
      const display = document.getElementById('sale-type-display');
      const ssNameInput = document.getElementById('ss-name');
      const ssPill = document.getElementById('ss-pill');
      if (!toggle || !knob || !display || !ssNameInput) return;
      const current = window.saleType || 'Sale (SR)';
      if (current === 'TBA') {
        toggle.classList.remove('bg-gray-300');
        toggle.classList.add('bg-orange-400');
        knob.style.transform = 'translateX(24px)';
        display.textContent = 'TBA';
        display.className = 'text-xs font-semibold text-orange-600';
        ssNameInput.disabled = true;
        ssNameInput.value = '';
        if (ssPill) ssPill.classList.add('tba-mode');
      } else {
        toggle.classList.remove('bg-orange-400');
        toggle.classList.add('bg-blue-500');
        knob.style.transform = 'translateX(0px)';
        display.textContent = 'Sale (SR)';
        display.className = 'text-xs font-semibold text-blue-600';
        ssNameInput.disabled = false;
        if (ssPill) ssPill.classList.remove('tba-mode');
      }
    }


    // ==== BỔ SUNG: Khôi phục chức năng thêm hạng mục & ghép địa chỉ tự động ====
    let quoteModalHandlersInitialized = false;

    let activeItemContentWrapper = null;
    let dropdownViewportListenerBound = false;
    let dropdownScrollListenerBound = false;

    const handleDropdownViewportChange = () => {
      if (activeItemContentWrapper) {
        positionItemContentMenu(activeItemContentWrapper);
      }
    };

    function ensureDropdownEnvironment() {
      if (!dropdownViewportListenerBound) {
        window.addEventListener('resize', handleDropdownViewportChange);
        dropdownViewportListenerBound = true;
      }
      if (!dropdownScrollListenerBound) {
        const modalBody = document.querySelector('#quote-modal .modal-body');
        if (modalBody) {
          modalBody.addEventListener('scroll', () => {
            if (activeItemContentWrapper) {
              closeItemContentDropdown();
            }
          }, { passive: true });
          dropdownScrollListenerBound = true;
        }
      }
      const itemsScroll = document.querySelector('#quote-modal .items-scroll-container');
      if (itemsScroll && !itemsScroll.dataset.dropdownScrollBound) {
        itemsScroll.addEventListener('scroll', () => {
          if (activeItemContentWrapper) {
            closeItemContentDropdown();
          }
        }, { passive: true });
        itemsScroll.dataset.dropdownScrollBound = 'true';
      }
    }

    function positionItemContentMenu(wrapper) {
      if (!wrapper) return;
      const menu = wrapper.querySelector('.item-content-menu');
      const input = wrapper.querySelector('.item-content');
      if (!menu || !input || menu.classList.contains('hidden')) return;
      const rect = input.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const gap = 6;
      const computed = window.getComputedStyle(menu);
      const maxHeight = parseFloat(computed.maxHeight) || 220;
      const menuHeight = Math.min(menu.scrollHeight || maxHeight, maxHeight);
      const spaceBelow = viewportHeight - rect.bottom - gap;
      let openUpwards = false;
      if (spaceBelow < menuHeight && rect.top > menuHeight) {
        openUpwards = true;
      }
      const maxLeft = viewportWidth - rect.width - 8;
      const left = Math.max(8, Math.min(rect.left, maxLeft));
      menu.style.width = `${rect.width}px`;
      menu.style.left = `${left}px`;
      if (openUpwards) {
        const top = Math.max(8, rect.top - gap);
        menu.style.top = `${top}px`;
        menu.style.transform = 'translateY(-100%)';
      } else {
        const top = Math.max(8, rect.bottom + gap);
        menu.style.top = `${top}px`;
        menu.style.transform = 'translateY(0)';
      }
      menu.classList.toggle('open-up', openUpwards);
    }

    function populateItemContentMenu(menu, searchTerm = '') {
      if (!menu) return;
      const normalized = searchTerm.trim().toLowerCase();
      const matches = itemContentOptionValues.filter(option =>
        !normalized || option.toLowerCase().includes(normalized)
      );
      menu.innerHTML = '';
      if (!matches.length) {
        const emptyState = document.createElement('div');
        emptyState.className = 'px-3 py-2 text-sm text-gray-400';
        emptyState.textContent = 'Không có gợi ý phù hợp';
        menu.appendChild(emptyState);
        return;
      }
      matches.forEach(option => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'item-content-option';
        btn.dataset.value = option;
        btn.textContent = option;
        menu.appendChild(btn);
      });
    }

    function closeItemContentDropdown(wrapper = null) {
      const target = wrapper || activeItemContentWrapper;
      if (!target) return;
      const menu = target.querySelector('.item-content-menu');
      const input = target.querySelector('.item-content');
      if (menu) {
        menu.classList.add('hidden');
        menu.classList.remove('open-up');
        menu.style.left = '';
        menu.style.top = '';
        menu.style.width = '';
        menu.style.transform = '';
      }
      target.classList.remove('open');
      if (input) input.dataset.dropdownOpen = 'false';
      if (!wrapper || target === wrapper) {
        activeItemContentWrapper = null;
      }
    }

    function openItemContentDropdown(wrapper, resetValue = false) {
      if (!wrapper) return;
      ensureDropdownEnvironment();
      const menu = wrapper.querySelector('.item-content-menu');
      const input = wrapper.querySelector('.item-content');
      if (!menu || !input) return;
      if (resetValue) {
        input.value = '';
        input.dataset.dropdownSelected = 'false';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      populateItemContentMenu(menu);
      menu.classList.remove('hidden');
      wrapper.classList.add('open');
      input.dataset.dropdownOpen = 'true';
      positionItemContentMenu(wrapper);
      input.focus();
      activeItemContentWrapper = wrapper;
    }

    function enhanceItemContentField(wrapper) {
      if (!wrapper || wrapper.dataset.dropdownReady === 'true') return;
      const input = wrapper.querySelector('.item-content');
      const toggle = wrapper.querySelector('.item-content-toggle');
      const menu = wrapper.querySelector('.item-content-menu');
      if (!input || !toggle || !menu) return;
      wrapper.dataset.dropdownReady = 'true';

      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        const opening = menu.classList.contains('hidden');
        const shouldReset = input.dataset.dropdownSelected === 'true';
        if (opening) {
          closeItemContentDropdown();
          openItemContentDropdown(wrapper, shouldReset);
        } else {
          closeItemContentDropdown(wrapper);
        }
      });

      input.addEventListener('input', () => {
        const value = input.value.trim();
        input.dataset.dropdownSelected = 'false';
        if (input.dataset.dropdownOpen === 'true') {
          populateItemContentMenu(menu, value);
          positionItemContentMenu(wrapper);
        }
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && input.dataset.dropdownOpen === 'true') {
          event.preventDefault();
          closeItemContentDropdown(wrapper);
        }
      });

      menu.addEventListener('click', (event) => {
        const optionBtn = event.target.closest('.item-content-option');
        if (!optionBtn) return;
        const value = optionBtn.dataset.value || '';
        input.value = value;
        input.dataset.dropdownSelected = 'true';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        closeItemContentDropdown(wrapper);
      });
    }

    document.addEventListener('click', (event) => {
      if (!activeItemContentWrapper) return;
      if (!activeItemContentWrapper.contains(event.target)) {
        closeItemContentDropdown();
      }
    });

    function buildFullAddress() {
      const house = document.getElementById('house-number')?.value.trim() || '';
      const street = document.getElementById('street-name')?.value.trim() || '';
      const hamlet = document.getElementById('ward-hamlet')?.value.trim() || '';
      const commune = document.getElementById('commune-ward')?.value.trim() || '';
      const province = document.getElementById('province-city')?.value.trim() || '';

      let first = '';
      if (house && street) first = `${house} ${street}`; else first = house || street;
      const parts = [first, hamlet, commune, province].filter(p => p && p.length);
      const full = parts.join(', ');
      const fullEl = document.getElementById('full-address');
      if (fullEl) fullEl.textContent = full;
    }

    function attachAddressAutoBuild() {
      ['house-number','street-name','ward-hamlet','commune-ward','province-city'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', buildFullAddress);
      });
    }

    function addItemRow() {
      const container = document.getElementById('items-container');
      if (!container) return;
      itemCounter++;
      const itemDiv = document.createElement('div');
      itemDiv.className = 'border border-gray-300 rounded-lg p-3 bg-white shadow-sm';
      itemDiv.dataset.itemId = itemCounter;
      itemDiv.innerHTML = `
        <div class="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <div class="item-number w-8 text-center font-semibold">${itemCounter}</div>
          <input type="text" class="item-code w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Code">
          <div class="item-content-wrapper">
            <input type="text" class="item-content w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500" placeholder="Nội dung" autocomplete="off">
            <button type="button" class="item-content-toggle" title="Chọn nội dung có sẵn" aria-label="Chọn nội dung có sẵn">
              <svg xmlns="http://www.w3.org/2000/svg" class="icon-caret" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
              </svg>
              <svg xmlns="http://www.w3.org/2000/svg" class="icon-minus" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 12h12" />
              </svg>
            </button>
            <div class="item-content-menu hidden"></div>
          </div>
          <select class="item-brand w-32 px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100" disabled>
            ${defaultBrandSelectOptions}
          </select>
          <input type="number" step="any" class="item-width w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Ngang">
          <input type="number" step="any" class="item-height w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Cao">
          <input type="number" step="any" class="item-quantity w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="SL" required>
          <input type="text" class="item-unit w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="ĐVT">
          <input type="text" step="any" class="item-price w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Đơn giá">
          <input type="text" class="item-total w-32 px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100" placeholder="Thành tiền" readonly>
          <button type="button" class="remove-item-btn shrink-0 bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm" title="Xóa"><svg xmlns=\"http://www.w3.org/2000/svg\" class=\"w-4 h-4 inline-block\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6\"/></svg></button>
        </div>
      `;
      container.appendChild(itemDiv);
      setupItemListeners(itemDiv);
      // Update visible item numbers after adding
      updateItemNumbers();
      // Scroll the items container so the newly added row is visible (prioritize newest rows)
      setTimeout(() => {
        const scrollWrap = document.querySelector('.items-scroll-container');
        if (scrollWrap) {
          try {
            scrollWrap.scrollTo({ top: scrollWrap.scrollHeight, behavior: 'smooth' });
          } catch (e) {
            scrollWrap.scrollTop = scrollWrap.scrollHeight;
          }
        }
        try { itemDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
      }, 60);
      // Recompute locked height based on 4 rows
      computeAndLockItemsContainerHeight();
    }

    function updateItemNumbers() {
      const container = document.getElementById('items-container');
      if (!container) return;
      const rows = Array.from(container.querySelectorAll('[data-item-id]'));
      rows.forEach((row, idx) => {
        const numEl = row.querySelector('.item-number');
        if (numEl) numEl.textContent = String(idx + 1);
        row.dataset.itemId = idx + 1;
      });
      // keep global counter sensible
      itemCounter = Math.max(rows.length, itemCounter);
      // Update items count display in modal header
      try {
        const countEl = document.getElementById('items-count');
        if (countEl) countEl.textContent = String(rows.length);
      } catch (e) {}
    }

    function computeAndLockItemsContainerHeight() {
      try {
        const scrollWrap = document.querySelector('.items-scroll-container');
        if (!scrollWrap) return;
        const header = scrollWrap.querySelector('.items-header');
        const firstRow = scrollWrap.querySelector('[data-item-id]');
        const cs = window.getComputedStyle(scrollWrap);
        const paddingTop = parseFloat(cs.paddingTop || '0') || 0;
        const paddingBottom = parseFloat(cs.paddingBottom || '0') || 0;
        const headerH = header ? header.offsetHeight : 36;
        const rowH = firstRow ? firstRow.offsetHeight : 56; // fallback
        // Desired: header + 4 rows + paddings
        const desired = Math.round(headerH + (rowH * 4) + paddingTop + paddingBottom);
        scrollWrap.style.maxHeight = desired + 'px';
        scrollWrap.style.height = desired + 'px';
        // Ensure the add button sits right after the container without jumping
        const addBtnWrap = document.querySelector('#add-item-btn')?.parentElement;
        if (addBtnWrap) addBtnWrap.style.marginTop = '0.75rem';
      } catch (e) {
        // silent
      }
    }

    function resetQuoteForm() {
      try {
        document.getElementById('quote-form').reset();
      } catch (e) { /* ignore */ }
      currentEditingQuoteKey = null;
      maquetteUploadQuoteCode = null; // Clear maquette upload code
      // Pre-generate quote code for new quotes so maquette images use correct folder name
      try {
        newQuoteCodePreGenerated = generateQuoteCode();
      } catch (e) {
        newQuoteCodePreGenerated = null;
      }
      setQuoteModalMode('create');
      ['sale-code','sale-name','sale-phone','ss-name','outlet-code','outlet-name','spo-name','house-number','street-name','ward-hamlet','commune-ward','province-city'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      window.saleType = 'Sale (SR)';
      updateSaleTypeUI();
      const itemsContainer = document.getElementById('items-container');
      if (itemsContainer) itemsContainer.innerHTML = '';
      itemCounter = 0;
      addItemRow();
      updateTotal();
      buildFullAddress();
      updateRecentQuotesPreview();
      try { computeAndLockItemsContainerHeight(); } catch (e) {}
      // Reset images
      window.currentQuoteImages = [];
      const grid = document.getElementById('quote-images-grid');
      const empty = document.getElementById('quote-images-empty');
      const clearBtn = document.getElementById('clear-images-btn');
      const dropzone = document.getElementById('quote-image-stage');
      const mainImageWrap = document.getElementById('quote-image-main');
      const mainImage = document.getElementById('quote-main-image');
      if (grid) { grid.innerHTML = ''; grid.classList.add('hidden'); }
      if (empty) empty.classList.remove('hidden');
      if (clearBtn) clearBtn.classList.add('hidden');
      if (dropzone) dropzone.classList.remove('filled');
      if (mainImageWrap) mainImageWrap.classList.add('hidden');
      if (mainImage) {
        mainImage.removeAttribute('src');
        mainImage.removeAttribute('alt');
        mainImage.removeAttribute('data-src');
        mainImage.removeAttribute('data-name');
      }
    }

    function setupQuoteModalHandlersOnce() {
      if (quoteModalHandlersInitialized) return;
      const addBtn = document.getElementById('add-item-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => addItemRow());
      }
      const cancelBtn = document.getElementById('cancel-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          currentEditingQuoteKey = null;
          setQuoteModalMode('create');
          closeModal();
        });
      }
      const previewBtn = document.getElementById('preview-quote-btn');
      if (previewBtn) {
        previewBtn.addEventListener('click', openQuotePreviewModal);
      }
      const closePreviewBtn = document.getElementById('close-preview-modal');
      if (closePreviewBtn && !closePreviewBtn._bound) {
        closePreviewBtn._bound = true;
        closePreviewBtn.addEventListener('click', closeQuotePreviewModal);
      }
      const previewBackdrop = document.getElementById('quote-preview-modal');
      if (previewBackdrop && !previewBackdrop._bound) {
        previewBackdrop._bound = true;
        previewBackdrop.addEventListener('click', (event) => {
          if (event.target === previewBackdrop) {
            closeQuotePreviewModal();
          }
        });
      }
      // Sale type toggle switch
      const saleToggle = document.getElementById('sale-type-toggle');
      if (saleToggle) {
        window.saleType = 'Sale (SR)';
        saleToggle.addEventListener('click', () => {
          window.saleType = window.saleType === 'TBA' ? 'Sale (SR)' : 'TBA';
          updateSaleTypeUI();
        });
        updateSaleTypeUI();
      }

      // Sale code / sale name suggestion dropdown
      (function setupSaleSuggestions() {
        const saleCodeInput = document.getElementById('sale-code');
        const saleNameInput = document.getElementById('sale-name');
        const salePhoneInput = document.getElementById('sale-phone');
        const ssNameInput = document.getElementById('ss-name');
        if (!saleCodeInput || !saleNameInput) return;

        const normalizeText = (value) => {
          const raw = String(value || '').trim().toLowerCase();
          try {
            // remove Vietnamese diacritics for easier matching
            return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          } catch (e) {
            return raw;
          }
        };

        const buildSaleDirectory = () => {
          const mapByCode = new Map();
          const mapByName = new Map();
          (currentQuotes || []).forEach((q) => {
            if (!q) return;
            const code = String(q.sale_code || q.saleCode || '').trim();
            const name = String(q.sale_name || q.saleName || '').trim();
            const phone = String(q.sale_phone || q.salePhone || '').trim();
            if (!code && !name) return;
            const ts = (() => {
              const t = new Date(q.updated_at || q.created_at || 0).getTime();
              return Number.isFinite(t) ? t : 0;
            })();
            const entry = { code, name, phone, _ts: ts };

            if (code) {
              const prev = mapByCode.get(code);
              if (!prev || ts >= prev._ts) {
                mapByCode.set(code, entry);
              }
            }
            if (name) {
              const key = normalizeText(name);
              const prev = mapByName.get(key);
              if (!prev || ts >= prev._ts) {
                mapByName.set(key, entry);
              }
            }
          });
          const byCode = Array.from(mapByCode.values()).sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'vi'));
          const byName = Array.from(mapByName.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
          return { byCode, byName };
        };

        const buildSsDirectory = () => {
          const mapByName = new Map();
          (currentQuotes || []).forEach((q) => {
            if (!q) return;
            const name = String(q.ss_name || q.ssName || '').trim();
            if (!name) return;
            const ts = (() => {
              const t = new Date(q.updated_at || q.created_at || 0).getTime();
              return Number.isFinite(t) ? t : 0;
            })();
            const key = normalizeText(name);
            const prev = mapByName.get(key);
            if (!prev || ts >= prev._ts) {
              mapByName.set(key, { name, _ts: ts });
            }
          });
          return Array.from(mapByName.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
        };

        const ensureDropdown = () => {
          let el = document.getElementById('sale-suggest-dropdown');
          if (el) return el;
          el = document.createElement('div');
          el.id = 'sale-suggest-dropdown';
          el.className = 'hidden bg-white border border-gray-200 rounded-lg overflow-auto';
          el.style.position = 'fixed';
          el.style.zIndex = '99999';
          el.style.maxHeight = '240px';
          el.style.minWidth = '200px';
          document.body.appendChild(el);
          // prevent blur from immediately closing before click
          el.addEventListener('mousedown', (e) => {
            e.preventDefault();
          });
          return el;
        };

        const hideDropdown = () => {
          const dd = document.getElementById('sale-suggest-dropdown');
          if (!dd) return;
          dd.classList.add('hidden');
          dd.innerHTML = '';
          dd.dataset.for = '';
        };

        const renderDropdown = (inputEl, mode, matches) => {
          const dd = ensureDropdown();
          dd.dataset.for = mode;
          if (!matches.length) {
            hideDropdown();
            return;
          }
          const rect = inputEl.getBoundingClientRect();
          dd.style.left = Math.round(rect.left) + 'px';
          dd.style.top = Math.round(rect.bottom + 6) + 'px';
          dd.style.width = Math.round(rect.width) + 'px';

          dd.innerHTML = matches.map((m, idx) => {
            const code = String(m.code || '').trim();
            const name = String(m.name || '').trim();
            const ssName = String(m.name || '').trim();

            const line1 = mode === 'code'
              ? `<div class=\"font-semibold text-gray-800\">${code || '-'}</div>`
              : mode === 'name'
                ? `<div class=\"font-semibold text-gray-800\">${name || '-'}</div>`
                : `<div class=\"font-semibold text-gray-800\">${ssName || '-'}</div>`;

            const line2 = mode === 'code'
              ? `<div class=\"text-xs text-gray-500\">${name || ''}</div>`
              : mode === 'name'
                ? `<div class=\"text-xs text-gray-500\">${code ? `Mã: ${code}` : ''}</div>`
                : `<div class=\"text-xs text-gray-500\">SS</div>`;
            return `
              <button type="button" data-idx="${idx}" class="w-full text-left px-3 py-2 hover:bg-gray-50">
                ${line1}
                ${line2}
              </button>
            `;
          }).join('');

          dd.querySelectorAll('button[data-idx]').forEach((btn) => {
            btn.addEventListener('click', () => {
              const i = parseInt(btn.dataset.idx || '0', 10);
              const picked = matches[i];
              if (!picked) return;
              if (mode === 'ss') {
                if (ssNameInput && picked.name) ssNameInput.value = picked.name;
              } else {
                if (picked.code) saleCodeInput.value = picked.code;
                if (picked.name) saleNameInput.value = picked.name;
                if (salePhoneInput && picked.phone) salePhoneInput.value = picked.phone;
              }
              hideDropdown();
            });
          });
          dd.classList.remove('hidden');
        };

        const getMatches = (mode, query) => {
          const q = normalizeText(query);
          if (!q) return [];
          if (mode === 'ss') {
            const list = buildSsDirectory();
            return list
              .filter((m) => normalizeText(m && m.name).includes(q))
              .slice(0, 10);
          }
          const dir = buildSaleDirectory();
          const list = mode === 'code' ? dir.byCode : dir.byName;
          const field = mode === 'code' ? 'code' : 'name';
          return list
            .filter((m) => normalizeText(m && m[field]).includes(q))
            .slice(0, 10);
        };

        const showForInput = (mode, inputEl) => {
          const matches = getMatches(mode, inputEl.value);
          renderDropdown(inputEl, mode, matches);
        };

        const onDocMouseDown = (e) => {
          const dd = document.getElementById('sale-suggest-dropdown');
          if (!dd || dd.classList.contains('hidden')) return;
          if (e.target === dd || dd.contains(e.target)) return;
          if (e.target === saleCodeInput || e.target === saleNameInput || e.target === ssNameInput) return;
          hideDropdown();
        };

        if (!document._saleSuggestBound) {
          document._saleSuggestBound = true;
          document.addEventListener('mousedown', onDocMouseDown);
          // Don't close dropdown when user scrolls INSIDE the dropdown itself
          window.addEventListener('scroll', (ev) => {
            const dd = document.getElementById('sale-suggest-dropdown');
            if (!dd || dd.classList.contains('hidden')) return;
            const t = ev && ev.target ? ev.target : null;
            if (t && (t === dd || dd.contains(t))) return;
            hideDropdown();
          }, true);
          window.addEventListener('resize', () => hideDropdown());
        }

        const bindInput = (mode, inputEl) => {
          if (inputEl._saleSuggestBound) return;
          inputEl._saleSuggestBound = true;
          inputEl.addEventListener('input', () => showForInput(mode, inputEl));
          inputEl.addEventListener('focus', () => showForInput(mode, inputEl));
          inputEl.addEventListener('blur', () => setTimeout(() => hideDropdown(), 120));
          inputEl.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') {
              hideDropdown();
            }
          });
        };

        bindInput('code', saleCodeInput);
        bindInput('name', saleNameInput);
        if (ssNameInput) bindInput('ss', ssNameInput);
      })();

      // Image upload handlers
      const imgInput = document.getElementById('quote-images-input');
      const addImgBtn = document.getElementById('add-image-btn');
      const grid = document.getElementById('quote-images-grid');
      const empty = document.getElementById('quote-images-empty');
      const clearBtn = document.getElementById('clear-images-btn');
      const dropzone = document.getElementById('quote-image-stage');
      const mainImageWrap = document.getElementById('quote-image-main');
      const mainImage = document.getElementById('quote-main-image');
      let primaryImageIndex = 0;
      window.currentQuoteImages = window.currentQuoteImages || [];
      // Tracks whether images were added/updated during this edit/create session
      window.quoteImagesUpdatedDuringEdit = window.quoteImagesUpdatedDuringEdit || false;

      const setPrimaryImage = (idx = 0) => {
        if (!mainImageWrap || !mainImage) return;
        const image = window.currentQuoteImages[idx];
        if (!image) return;
        primaryImageIndex = idx;
        mainImageWrap.classList.remove('hidden');
        mainImage.src = image.data;
        mainImage.alt = image.name || `Hình ${idx + 1}`;
        mainImage.dataset.src = image.data;
        mainImage.dataset.name = image.name || '';
        if (dropzone) dropzone.classList.add('filled');
      };

      // Helper: process file list for quote images. If replace=true, replace all existing images.
      function processQuoteImageFiles(fileList, replace = false) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        // Maquette only allows 1 image - always replace
        const MAX_FILES = 1;
        const useFiles = files.slice(0, MAX_FILES);
        
        // Get old image URL to delete from bucket if exists
        const oldImageUrl = (window.currentQuoteImages && window.currentQuoteImages.length > 0) 
          ? window.currentQuoteImages[0].data 
          : null;
        
        // Always replace for maquette (only 1 image allowed)
        window.currentQuoteImages = [];
        
        // For new quotes: use pre-generated quote code for proper folder naming
        // For editing existing quotes: use currentEditingQuoteKey
        // IMPORTANT: Store the quote code used for upload to ensure consistency when saving
        let quoteKey = currentEditingQuoteKey || newQuoteCodePreGenerated || `temp_${Date.now()}`;
        
        // Save the quote code for later use when submitting the form
        if (!currentEditingQuoteKey) {
          maquetteUploadQuoteCode = quoteKey;
        }
        
        useFiles.forEach(file => {
          if (!file.type.startsWith('image/')) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev && ev.target ? ev.target.result : null;
            const entry = { name: 'maquette', data: dataUrl };
            window.currentQuoteImages.push(entry);
            // mark that images were updated this session
            window.quoteImagesUpdatedDuringEdit = true;
            refreshImageUI();

            // Delete old image from bucket before uploading new one
            if (oldImageUrl && oldImageUrl.startsWith('http') && typeof qcagDeleteImage === 'function') {
              qcagDeleteImage(oldImageUrl).catch(() => {});
            }

            // Upload to maquette/ folder in Cloud Storage with quoteKey for proper organization
            try {
              window.maquetteUploadInProgress = true;
              qcagUploadImageDataUrl(String(dataUrl || ''), entry.name, {
                folder: 'maquette',
                quoteKey: String(quoteKey)
              }).then((url) => {
                if (url) {
                  entry.data = url;
                  refreshImageUI();
                }
                window.maquetteUploadInProgress = false;
              }).catch(() => {
                window.maquetteUploadInProgress = false;
              });
            } catch (e) {
              window.maquetteUploadInProgress = false;
            }
          };
          reader.readAsDataURL(file);
        });
      }

      if (dropzone) {
        dropzone.addEventListener('click', () => {
          if (window.currentQuoteImages.length === 0) {
            if (addImgBtn) addImgBtn.click();
          } else if (mainImage && mainImage.dataset.src) {
            openImageViewer(mainImage.dataset.src, mainImage.dataset.name || 'Hình ảnh');
          }
        });
        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', (e) => {
          dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
          const files = e.dataTransfer ? e.dataTransfer.files : null;
          if (!files) return;
          // Replace existing images with newly dropped ones
          processQuoteImageFiles(files, true);
        });
      }

      if (mainImageWrap) {
        mainImageWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          const current = window.currentQuoteImages[primaryImageIndex];
          if (current) {
            openImageViewer(current.data, current.name || `Hình ${primaryImageIndex + 1}`);
          }
        });
      }

      function refreshImageUI() {
        if (!grid || !empty) return;
        if (window.currentQuoteImages.length === 0) {
          grid.classList.add('hidden');
          empty.classList.remove('hidden');
          if (clearBtn) clearBtn.classList.add('hidden');
          if (dropzone) dropzone.classList.remove('filled');
          if (mainImageWrap) mainImageWrap.classList.add('hidden');
          if (mainImage) {
            mainImage.removeAttribute('src');
            mainImage.removeAttribute('alt');
            delete mainImage.dataset.src;
            delete mainImage.dataset.name;
          }
          primaryImageIndex = 0;
          return;
        }
        empty.classList.add('hidden');
        if (clearBtn) clearBtn.classList.remove('hidden');
        if (primaryImageIndex >= window.currentQuoteImages.length) {
          primaryImageIndex = 0;
        }
        setPrimaryImage(primaryImageIndex);
        grid.innerHTML = window.currentQuoteImages.map((img, idx) => `
          <div class="quote-image-item ${idx === primaryImageIndex ? 'active' : ''}" data-idx="${idx}">
            <img src="${img.data}" alt="${img.name}" data-src="${img.data}" data-name="${img.name}">
            <button type="button" class="remove-image-btn" data-idx="${idx}" title="Xóa hình">×</button>
          </div>
        `).join('');
        grid.classList.remove('hidden');
        grid.querySelectorAll('.remove-image-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const i = parseInt(btn.dataset.idx, 10);
            if (Number.isNaN(i)) return;
            window.currentQuoteImages.splice(i,1);
            if (primaryImageIndex >= window.currentQuoteImages.length) {
              primaryImageIndex = 0;
            }
            // Update productionOrders (target the specific order if provided)
            const found = findQuoteInProductionOrders(acceptanceDetailState.quoteKey);
            if (found) {
              const { order, orderIndex, quoteIndex } = found;
              let quotes = [];
              try { quotes = JSON.parse(order.items || '[]'); } catch (e) { quotes = []; }
              if (Array.isArray(quotes) && quotes[quoteIndex]) {
                quotes[quoteIndex].images = JSON.stringify(window.currentQuoteImages);
                const updatedOrder = {...order, items: JSON.stringify(quotes) };
                productionOrders[orderIndex] = updatedOrder;
                // persist if available
                if (window.dataSdk && typeof window.dataSdk.update === 'function') {
                  try { window.dataSdk.update(updatedOrder); } catch (e) { console.warn('Không thể lưu xóa ảnh vào order:', e); }
                }
                window.__renderAcceptanceProductionOrders && window.__renderAcceptanceProductionOrders();
              }
            }
            refreshImageUI();
          });
        });
        grid.querySelectorAll('.quote-image-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(item.dataset.idx || '0', 10);
            if (Number.isNaN(idx)) return;
            primaryImageIndex = idx;
            refreshImageUI();
          });
        });
      }
      if (addImgBtn && imgInput) {
        addImgBtn.addEventListener('click', () => imgInput.click());
        imgInput.addEventListener('change', (e) => {
          const files = e.target.files || [];
          // When user chooses new images, replace existing ones
          processQuoteImageFiles(files, true);
          e.target.value = '';
        });
      }
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          window.currentQuoteImages = [];
          refreshImageUI();
        });
      }
      // Expose for edit-mode preload
      window.refreshQuoteImagesUI = refreshImageUI;
      refreshImageUI();
      attachAddressAutoBuild();

      // Duplicate outlet warning (quotes within last 1 year)
      const ensureOutletDuplicateWarningModal = () => {
        let modal = document.getElementById('outlet-duplicate-warning');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'outlet-duplicate-warning';
        modal.className = 'hidden';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.zIndex = '100000';
        modal.innerHTML = `
          <div class="w-full h-full flex items-center justify-center px-4" style="background: rgba(0,0,0,0.35)">
            <div class="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md">
              <div class="px-5 pt-5">
                <div class="text-base font-semibold text-gray-800">Outlet này đã có báo giá trong 1 năm</div>
                <div class="mt-2 text-sm text-gray-600">Nếu đây là báo giá hạng mục mới hãy bấm Ok để tạo tiếp tục.</div>
                <div id="outlet-duplicate-warning-meta" class="mt-3 text-xs text-gray-500"></div>
              </div>
              <div class="px-5 pb-5 pt-4 flex items-center justify-end gap-2">
                <button type="button" id="outlet-dup-old" class="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Báo giá cũ</button>
                <button type="button" id="outlet-dup-ok" class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Ok</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        // Add close X button
        try { ensureModalHasCloseX(modal); } catch (e) {}
        // Click outside closes
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.add('hidden');
            ensureScrollLock();
          }
        });
        return modal;
      };

      const findRecentQuoteForOutlet = (outletCode) => {
        const code = String(outletCode || '').trim();
        if (!code) return null;
        const cutoff = Date.now() - (365 * 24 * 60 * 60 * 1000);
        const norm = code.toLowerCase();
        const valid = (q) => {
          if (!q) return false;
          if (q.area === 'PRODUCTION') return false;
          if (q.sale_name === 'Đơn hàng sản xuất') return false;
          const oc = String(q.outlet_code || '').trim().toLowerCase();
          if (!oc || oc !== norm) return false;
          const ts = new Date(q.created_at || q.updated_at || 0).getTime();
          if (!Number.isFinite(ts) || ts <= 0) return false;
          return ts >= cutoff;
        };
        const matches = (currentQuotes || []).filter(valid);
        if (!matches.length) return null;
        matches.sort((a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0));
        return matches[0] || null;
      };

      const showOutletDuplicateWarning = (outletCode, foundQuote) => {
        const modal = ensureOutletDuplicateWarningModal();
        if (!modal) return;
        const meta = modal.querySelector('#outlet-duplicate-warning-meta');
        try {
          const code = foundQuote ? (formatQuoteCode(foundQuote) || foundQuote.spo_number || foundQuote.id || '') : '';
          const when = foundQuote && (foundQuote.created_at || foundQuote.updated_at)
            ? new Date(foundQuote.created_at || foundQuote.updated_at).toLocaleDateString('vi-VN')
            : '';
          const sale = foundQuote ? (foundQuote.sale_name || '') : '';
          if (meta) {
            meta.textContent = [code ? `Mã: ${code}` : '', when ? `Ngày: ${when}` : '', sale ? `Sale: ${sale}` : '']
              .filter(Boolean)
              .join(' • ');
          }
        } catch (e) {
          if (meta) meta.textContent = '';
        }

        const state = window._qcOutletDupWarnState = window._qcOutletDupWarnState || { lastShown: '', timer: null };
        state.lastShown = String(outletCode || '').trim().toLowerCase();

        const oldBtn = modal.querySelector('#outlet-dup-old');
        const okBtn = modal.querySelector('#outlet-dup-ok');
        if (oldBtn && !oldBtn._bound) {
          oldBtn._bound = true;
          oldBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            ensureScrollLock();
            if (!foundQuote) return;
            // suppress warning during programmatic populate
            window._suppressOutletDuplicateWarn = true;
            try {
              setupQuoteModalHandlersOnce();
              populateQuoteForm(foundQuote);
              document.getElementById('quote-modal')?.classList.remove('hidden');
              ensureScrollLock();
              const focusEl = document.getElementById('outlet-name');
              if (focusEl) setTimeout(() => focusEl.focus(), 50);
            } catch (e) {}
            setTimeout(() => { window._suppressOutletDuplicateWarn = false; }, 600);
          });
        }
        if (okBtn && !okBtn._bound) {
          okBtn._bound = true;
          okBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            ensureScrollLock();
          });
        }

        modal.classList.remove('hidden');
        ensureScrollLock();
      };

      const outletCodeInput = document.getElementById('outlet-code');
      if (outletCodeInput) outletCodeInput.addEventListener('input', () => {
        updateRecentQuotesPreview();
        // Only warn when creating a NEW quote
        if (window._suppressOutletDuplicateWarn) return;
        if (currentEditingQuoteKey) return;
        const code = outletCodeInput.value ? outletCodeInput.value.trim() : '';
        const state = window._qcOutletDupWarnState = window._qcOutletDupWarnState || { lastShown: '', timer: null };
        if (!code) {
          state.lastShown = '';
          if (state.timer) { clearTimeout(state.timer); state.timer = null; }
          const m = document.getElementById('outlet-duplicate-warning');
          if (m) m.classList.add('hidden');
          return;
        }
        const norm = code.toLowerCase();
        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(() => {
          state.timer = null;
          if (window._suppressOutletDuplicateWarn) return;
          if (currentEditingQuoteKey) return;
          if (norm === (state.lastShown || '')) return;
          const found = findRecentQuoteForOutlet(code);
          if (!found) return;
          showOutletDuplicateWarning(code, found);
        }, 250);
      });
      updateRecentQuotesPreview();
      quoteModalHandlersInitialized = true;
    }
    // ==== HẾT PHẦN BỔ SUNG ====

    function setupItemListeners(itemDiv) {
      const codeInput = itemDiv.querySelector('.item-code');
      const contentInput = itemDiv.querySelector('.item-content');
      const contentWrapper = itemDiv.querySelector('.item-content-wrapper');
      const priceInput = itemDiv.querySelector('.item-price');
      const unitInput = itemDiv.querySelector('.item-unit');
      const brandSelect = itemDiv.querySelector('.item-brand');
      const widthInput = itemDiv.querySelector('.item-width');
      const heightInput = itemDiv.querySelector('.item-height');
      const quantityInput = itemDiv.querySelector('.item-quantity');
      const totalInput = itemDiv.querySelector('.item-total');
      const removeBtn = itemDiv.querySelector('.remove-item-btn');

      enhanceItemContentField(contentWrapper);

      const brandableCodes = ['1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '9.2', '9.3', 'LG1', 'LG2'];

      const formatUnitDisplay = (unitValue = '') => {
        if (!unitValue) return '';
        return unitValue.toLowerCase() === 'm2' ? 'm²' : unitValue;
      };

      function handleCatalogSelection(label, preferredBrand = null) {
        if (!label) return false;
        const entries = getCatalogEntriesByName(label);
        if (!entries.length) return false;
        const isHiflex1Mat = normalizeContentLabel(label) === 'bảng hiệu hiflex 1 mặt';
        let brandToUse = null;
        if (!isHiflex1Mat) {
          brandToUse = applyBrandOptionsToSelect(brandSelect, entries, preferredBrand || brandSelect?.value || null);
        } else {
          // For 'Bảng hiệu hiflex 1 mặt', show placeholder, do not auto-select any brand
          applyBrandOptionsToSelect(brandSelect, entries, '');
        }
        const entry = pickCatalogEntry(entries, brandToUse || brandSelect?.value || null);
        if (!entry) return false;
        // Special-case for Logo items: Logo Indoor / Logo Outdoor
        const normalizedEntryName = normalizeContentLabel(entry.name || '');
        const isLogoEntry = normalizedEntryName.startsWith('logo');
        const isBrandableEntry = brandableCodes.includes(entry.code);
        const normalizedEntryBrand = normalizeBrandLabel(entry.brand || '').toLowerCase();
        if (normalizedEntryBrand === 'shopname') {
          resetBrandSelectElement(brandSelect, { lockedValue: 'Shopname' });
        } else if (isBrandableEntry) {
          const previousValue = brandSelect.value;
          resetBrandSelectElement(brandSelect, { keepEnabled: true });
          if (previousValue && !isHiflex1Mat) {
            brandSelect.value = previousValue;
          }
          // For 'Bảng hiệu hiflex 1 mặt', do not auto-select any brand (leave placeholder)
        } else {
          resetBrandSelectElement(brandSelect);
        }
        // Only auto-select brand if not 'Bảng hiệu hiflex 1 mặt'
        if (isBrandableEntry && normalizedEntryBrand !== 'shopname' && !isHiflex1Mat) {
          const resolvedBrandLabel = normalizeBrandLabel(brandToUse || entry.brand || '').trim();
          if (resolvedBrandLabel) {
            brandSelect.value = resolvedBrandLabel;
          }
        }
        contentInput.value = entry.name;
        // For Logo items do NOT auto-fill the Code
        if (!isLogoEntry) {
          codeInput.value = entry.code || '';
        } else {
          try { itemDiv.dataset.logoItem = '1'; } catch (e) {}
          codeInput.value = '';
        }
        unitInput.value = formatUnitDisplay(entry.unit || '');
        priceInput.value = entry.price || '';
        itemDiv.dataset.catalogNameKey = normalizeContentLabel(entry.name);
        if (isLogoEntry) {
          try {
            const forbidden = ['bivina', 'bivina export'];
            if (brandSelect) {
              Array.from(brandSelect.options || []).forEach(opt => {
                const v = normalizeBrandLabel(opt.value || '')?.toLowerCase() || '';
                if (forbidden.includes(v)) opt.disabled = true;
              });
              if (forbidden.includes(normalizeBrandLabel(brandSelect.value || '').toLowerCase())) {
                brandSelect.value = '';
              }
            }
            if (quantityInput) quantityInput.value = 1;
          } catch (e) {}
        } else {
          try { delete itemDiv.dataset.logoItem; } catch (e) {}
        }
        calculateItemTotal();
        return true;
      }

      resetBrandSelectElement(brandSelect);

      if (brandSelect) {
        brandSelect.addEventListener('change', () => {
          const isLogo = itemDiv && itemDiv.dataset && itemDiv.dataset.logoItem === '1';
          const selectedBrandNorm = normalizeBrandLabel(brandSelect.value || '').toLowerCase();
          const forbidden = ['bivina', 'bivina export'];
          if (isLogo && forbidden.includes(selectedBrandNorm)) {
            try { brandSelect.value = ''; } catch (e) {}
            return;
          }
          const key = itemDiv.dataset.catalogNameKey;
          if (!key) return;
          const entries = getCatalogEntriesByNameKey(key);
          if (!entries.length) return;
          const entry = pickCatalogEntry(entries, brandSelect.value);
          if (!entry) return;
          if (!isLogo) {
            codeInput.value = entry.code || '';
          } else {
            try { codeInput.value = ''; } catch (e) {}
          }
          unitInput.value = entry.unit || '';
          priceInput.value = entry.price || '';
          calculateItemTotal();
        });
      }

      contentInput.addEventListener('change', () => {
        const value = contentInput.value.trim();
        if (!value) {
          delete itemDiv.dataset.catalogNameKey;
          resetBrandSelectElement(brandSelect, { keepEnabled: true });
          return;
        }
        // Preserve existing brand choice: do not auto-fill Brand when selecting content
        const prevBrand = brandSelect ? brandSelect.value : '';
        const filled = handleCatalogSelection(value, brandSelect?.value || null);
        if (!filled) {
          delete itemDiv.dataset.catalogNameKey;
          resetBrandSelectElement(brandSelect, { keepEnabled: true });
        } else {
          try {
            if (brandSelect) {
              if (prevBrand) brandSelect.value = prevBrand;
              else resetBrandSelectElement(brandSelect, { keepEnabled: true });
            }
          } catch (e) { /* ignore */ }
        }
      });

      codeInput.addEventListener('input', function() {
        const code = this.value.trim();
        if (!code) {
          contentInput.value = '';
          priceInput.value = '';
          unitInput.value = '';
          delete itemDiv.dataset.catalogNameKey;
          resetBrandSelectElement(brandSelect, { keepEnabled: true });
          this.style.borderColor = '#d1d5db';
          this.style.backgroundColor = '#ffffff';
          calculateItemTotal();
          return;
        }

        const excelItem = excelData.find(item => String(item.code).trim() === code);
        let filledByCatalog = false;

        if (!excelLoadedFromFile) {
          const byCodeEntries = getCatalogEntriesByCode(code);
          if (byCodeEntries.length) {
            const preferredBrand = (code === '1.3' || code === '1.4') ? 'Shopname' : brandSelect?.value || null;
            filledByCatalog = handleCatalogSelection(byCodeEntries[0].name, preferredBrand);
          }
        }

        if (!filledByCatalog && excelItem) {
          contentInput.value = excelItem.content;
          priceInput.value = excelItem.price;
          unitInput.value = formatUnitDisplay(excelItem.unit);
          delete itemDiv.dataset.catalogNameKey;
          if (brandableCodes.includes(code)) {
            if (code === '1.3' || code === '1.4') {
              resetBrandSelectElement(brandSelect, { lockedValue: 'Shopname' });
            } else {
              resetBrandSelectElement(brandSelect, { keepEnabled: true });
            }
          } else {
            resetBrandSelectElement(brandSelect);
          }
        }

        if (!filledByCatalog && !excelItem) {
          contentInput.value = '';
          priceInput.value = '';
          unitInput.value = '';
          delete itemDiv.dataset.catalogNameKey;
          resetBrandSelectElement(brandSelect, { keepEnabled: true });
        }

        const hasMatch = filledByCatalog || !!excelItem;
        this.style.borderColor = hasMatch ? '#10b981' : '#d1d5db';
        this.style.backgroundColor = hasMatch ? '#f0fdf4' : '#ffffff';
        calculateItemTotal();
      });

      // Auto-calculate quantity from width x height
      // helper: round and trim trailing zeros
      function formatDecimal(value, decimals) {
        decimals = typeof decimals === 'number' ? decimals : 2;
        if (!Number.isFinite(value)) return '0';
        var pow = Math.pow(10, decimals);
        var fixed = (Math.round(value * pow) / pow).toFixed(decimals);
        return fixed.replace(/\.0+$|(?<=\.[0-9]*?)0+$/,'').replace(/\.$/, '');
      }
      // Format a number as a VND currency string with no decimals (integer VND)
      function formatCurrencyExact(value) {
        var num = Number(value) || 0;
        var rounded = Math.round(num + Number.EPSILON);
        return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rounded) + ' đ';
      }
      function countInputDecimals(str) {
        if (str == null) return 0;
        var s = String(str);
        var idx = s.indexOf('.');
        if (idx === -1) return 0;
        return s.length - idx - 1;
      }
      function updateQuantity() {
        const width = parseFloat(widthInput.value) || 0;
        const height = parseFloat(heightInput.value) || 0;
        // If this row is a Logo item and brand is not Larue, do not auto-calculate quantity
        const isLogo = itemDiv && itemDiv.dataset && itemDiv.dataset.logoItem === '1';
        const brandName = normalizeBrandLabel(brandSelect ? brandSelect.value : '') || '';
        if (isLogo && String(brandName).toLowerCase() !== 'larue') {
          return;
        }
        if (width > 0 && height > 0) {
          var wDec = countInputDecimals(widthInput.value);
          var hDec = countInputDecimals(heightInput.value);
          var decimals = Math.min(wDec + hDec, 6);
          quantityInput.value = formatDecimal(width * height, decimals);
          calculateItemTotal();
          
          // auto-add feature removed per request
        }
      }

      // checkAndAddCode917 removed — auto-add behaviour disabled

      widthInput.addEventListener('input', updateQuantity);
      heightInput.addEventListener('input', updateQuantity);
      quantityInput.addEventListener('input', calculateItemTotal);
      priceInput.addEventListener('input', () => { formatNumericInput(priceInput); calculateItemTotal(); });

      function calculateItemTotal() {
        const quantity = parseFloat(quantityInput.value) || 0;
        const price = parseNumber(priceInput.value) || 0;
        const total = quantity * price;
        totalInput.value = formatCurrencyExact(total);
        updateTotal();
      }

      removeBtn.addEventListener('click', function() {
        if (activeItemContentWrapper && itemDiv.contains(activeItemContentWrapper)) {
          closeItemContentDropdown();
        }
        itemDiv.remove();
        updateTotal();
        updateItemNumbers();
      });
    }

    // addAutoCode removed — auto-add behaviour disabled

    function updateTotal() {
      const container = document.getElementById('items-container');
      const items = container.querySelectorAll('[data-item-id]');
      let total = 0;

      items.forEach(item => {
        var quantity = parseFloat(item.querySelector('.item-quantity').value) || 0;
        var price = parseNumber(item.querySelector('.item-price').value) || 0;
        // round each line total to nearest integer VND to avoid fractional đồng
        var line = Math.round(quantity * price + Number.EPSILON);
        total += line;
      });

      // final rounding to integer VND
      total = Math.round(total + Number.EPSILON);
      document.getElementById('total-amount').textContent = formatCurrencyExact(total);
    }

    function formatRecentQuoteRow(quote) {
      if (!quote) {
        return `<div class="flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-400 italic">
          Chưa có báo giá của outlet này
        </div>`;
      }
      const date = quote.created_at ? new Date(quote.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '---';
      const amount = formatCurrency(Number(quote.total_amount) || 0);
      const code = quote.spo_number || quote.id || '---';
      const sale = quote.sale_name || '---';
      return `
        <div class="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-gray-800">${code}</span>
            <span class="text-xs text-gray-500">${sale}</span>
          </div>
          <div class="text-right">
            <div class="text-sm font-semibold text-blue-600">${amount}</div>
            <div class="text-xs text-gray-500">${date}</div>
          </div>
        </div>`;
    }

    function updateRecentQuotesPreview() {
      const target = document.getElementById('recent-quotes');
      const outletCode = document.getElementById('outlet-code')?.value.trim();
      if (!target) return;
      if (!outletCode) {
        target.innerHTML = '<div class="text-sm text-gray-400 italic">Nhập Outlet Code để xem lịch sử báo giá.</div>';
        return;
      }

      const filtered = currentQuotes
        .filter(q => (q.outlet_code || '').trim().toLowerCase() === outletCode.toLowerCase())
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 3);

      const rows = [0,1,2].map(idx => formatRecentQuoteRow(filtered[idx] || null));
      target.innerHTML = rows.join('');
    }

    function formatCurrency(amount) {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }
    function parseNumber(value) {
      if (value == null) return 0;
      const num = parseFloat(String(value).replace(/[^\d.-]/g, ''));
      return Number.isFinite(num) ? num : 0;
    }

    // Robust money parser: handles thousand separators ('.' or ',') and decimal separators
    function parseMoney(value) {
      if (value == null) return 0;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      let s = String(value || '').trim();
      if (!s) return 0;
      s = s.replace(/[^0-9.,\-]/g, '');
      if (!s) return 0;
      const commaCount = (s.match(/,/g) || []).length;
      const dotCount = (s.match(/\./g) || []).length;
      if (dotCount > 0 && commaCount > 0) {
        const tmp = s.replace(/\./g, '').replace(/,/g, '.');
        const n = parseFloat(tmp);
        return Number.isFinite(n) ? n : 0;
      }
      if (commaCount > 0 && dotCount === 0) {
        // Heuristic: if single comma and the group after comma has exactly 3 digits,
        // treat comma as thousands separator (e.g., 852,000 -> 852000). Otherwise
        // treat comma as decimal separator (e.g., 852,5 -> 852.5).
        if (commaCount > 1) return parseFloat(s.replace(/,/g, '')) || 0;
        const parts = s.split(',');
        const last = parts[parts.length - 1] || '';
        if (last.length === 3) {
          return parseFloat(s.replace(/,/g, '')) || 0;
        }
        return parseFloat(s.replace(/,/g, '.')) || 0;
      }
      if (dotCount > 0 && commaCount === 0) {
        if (dotCount > 1) return parseFloat(s.replace(/\./g, '')) || 0;
        return parseFloat(s) || 0;
      }
      return parseFloat(s.replace(/[^0-9\-]/g, '')) || 0;
    }

    function formatNumericInput(el) {
      if (!el) return;
      const raw = String(el.value || '');
      const caret = typeof el.selectionStart === 'number' ? el.selectionStart : raw.length;
      const digitsBefore = (raw.slice(0, caret).match(/\d/g) || []).length;
      const normalized = raw.replace(/[^\d.]/g, '');
      const parts = normalized.split('.');
      const intPart = parts.shift() || '';
      const decPart = parts.join('');
      const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const formatted = decPart ? (intFormatted + '.' + decPart) : intFormatted;
      el.value = formatted;
      let pos = 0, digitsSeen = 0;
      for (; pos < formatted.length; pos++) {
        if (/\d/.test(formatted[pos])) digitsSeen++;
        if (digitsSeen >= digitsBefore) { pos++; break; }
      }
      if (pos > formatted.length) pos = formatted.length;
      try { el.setSelectionRange(pos, pos); } catch (e) {}
    }

    function collectPreviewItems() {
      const container = document.getElementById('items-container');
      if (!container) return [];
      const rows = Array.from(container.querySelectorAll('[data-item-id]'));
      return rows.map((row, idx) => {
        const pick = (selector) => {
          const el = row.querySelector(selector);
          return el ? el.value : '';
        };
        return {
          idx: idx + 1,
          code: pick('.item-code'),
          content: pick('.item-content'),
          brand: pick('.item-brand'),
          width: pick('.item-width'),
          height: pick('.item-height'),
          quantity: pick('.item-quantity'),
          unit: pick('.item-unit'),
          price: pick('.item-price')
        };
      }).filter(item => item.code || item.content || item.quantity || item.price);
    }

    function buildQuotePreviewData() {
      const isEditing = !!currentEditingQuoteKey;
      const existingQuote = isEditing ? findQuoteByKey(currentEditingQuoteKey) : null;
      const items = collectPreviewItems();
      const images = Array.isArray(window.currentQuoteImages) ? window.currentQuoteImages : [];
      const totalAmount = items.reduce((sum, item) => {
        const qty = parseNumber(item.quantity);
        const price = parseNumber(item.price);
        return sum + Math.round(qty * price + Number.EPSILON);
      }, 0);
      const previewQuoteCode = existingQuote
        ? formatQuoteCode(existingQuote)
        : 'Sẽ cấp sau khi lưu';

      return {
        quoteCode: previewQuoteCode,
        outletCode: document.getElementById('outlet-code')?.value || '',
        outletName: document.getElementById('outlet-name')?.value || '',
        area: document.getElementById('area')?.value || '',
        outletPhone: document.getElementById('outlet-phone')?.value.trim() || '',
        saleName: document.getElementById('sale-name')?.value || '',
        saleCode: document.getElementById('sale-code')?.value || '',
        salePhone: document.getElementById('sale-phone')?.value || '',
        saleType: window.saleType || 'Sale (SR)',
        ssName: document.getElementById('ss-name')?.value || '',
        address: document.getElementById('full-address')?.textContent || '',
        spoName: document.getElementById('spo-name')?.value || '',
        totalAmount,
        items,
        primaryImage: images[0] || null,
        brandFooter: 'Quảng cáo An Giang báo giá',
        brandApproval: 'Heineken Việt Nam duyệt',
        createdAt: existingQuote?.created_at || null,
        updatedAt: existingQuote?.updated_at || null
      };
    }

    function buildQuotePreviewHtml(data, options = {}) {
      const includeQcagSign = options && typeof options === 'object' ? (options.includeQcagSign !== false) : true;
      const formatDateTime = (isoString) => {
        try {
          const date = new Date(isoString);
          if (Number.isNaN(date.getTime())) return '---';
          return date.toLocaleString('vi-VN', {
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (_) {
          return '---';
        }
      };

      const hasQuoteCode = data.quoteCode && !['Sẽ cấp sau khi lưu', '---'].includes(data.quoteCode);
      const quoteCodeLine = hasQuoteCode
        ? `Mã báo giá: ${data.quoteCode}`
        : '<em>Mã Báo Giá: Chưa có Mã</em>';

      const createdLabel = data.createdAt ? formatDateTime(data.createdAt) : 'Chưa lưu';
      const updatedIsDifferent = (() => {
        if (!data.updatedAt) return false;
        if (!data.createdAt) return true;
        const created = new Date(data.createdAt);
        const updated = new Date(data.updatedAt);
        if (Number.isNaN(created.getTime()) || Number.isNaN(updated.getTime())) return false;
        return Math.abs(updated.getTime() - created.getTime()) > 2000;
      })();
      const updatedLabel = data.updatedAt && updatedIsDifferent
        ? formatDateTime(data.updatedAt)
        : 'Chưa có cập nhật mới';

      const imageSection = data.primaryImage
        ? `<img src="${data.primaryImage.data}" alt="${data.primaryImage.name || 'Hình báo giá'}">`
        : `<div class="quote-preview-image-placeholder">Non Image</div>`;

      const itemRows = data.items.length ? data.items.map(item => {
        const lineTotal = formatCurrency(Math.round(parseNumber(item.quantity) * parseNumber(item.price) + Number.EPSILON));
        return `
          <div class="quote-preview-row">
            <span class="col code">${item.code || ''}</span>
            <span class="col content">${item.content || ''}</span>
            <span class="col brand">${item.brand || ''}</span>
            <span class="col width">${item.width || '-'}</span>
            <span class="col height">${item.height || '-'}</span>
            <span class="col qty">${item.quantity || '-'}</span>
            <span class="col unit">${item.unit || '-'}</span>
            <span class="col price">${formatCurrency(parseNumber(item.price))}</span>
            <span class="col total">${lineTotal}</span>
          </div>
        `;
      }).join('') : `<div class="quote-preview-row empty">Chưa có hạng mục nào</div>`;

      const infoBlank = '<div class="quote-preview-card quote-preview-blank"></div>';

      const html = `
        <div class="quote-preview-page">
          <div class="quote-preview-left">
            <div class="quote-preview-header">
              <div class="quote-preview-title-block">
                <div class="quote-preview-hvn-logo-wrap">
                  <img src="assets/hvn-logo.svg" class="quote-preview-hvn-logo" alt="HVN logo" />
                </div>
                <div class="quote-preview-title">Báo giá bảng hiệu</div>
                <div class="quote-preview-meta-row">
                  <span>Mã Outlet: ${data.outletCode || '---'}</span>
                  <span>Outlet: ${data.outletName || '---'}</span>
                  <span>Khu vực: ${data.area || '---'}</span>
                </div>
                <div class="quote-preview-meta-row address-row">
                  <span>Địa chỉ: ${data.address || 'Chưa có địa chỉ'} • SĐT: ${data.outletPhone || '---'}</span>
                  ${data.spoName ? `<span class="spo-name"><strong>Tên Outlet trên SPO: ${data.spoName}</strong></span>` : ''}
                </div>
              </div>
              <div class="quote-preview-code-block">
                <div class="quote-preview-code">${quoteCodeLine}</div>
                <div class="quote-preview-dates">
                  <div class="quote-preview-date-row">Ngày tạo: ${createdLabel}</div>
                  <div class="quote-preview-date-row">Cập nhật gần nhất: ${updatedLabel}</div>
                </div>
              </div>
            </div>
            <div class="quote-preview-image-frame">${imageSection}</div>
            <div class="quote-preview-items">
              <div class="quote-preview-items-title">Chi tiết báo giá</div>
              <div class="quote-preview-head">
                <span class="col code">Code</span>
                <span class="col content">Nội dung</span>
                <span class="col brand">Brand</span>
                <span class="col width">Ngang</span>
                <span class="col height">Cao</span>
                <span class="col qty">SL</span>
                <span class="col unit">ĐVT</span>
                <span class="col price">Đơn giá</span>
                <span class="col total">Thành tiền</span>
              </div>
              <div class="quote-preview-line-items">
                ${itemRows}
                <div class="quote-preview-total">Tổng cộng: ${formatCurrency(data.totalAmount)}</div>
              </div>
            </div>
          </div>
          <div class="quote-preview-right">
            <div class="quote-preview-card logo">
              <img class="quote-preview-logo-img" src="assets/qcag-logo.svg" alt="QCAG" />
            </div>
            <div class="quote-preview-card">
              <div class="quote-preview-card-title">Thông tin Sale</div>
              <div class="quote-preview-card-row"><span>Loại</span><span>${data.saleType || '---'}</span></div>
              <div class="quote-preview-card-row"><span>Mã</span><span>${data.saleCode || '---'}</span></div>
              <div class="quote-preview-card-row"><span>Tên</span><span>${data.saleName || '---'}</span></div>
              <div class="quote-preview-card-row"><span>SĐT</span><span>${data.salePhone || '---'}</span></div>
              <div class="quote-preview-card-row"><span>Tên SS</span><span>${data.ssName || '---'}</span></div>
            </div>
            <div class="quote-preview-sign">
              <span class="quote-preview-tag">${data.brandFooter}</span>
              <div class="quote-preview-sign-box">
                ${includeQcagSign ? '<img class="qcag-sign-img" src="assets/qcag-1.0.png" alt="QCAG" />' : ''}
              </div>
            </div>
            <div class="quote-preview-sign">
              <span class="quote-preview-tag">${data.brandApproval}</span>
              <div class="quote-preview-sign-box"></div>
            </div>
          </div>
        </div>
      `;
  return html;
}

function renderQuotePreviewPage(data) {
  const container = document.getElementById('quote-preview-content');
  // Requirement: Preview must NOT show QCAG signature image
  if (container) container.innerHTML = buildQuotePreviewHtml(data, { includeQcagSign: false });
    }

    function buildQuotePreviewDataFromQuote(quote) {
      if (!quote) return null;
      const parseItems = () => {
        try {
          const arr = JSON.parse(quote.items || '[]');
          return Array.isArray(arr) ? arr : [];
        } catch (_) {
          return [];
        }
      };
      const parsedItems = parseItems();
      const images = (() => {
        try {
          const arr = JSON.parse(quote.images || '[]');
          if (!Array.isArray(arr)) return [];
          // Normalize image objects: ensure `.data` contains the usable URL/data (fallback to url/src)
          return arr.map(img => {
            try {
              if (!img || typeof img !== 'object') return img;
              const normalized = { ...img };
              if (!normalized.data) normalized.data = normalized.url || normalized.src || '';
              return normalized;
            } catch (e) { return img; }
          });
        } catch (_) {
          return [];
        }
      })();
      const totalAmount = quote.total_amount || parsedItems.reduce((sum, item) => {
        const qty = parseNumber(item.quantity);
        const price = parseNumber(item.price);
        return sum + Math.round(qty * price + Number.EPSILON);
      }, 0);

      return {
        quoteCode: formatQuoteCode(quote) || '---',
        outletCode: quote.outlet_code || '',
        outletName: quote.outlet_name || '',
        area: quote.area || '',
        outletPhone: quote.outlet_phone || '',
        saleName: quote.sale_name || '',
        saleCode: quote.sale_code || '',
        salePhone: quote.sale_phone || '',
        saleType: quote.sale_type || 'Sale (SR)',
        ssName: quote.ss_name || '',
        address: quote.address || '',
        spoName: quote.spo_name || quote.spoName || '',
        totalAmount,
        items: parsedItems,
        primaryImage: images[0] || null,
        brandFooter: 'Quảng cáo An Giang báo giá',
        brandApproval: 'Heineken Việt Nam duyệt',
        createdAt: quote.created_at || null,
        updatedAt: quote.updated_at || null
      };
    }

    function openQuotePreviewForQuote(quote) {
      const data = buildQuotePreviewDataFromQuote(quote);
      if (!data) {
        showToast('Không tìm thấy dữ liệu báo giá để xem trước');
        return;
      }
      renderQuotePreviewPage(data);
      const modal = document.getElementById('quote-preview-modal');
      if (modal) {
        modal.classList.remove('hidden');
        try { modal.style.zIndex = '99999'; } catch (e) {}
        ensureScrollLock();
      }
    }

