        // ===== Manage Order Details Modal Logic =====
        const MOD_PAGE_SIZE = 6; // items per page (tune for A4 look)
        function openManageOrderDetailsModal(backendId) {
          const modal = document.getElementById('manage-order-details-modal');
          if (!modal) return;
          const order = productionOrders.find(o => String(o.__backendId) === String(backendId));
          modal.classList.remove('hidden');
          // mark which order is currently open so data updates can re-resolve quotes
          try { modal.dataset.openOrderId = String(backendId); } catch (e) {}
          ensureScrollLock();
          if (!order) {
            document.getElementById('manage-order-details-title').textContent = 'Chi tiết đơn hàng sản xuất';
            document.getElementById('manage-order-details-subtitle').textContent = '';
            document.getElementById('manage-order-pages').innerHTML = '<div class="text-sm text-gray-500">Không tìm thấy đơn hàng.</div>';
            return;
          }
          const title = `Đơn hàng: ${order.spo_number || 'Chưa có số đơn hàng'}`;
          const subtitle = `Đơn vị thi công: ${(order.address && order.address !== 'Chưa nhập đơn vị thi công') ? order.address : 'Chưa có'} • Hạn thi công: ${(order.due_date && order.due_date !== 'Chưa nhập hạn thi công') ? order.due_date : 'Chưa có'}`;
          document.getElementById('manage-order-details-title').textContent = title;
          document.getElementById('manage-order-details-subtitle').textContent = subtitle;
          let quotes = [];
          try { quotes = JSON.parse(order.items || '[]'); } catch (_) { quotes = []; }
          // Resolve each quote reference against authoritative currentQuotes so totals/prices are up-to-date
          try {
            quotes = quotes.map(q => resolveQuoteReference(q));
          } catch (e) { /* ignore resolution errors */ }
          renderManageOrderPages(quotes);
          bindManageOrderPager();
        }

        function renderManageOrderPages(quotes, page=1) {
          const container = document.getElementById('manage-order-pages');
          if (!container) return;
          const totalItems = Array.isArray(quotes) ? quotes.length : 0;
          const pages = Math.max(1, Math.ceil(totalItems / MOD_PAGE_SIZE));
          const safePage = Math.min(Math.max(1, page), pages);
          const totalEl = document.getElementById('mod-page-total');
          if (totalEl) totalEl.textContent = String(pages);
          const totalTopEl = document.getElementById('mod-page-total-top');
          if (totalTopEl) totalTopEl.textContent = String(pages);
          let html = '';
          for (let p = 1; p <= pages; p++) {
            const start = (p - 1) * MOD_PAGE_SIZE;
            const slice = quotes.slice(start, start + MOD_PAGE_SIZE);
            html += `
              <div class="align-top" style="width: 794px; min-width: 794px; height: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.06); background: white; display: flex; flex-direction: column; flex: 0 0 794px;">
                <div class="flex items-center justify-between mb-3 flex-shrink-0">
                  <div class="font-semibold text-gray-800">Danh sách điểm (Trang ${p})</div>
                  <div class="text-sm text-gray-500">${slice.length} điểm</div>
                </div>
                <div class="space-y-2 page-scroll flex-grow" style="overflow-y: auto; padding-right: 8px;">
                  ${slice.map((q, idx) => renderManageOrderPointRow(q, start + idx + 1)).join('')}
                </div>
              </div>`;
          }
          container.innerHTML = html;
          container.style.display = 'flex';
          container.style.flexDirection = 'row';
          container.style.flexWrap = 'nowrap';
          container.style.gap = '0';
          container.style.position = 'relative';
          container.style.alignItems = 'stretch';
          container.style.justifyContent = 'flex-start';
          container.dataset.snap = 'true';
          container._totalPages = pages;
          container._quotes = quotes;
          container._currentPage = 0;
          container.scrollLeft = 0;
          requestAnimationFrame(() => scrollManageOrderToPage(safePage, false));
        }

        // Resolve a quote reference (from production order items) to authoritative currentQuotes entry
        function resolveQuoteReference(ref) {
          if (!ref) return ref || {};
          try {
            const qKey = (typeof getQuoteKey === 'function') ? String(getQuoteKey(ref)) : (ref.__backendId || ref.id || ref.quote_code || ref.quoteCode || '');
            const master = (Array.isArray(currentQuotes) && currentQuotes.length) ? currentQuotes.find(q => {
              try { return (typeof getQuoteKey === 'function') ? String(getQuoteKey(q)) === qKey : (String(q.__backendId || q.id || q.quote_code || q.quoteCode || '') === qKey);
              } catch (e) { return false; }
            }) : null;
            const source = master || ref;
            // Ensure items array and numeric total are normalized for rendering
            let items = [];
            try { items = Array.isArray(source.items) ? source.items : JSON.parse(source.items || '[]'); } catch (e) { items = []; }
            const total_amount = parseMoney(source.total_amount) || parseMoney(ref.total_amount) || 0;
            return { ...source, items: items, total_amount: total_amount };
          } catch (e) { return ref || {}; }
        }

        function scrollManageOrderToPage(page, smooth = true) {
          const container = document.getElementById('manage-order-pages');
          if (!container) return;
          const total = container._totalPages || container.children.length || 1;
          const target = Math.min(Math.max(1, page), total);
          const child = container.children[target - 1];
          if (child) {
            const left = child.offsetLeft;
            if (smooth && typeof container.scrollTo === 'function') {
              container.scrollTo({ left, top: 0, behavior: 'smooth' });
            } else {
              container.scrollLeft = left;
            }
          }
          container._currentPage = target;
          const curEl = document.getElementById('mod-page-cur');
          if (curEl) curEl.textContent = String(target);
        }

        function renderManageOrderPointRow(q, idx) {
          const items = Array.isArray(q.items) ? q.items : (() => { try { return JSON.parse(q.items || '[]'); } catch (_) { return []; } })();
          const totalAmount = (typeof q.total_amount !== 'undefined' && q.total_amount !== null) ? parseMoney(q.total_amount) || 0 : (parseMoney(q.total || 0) || 0);
          const quoteCode = (typeof formatQuoteCode === 'function' && q.quote_code) ? formatQuoteCode(q) : (q.quote_code || q.quoteCode || '-');
          const outletName = q.outlet_name || '-';
          const saleName = q.sale_name || '-';
          const spoNumber = (q.spo_number && q.spo_number !== 'Chưa nhập số đơn hàng') ? q.spo_number : '-';
          const outletCode = q.outlet_code || '-';
          const safeAddress = (q.address && !q.address.startsWith('Địa chỉ sẽ')) ? q.address : '';
          const addressDisplay = safeAddress || 'Chưa có địa chỉ';
          const outletPhone = q.phone || q.outlet_phone || q.contact_phone || '';
          const phoneDisplay = outletPhone || 'Chưa có SĐT';
          return `
            <div>
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="text-base font-semibold text-gray-900 leading-tight">
                    ${idx}. ${outletName}
                    <span class="text-sm font-normal text-gray-700"> - Sale: ${saleName} - SPO: ${spoNumber} - Outletcode: ${outletCode}</span>
                  </div>
                  <div class="text-xs text-gray-600 mt-1">Địa chỉ: ${addressDisplay} • SĐT: ${phoneDisplay}</div>
                </div>
                <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <div class="text-sm font-semibold text-blue-600 whitespace-nowrap">${formatCurrency(totalAmount)}</div>
                  <div style="font-size:12px;color:#333">Mã BG: <strong>${quoteCode}</strong></div>
                </div>
              </div>
              <div class="mt-2 overflow-x-auto">
                <table class="min-w-full text-xs">
                  <thead class="bg-gray-100">
                    <tr>
                      <th class="px-2 py-1 text-left">Code</th>
                      <th class="px-2 py-1 text-left">Nội dung</th>
                      <th class="px-2 py-1 text-left">Brand</th>
                      <th class="px-2 py-1 text-left">Kích thước</th>
                      <th class="px-2 py-1 text-left">SL</th>
                      <th class="px-2 py-1 text-left">ĐVT</th>
                      <th class="px-2 py-1 text-left">Đơn giá</th>
                      <th class="px-2 py-1 text-left">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    ${items.map(it => `
                      <tr>
                        <td class="px-2 py-1">${it.code || ''}</td>
                        <td class="px-2 py-1">${it.content || ''}</td>
                        <td class="px-2 py-1">${it.brand || '-'}</td>
                        <td class="px-2 py-1">${(it.width && it.height) ? `${it.width}m × ${it.height}m` : '-'}</td>
                        <td class="px-2 py-1">${it.quantity || ''}</td>
                        <td class="px-2 py-1">${it.unit || ''}</td>
                        <td class="px-2 py-1">${formatCurrency(parseMoney(it.price) || 0)}</td>
                        <td class="px-2 py-1 text-blue-600 font-semibold">${formatCurrencyExact((parseMoney(it.price) || 0) * (parseNumber(it.quantity) || 0))}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
        }

        function bindManageOrderPager() {
          const prev = document.getElementById('mod-prev');
          const next = document.getElementById('mod-next');
          if (prev && !prev._bound) {
            prev._bound = true;
            prev.addEventListener('click', () => {
              const container = document.getElementById('manage-order-pages');
              if (!container) return;
              const cur = container._currentPage || 1;
              if (cur > 1) scrollManageOrderToPage(cur - 1);
            });
          }
          if (next && !next._bound) {
            next._bound = true;
            next.addEventListener('click', () => {
              const container = document.getElementById('manage-order-pages');
              if (!container) return;
              const cur = container._currentPage || 1;
              const total = container._totalPages || container.children.length || 1;
              if (cur < total) scrollManageOrderToPage(cur + 1);
            });
          }
          const closeBtn = document.getElementById('close-manage-order-details');
          if (closeBtn && !closeBtn._bound) {
            closeBtn._bound = true;
            closeBtn.addEventListener('click', () => {
              const modal = document.getElementById('manage-order-details-modal');
              if (modal) {
                modal.classList.add('hidden');
                try { delete modal.dataset.openOrderId; } catch (e) {}
              }
              ensureScrollLock();
            });
          }
        }

        // Export production list to Excel (Thi công)
        async function exportProductionExcelForOrder(order) {
          try {
            await ensureXlsxLib();

            let quotes = JSON.parse(order.items || '[]');
            // Sort quotes so the earliest/lowest quote appears first.
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
              if (Array.isArray(quotes) && quotes.length) quotes.sort((a,b) => (quoteKeySort(a) || 0) - (quoteKeySort(b) || 0));
            } catch (e) { /* ignore sort errors */ }
            const data = [];
            data.push(['STT', 'Sale', 'Outlet Info', 'Code', 'Nội dung', 'Brand', 'Width (m)', 'Height (m)', 'SL', 'ĐVT', 'Đơn giá', 'Thành tiền', 'SPO', 'Outlet Code', 'Tổng tiền Outlet']);
            let globalIndex = 0;
            quotes.forEach(q => {
              const items = JSON.parse(q.items || '[]');
              const outletTotal = parseMoney(q.total_amount) || 0;
              items.forEach(item => {
                globalIndex++;
                const priceVal = parseMoney(item.price) || 0;
                const qtyVal = parseNumber(item.quantity) || 0;
                const parsedTotal = parseMoney(item.total) || 0;
                const computedTotal = priceVal * qtyVal;
                const useTotal = (parsedTotal > 0 && Math.abs(parsedTotal - computedTotal) / (computedTotal || 1) <= 0.1) ? parsedTotal : computedTotal;
                // Do NOT set values for merged columns here (only set at start row later).
                  data.push([
                    '',
                    q.sale_name || '',
                    `${q.outlet_name || ''}\n(${q.address || ''})\n${q.phone || q.outlet_phone || q.contact_phone || ''}`,
                    item.code || '',
                    item.content || '',
                    item.brand || '',
                    item.width || '',
                    item.height || '',
                    item.quantity || '',
                    item.unit || '',
                    priceVal || 0,
                    useTotal || 0,
                    q.spo_number || '',
                    q.outlet_code || '',
                    outletTotal || 0
                  ]);
              });
            });

            const merges = [];
            const groups = {};
            data.forEach((row, idx) => {
              if (idx === 0) return; // skip header
              const key = `${row[2] || ''}|${row[12] || ''}|${row[13] || ''}`; // C, M, N
              if (!groups[key]) groups[key] = [];
              groups[key].push(idx);
            });

            // For each group of rows, only keep values at the start row for merged columns, then create merges
            Object.values(groups).forEach(indices => {
              if (indices.length > 1) {
                indices.sort((a, b) => a - b);
                const start = Math.min(...indices);
                const end = Math.max(...indices);
                const mergeCols = [0, 1, 2, 12, 13, 14];
                mergeCols.forEach(c => {
                  const val = data[start] && data[start][c] ? data[start][c] : '';
                  if (!data[start]) data[start] = [];
                  data[start][c] = val;
                  for (let k = 1; k < indices.length; k++) {
                    const ridx = indices[k];
                    if (!data[ridx]) continue;
                    data[ridx][c] = '';
                  }
                });
                data[start][0] = 1;
                merges.push({ s: { r: start, c: 0 }, e: { r: end, c: 0 } });
                merges.push({ s: { r: start, c: 1 }, e: { r: end, c: 1 } });
                merges.push({ s: { r: start, c: 2 }, e: { r: end, c: 2 } });
                merges.push({ s: { r: start, c: 12 }, e: { r: end, c: 12 } });
                merges.push({ s: { r: start, c: 13 }, e: { r: end, c: 13 } });
                merges.push({ s: { r: start, c: 14 }, e: { r: end, c: 14 } });
              }
            });
            const ws = XLSX.utils.aoa_to_sheet(data);
            ws['!merges'] = merges;
            // Format numeric money columns: Đơn giá (10), Thành tiền (11), Tổng tiền Outlet (14)
            try {
              const lastRow = data.length - 1;
              for (let r = 1; r <= lastRow; r++) {
                [10, 11, 14].forEach(c => {
                  const cellRef = XLSX.utils.encode_cell({ c, r });
                  if (ws[cellRef] && ws[cellRef].t === 'n') ws[cellRef].z = '#,##0';
                });
              }
            } catch (e) { /* ignore formatting errors */ }
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Thi công');
            const filename = `Thi_cong_${order.spo_number || 'Chua_co'}.xlsx`;
            XLSX.writeFile(wb, filename);
          } catch (e) {
            console.error('exportProductionExcel error', e);
            if (typeof showToast === 'function') showToast('Không thể xuất Excel: ' + (e.message || 'Lỗi'));
          }
        }

        // Export pending order to Excel (Thi công - Pending Order)
        async function exportPendingOrderToExcel(orderId) {
          try {
            await ensureXlsxLib();

            const order = pendingOrders.find(o => o.id === orderId);
            if (!order) {
              showToast('Không tìm thấy đơn chờ duyệt');
              return;
            }

            let quotes = order.quotes;
            // Sort quotes so the earliest/lowest quote appears first
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
              if (Array.isArray(quotes) && quotes.length) quotes.sort((a,b) => (quoteKeySort(a) || 0) - (quoteKeySort(b) || 0));
            } catch (e) { /* ignore sort errors */ }

            const data = [];
            data.push(['STT', 'Sale', 'Outlet Info', 'Code', 'Nội dung', 'Brand', 'Width (m)', 'Height (m)', 'SL', 'ĐVT', 'Đơn giá', 'Thành tiền', 'SPO', 'Outlet Code', 'Tổng tiền Outlet']);
            
            let globalIndex = 0;
            quotes.forEach(q => {
              const items = JSON.parse(q.items || '[]');
              const outletTotal = parseMoney(q.total_amount) || 0;
              items.forEach(item => {
                globalIndex++;
                const priceVal = parseMoney(item.price) || 0;
                const qtyVal = parseNumber(item.quantity) || 0;
                const parsedTotal = parseMoney(item.total) || 0;
                const computedTotal = priceVal * qtyVal;
                const useTotal = (parsedTotal > 0 && Math.abs(parsedTotal - computedTotal) / (computedTotal || 1) <= 0.1) ? parsedTotal : computedTotal;
                data.push([
                  '',
                  q.sale_name || '',
                  `${q.outlet_name || ''}\n(${q.address || ''})\n${q.phone || q.outlet_phone || q.contact_phone || ''}`,
                  item.code || '',
                  item.content || '',
                  item.brand || '',
                  item.width || '',
                  item.height || '',
                  item.quantity || '',
                  item.unit || '',
                  priceVal || 0,
                  useTotal || 0,
                  q.spo_number || '',
                  q.outlet_code || '',
                  outletTotal || 0
                ]);
              });
            });

            // Create merges for grouped rows
            const merges = [];
            const groups = {};
            data.forEach((row, idx) => {
              if (idx === 0) return; // skip header
              const key = `${row[2] || ''}|${row[12] || ''}|${row[13] || ''}`; // C, M, N
              if (!groups[key]) groups[key] = [];
              groups[key].push(idx);
            });

            // For each group of rows, only keep values at the start row for merged columns
            Object.values(groups).forEach(indices => {
              if (indices.length > 1) {
                indices.sort((a, b) => a - b);
                const start = Math.min(...indices);
                const end = Math.max(...indices);
                const mergeCols = [0, 1, 2, 12, 13, 14];
                mergeCols.forEach(c => {
                  const val = data[start] && data[start][c] ? data[start][c] : '';
                  if (!data[start]) data[start] = [];
                  data[start][c] = val;
                  for (let k = 1; k < indices.length; k++) {
                    const ridx = indices[k];
                    if (!data[ridx]) continue;
                    data[ridx][c] = '';
                  }
                });
                data[start][0] = 1;
                merges.push({ s: { r: start, c: 0 }, e: { r: end, c: 0 } });
                merges.push({ s: { r: start, c: 1 }, e: { r: end, c: 1 } });
                merges.push({ s: { r: start, c: 2 }, e: { r: end, c: 2 } });
                merges.push({ s: { r: start, c: 12 }, e: { r: end, c: 12 } });
                merges.push({ s: { r: start, c: 13 }, e: { r: end, c: 13 } });
                merges.push({ s: { r: start, c: 14 }, e: { r: end, c: 14 } });
              }
            });

            const ws = XLSX.utils.aoa_to_sheet(data);
            ws['!merges'] = merges;
            
            // Format numeric money columns: Đơn giá (10), Thành tiền (11), Tổng tiền Outlet (14)
            try {
              const lastRow = data.length - 1;
              for (let r = 1; r <= lastRow; r++) {
                [10, 11, 14].forEach(c => {
                  const cellRef = XLSX.utils.encode_cell({ c, r });
                  if (ws[cellRef] && ws[cellRef].t === 'n') ws[cellRef].z = '#,##0';
                });
              }
            } catch (e) { /* ignore formatting errors */ }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Thi công');
            
            // Generate filename with timestamp
            const timestamp = new Date(order.createdAt).toLocaleDateString('vi-VN').replace(/\//g, '-');
            const filename = `Don_cho_duyet_${order.createdBy}_${timestamp}.xlsx`;
            
            XLSX.writeFile(wb, filename);
            showToast('Đã xuất Excel thành công');
          } catch (e) {
            console.error('exportPendingOrderToExcel error', e);
            showToast('Không thể xuất Excel: ' + (e.message || 'Lỗi'));
          }
        }

        // Export generate order to Excel (Ra Đơn Hàng)
        async function exportGenerateOrderExcel(order) {
          try {
            await ensureXlsxLib();

            let quotes = JSON.parse(order.items || '[]');
            // Ensure quotes are ordered by earliest quote first (by code sequence or created_at)
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
              if (Array.isArray(quotes) && quotes.length) quotes.sort((a,b) => (quoteKeySort(a) || 0) - (quoteKeySort(b) || 0));
            } catch (e) { /* ignore */ }
            // Build rows grouped by Sale to match PDF ordering (shipping sorting removed)
            const data = [];
            data.push(['STT', 'Sale', 'Outlet Info', 'Code', 'Nội dung', 'Brand', 'Width (m)', 'Height (m)', 'SL', 'ĐVT', 'Đơn giá', 'Thành tiền', 'SPO', 'Outlet Code', 'Tổng tiền Outlet']);
            let globalIndex = 0;
            const groupedBySale = {};
            const saleOrder = [];
            quotes.forEach(q => {
              const saleType = q.sale_type === 'TBA' ? 'TBA' : 'Sale (SR)';
              const saleName = q.sale_name || 'Không có tên';
              const saleKey = `${saleType} - ${saleName}`;
              if (!groupedBySale[saleKey]) { groupedBySale[saleKey] = []; saleOrder.push(saleKey); }
              groupedBySale[saleKey].push(q);
            });

            saleOrder.forEach(saleKey => {
              const group = groupedBySale[saleKey] || [];
              group.forEach(q => {
                const items = JSON.parse(q.items || '[]');
                const outletTotal = parseMoney(q.total_amount) || 0;
                items.forEach(item => {
                  globalIndex++;
                  const priceVal = parseMoney(item.price) || 0;
                  const qtyVal = parseNumber(item.quantity) || 0;
                  const parsedTotal = parseMoney(item.total) || 0;
                  const computedTotal = priceVal * qtyVal;
                  // Prefer parsedTotal when it closely matches computedTotal; otherwise prefer computedTotal
                  const useTotal = (parsedTotal > 0 && Math.abs(parsedTotal - computedTotal) / (computedTotal || 1) <= 0.1) ? parsedTotal : computedTotal;
                  data.push([
                    '',
                    q.sale_name || '',
                    `${q.outlet_name || ''}\n(${q.address || ''})\n${q.phone || q.outlet_phone || q.contact_phone || ''}`,
                    item.code || '',
                    item.content || '',
                    item.brand || '',
                    item.width || '',
                    item.height || '',
                    item.quantity || '',
                    item.unit || '',
                    priceVal,
                    useTotal || 0,
                    q.spo_number || '',
                    q.outlet_code || '',
                    parseMoney(q.total_amount) || 0
                  ]);
                });
              });
            });

            const merges = [];
            const groups = {};
            data.forEach((row, idx) => {
              if (idx === 0) return; // skip header
              const key = `${row[2] || ''}|${row[12] || ''}|${row[13] || ''}`; // C, M, N
              if (!groups[key]) groups[key] = [];
              groups[key].push(idx);
            });

            // For each group of rows, only keep values at the start row for merged columns, then create merges
            Object.values(groups).forEach(indices => {
              if (indices.length > 1) {
                indices.sort((a, b) => a - b);
                const start = Math.min(...indices);
                const end = Math.max(...indices);
                const mergeCols = [0, 1, 2, 12, 13, 14];
                mergeCols.forEach(c => {
                  const val = data[start] && data[start][c] ? data[start][c] : '';
                  if (!data[start]) data[start] = [];
                  data[start][c] = val;
                  for (let k = 1; k < indices.length; k++) {
                    const ridx = indices[k];
                    if (!data[ridx]) continue;
                    data[ridx][c] = '';
                  }
                });
                data[start][0] = 1;
                merges.push({ s: { r: start, c: 0 }, e: { r: end, c: 0 } });
                merges.push({ s: { r: start, c: 1 }, e: { r: end, c: 1 } });
                merges.push({ s: { r: start, c: 2 }, e: { r: end, c: 2 } });
                merges.push({ s: { r: start, c: 12 }, e: { r: end, c: 12 } });
                merges.push({ s: { r: start, c: 13 }, e: { r: end, c: 13 } });
                merges.push({ s: { r: start, c: 14 }, e: { r: end, c: 14 } });
              }
            });
            const ws = XLSX.utils.aoa_to_sheet(data);
            ws['!merges'] = merges;
            // Format numeric money columns: Đơn giá (10), Thành tiền (11), Tổng tiền Outlet (14)
            try {
              const lastRow = data.length - 1;
              for (let r = 1; r <= lastRow; r++) {
                [10, 11, 14].forEach(c => {
                  const cellRef = XLSX.utils.encode_cell({ c, r });
                  if (ws[cellRef] && ws[cellRef].t === 'n') ws[cellRef].z = '#,##0';
                });
              }
            } catch (e) { /* ignore formatting errors */ }
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Ra Đơn Hàng');
            const filename = `Ra_don_hang_${order.spo_number || 'Chua_co'}.xlsx`;
            XLSX.writeFile(wb, filename);
            // Mark order as exported and persist
            try {
              const now = new Date().toISOString();
              order.is_exported = true;
              order.exported_at = now;
              order.qcag_status = 'Đã ra đơn';
              if (window.dataSdk && typeof window.dataSdk.update === 'function') {
                try { window.dataSdk.update(order); } catch (e) { /* ignore */ }
              }
              // Re-render list to reflect status change
              try { renderProductionOrdersList(productionOrders); } catch (e) { /* ignore */ }
            } catch (err) { /* ignore marking errors */ }
          } catch (e) {
            console.error('exportGenerateOrderExcel error', e);
            if (typeof showToast === 'function') showToast('Không thể xuất Excel: ' + (e.message || 'Lỗi'));
          }
        }

        // Export production list to A4 PDF (Thi công) — replaces "Mã BG" with a square box for on-paper marking
        async function exportProductionPdf() {
          try {
            const container = document.getElementById('manage-order-pages');
            const titleText = (document.getElementById('manage-order-details-title') || {}).textContent || '';
            const subtitleText = (document.getElementById('manage-order-details-subtitle') || {}).textContent || '';
            const quotes = (container && container._quotes) ? container._quotes : [];

            const printEl = document.createElement('div');
            printEl.id = 'print-production-container';
            printEl.style.background = '#fff';
            printEl.style.width = 'calc(190mm + 10px)';
            printEl.style.minHeight = '277mm';
            printEl.style.boxSizing = 'border-box';
            printEl.style.padding = '15px';
            printEl.style.margin = '0 auto';
            printEl.style.fontFamily = 'Segoe UI, Arial, sans-serif';
            printEl.style.color = '#111';
            printEl.style.fontSize = '12px';

            // Ensure QR library (QRious) is loaded before generating QR images
            function ensureQrLib() {
              if (typeof window.QRious === 'function') return Promise.resolve();
              return new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
                s.onload = () => resolve();
                s.onerror = () => reject(new Error('Không tải được thư viện QRious'));
                document.head.appendChild(s);
              });
            }

            const orderMatch = titleText.match(/Đơn hàng:\s*(.*)/i);
            const orderNumber = orderMatch ? orderMatch[1].trim() : (titleText || '');
            const unitMatch = subtitleText.match(/Đơn vị thi công:\s*([^•]+)/i);
            const unit = unitMatch ? unitMatch[1].trim() : '';
            const dueMatch = subtitleText.match(/Hạn thi công:\s*(.*)/i);
            const due = dueMatch ? dueMatch[1].trim() : '';
            var displayDue = 'Chưa có';
            if (due) {
              var dObj = new Date(due);
              if (!isNaN(dObj)) displayDue = dObj.toLocaleDateString('vi-VN');
              else displayDue = due;
            }

            const headerHtml = `
              <div style="text-align:center;margin-bottom:8mm">
                <h1 style="margin:0;font-size:18px;">Danh sách thi công đơn hàng: <strong style="font-weight:700">${escapeHtml(orderNumber)}</strong></h1>
                <div style="font-size:12px;color:#555;margin-top:6px">Thi công: <strong>${escapeHtml(unit)}</strong> - Thời hạn thi công <strong>${escapeHtml(displayDue)}</strong></div>
              </div>
              <div style="margin-bottom:6mm;font-size:12px;">Tổng điểm: ${quotes.length}</div>
            `;

            // Render per-outlet WITHOUT prices; show QR (encoding outlet name) instead of square box
            function renderManageOrderPointRowNoPrice(q, idx, qrDataUrl) {
              const items = (() => { try { return JSON.parse(q.items || '[]'); } catch (_) { return []; } })();
              // Filter out unwanted item categories for PDF export:
              // - Remove items whose content mentions 'Giấy phép' or 'Vận chuyển'
              // - If the quote contains an item with code '2.1', also remove items with code 'S9.17' (tôn kẽm)
              const hasCode21 = Array.isArray(items) && items.some(it => String((it.code || '')).replace(/^s/i, '').trim() === '2.1');
              const filteredItems = (Array.isArray(items) ? items : []).filter(it => {
                try {
                  const codeRaw = String(it.code || '').trim();
                  const codeNorm = codeRaw.replace(/^s/i, '').trim();
                  const content = String(it.content || '').toLowerCase();
                  if (content.includes('giấy phép') || content.includes('vận chuyển')) return false;
                  if (codeNorm === '9.17' || /^s9\.17$/i.test(codeRaw)) {
                    // only remove S9.17 when code 2.1 is present
                    if (hasCode21) return false;
                  }
                } catch (e) {
                  return true;
                }
                return true;
              });
              const outletName = q.outlet_name || '-';
              const saleName = q.sale_name || '-';
              const spoNumber = (q.spo_number && q.spo_number !== 'Chưa nhập số đơn hàng') ? q.spo_number : '-';
              const outletCode = q.outlet_code || '-';
              const safeAddress = (q.address && !q.address.startsWith('Địa chỉ sẽ')) ? q.address : '';
              const addressDisplay = safeAddress || 'Chưa có địa chỉ';
              const outletPhone = q.phone || q.outlet_phone || q.contact_phone || '';
              const phoneDisplay = outletPhone || 'Chưa có SĐT';
              const salePhone = q.sale_phone || q.sale_phone_number || q.salePhone || '';
              const salePhoneDisplay = salePhone ? salePhone : 'Chưa có SĐT';
              const quoteCode = (typeof formatQuoteCode === 'function' && q.quote_code) ? formatQuoteCode(q) : (q.quote_code || q.quoteCode || '-');

              return `
                <div>
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                      <div class="text-base font-semibold text-gray-900 leading-tight">
                        ${idx}. ${escapeHtml(outletName)}
                        <span class="text-sm font-normal text-gray-700"> - Sale: ${escapeHtml(saleName)} <span class="text-xs text-gray-500">(SĐT Sale: ${escapeHtml(salePhoneDisplay)})</span></span>
                      </div>
                      <div class="text-xs text-gray-600 mt-1">Địa chỉ: ${escapeHtml(addressDisplay)} • SĐT: ${escapeHtml(phoneDisplay)}</div>
                      <div class="text-xs text-gray-700 mt-1">SPO: ${escapeHtml(spoNumber)} • Outletcode: ${escapeHtml(outletCode)}</div>
                    </div>
                    <div class="text-right">
                      <!-- Quote code label on the left, QR on the right; aligned to bottom -->
                      <div style="display:flex;align-items:flex-end;gap:12px;justify-content:flex-end">
                        <div style="height:72px;display:flex;flex-direction:column;justify-content:flex-end;text-align:right;font-size:12px;color:#333;">
                          <div style="font-style:italic;">Dùng ZALO quét mã QR</div>
                          <div style="font-style:italic;">để xem hình ảnh phối cảnh</div>
                          <div style="font-weight:600;">Mã BG: <span style="font-weight:700;">${escapeHtml(quoteCode)}</span></div>
                        </div>
                        ${qrDataUrl ? `<div style="width:72px;height:72px;display:flex;align-items:center;justify-content:center;border:1px solid #333;border-radius:6px;background:#fff;padding:4px;box-sizing:border-box"><img src="${qrDataUrl}" alt="QR" style="width:100%;height:100%;display:block;object-fit:contain;border-radius:2px"/></div>` : `<div style="width:72px;height:72px;border:1px solid #333;border-radius:6px;background:#fff"></div>`}
                      </div>
                    </div>
                  </div>
                  <div class="mt-2 overflow-x-auto">
                    <table class="min-w-full text-xs">
                      <thead class="bg-gray-100">
                        <tr>
                          <th class="px-2 py-1 text-left">Code</th>
                          <th class="px-2 py-1 text-left">Nội dung</th>
                          <th class="px-2 py-1 text-left">Brand</th>
                          <th class="px-2 py-1 text-left">Kích thước</th>
                          <th class="px-2 py-1 text-left">SL</th>
                          <th class="px-2 py-1 text-left">ĐVT</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y">
                        ${filteredItems.map(it => `
                          <tr>
                            <td class="px-2 py-1">${escapeHtml(it.code || '')}</td>
                            <td class="px-2 py-1">${escapeHtml(it.content || '')}</td>
                            <td class="px-2 py-1">${escapeHtml(it.brand || '-')}</td>
                            <td class="px-2 py-1">${(it.width && it.height) ? escapeHtml(`${it.width}m × ${it.height}m`) : '-'}</td>
                            <td class="px-2 py-1">${escapeHtml(it.quantity || '')}</td>
                            <td class="px-2 py-1">${escapeHtml(it.unit || '')}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>`;
            }

            // Generate QR before rendering (if library available)
            try {
              await ensureQrLib();
            } catch (e) {
              console.warn('QR library load failed', e);
            }

            // Generate QR images for each quote. Prefer images from the original/master quote
            // (lookup via `findQuoteByKey`) before falling back to the copy inside the production order.
            // If the image is a data URL, attempt upload via `qcagUploadImageDataUrl`, then try creating a shortlink.
            const qrMap = [];
            for (let qi = 0; qi < quotes.length; qi++) {
              const q = quotes[qi];
              try {
                let val = '';
                try {
                  // Prefer master quote images when available
                  let master = null;
                  try { master = (typeof findQuoteByKey === 'function') ? findQuoteByKey(getQuoteKey(q)) : null; } catch (e) { master = null; }
                  const imagesField = (master && master.images) ? master.images : q.images;
                  const imgs = JSON.parse(imagesField || '[]');
                  if (Array.isArray(imgs) && imgs.length) {
                    const first = imgs[0] || {};
                    val = String(first.url || first.data || first.src || '') || '';
                    if (val && val.indexOf('data:image/') === 0 && typeof qcagUploadImageDataUrl === 'function') {
                      try {
                        const uploaded = await qcagUploadImageDataUrl(val, (first.name || ('img_' + Date.now())));
                        if (uploaded) val = uploaded;
                      } catch (e) { /* ignore upload errors */ }
                    }
                  }
                } catch (e) { /* ignore parse errors */ }

                if (!val) val = q.outlet_name || '';

                // Try to create a shortlink via backend. Expect POST { target } -> { ok:true, shortUrl }
                let shortUrl = '';
                try {
                  const base = (window.API_BASE_URL || '').replace(/\/+$/, '');
                  if (base) {
                    const resp = await fetch(base + '/shortlinks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ target: val })
                    });
                    if (resp && resp.ok) {
                      const j = await resp.json().catch(() => null);
                      if (j && j.shortUrl) shortUrl = String(j.shortUrl);
                      else if (j && j.code) shortUrl = base + '/r/' + String(j.code);
                    }
                  }
                } catch (e) { /* ignore shortlink creation errors */ }

                const qrValue = shortUrl || val;
                if (typeof QRious === 'function') {
                  try {
                    const qr = new QRious({ value: qrValue, size: 256 });
                    qrMap.push(qr.toDataURL());
                    continue;
                  } catch (e) { console.warn('QR generation error', e); }
                }
              } catch (e) {
                console.warn('QR map loop error', e);
              }
              qrMap.push(null);
            }

            // Group quotes by sale while preserving original order of groups and items
            const groupedBySale = {};
            const saleOrder = [];
            quotes.forEach(q => {
              const saleType = q.sale_type === 'TBA' ? 'TBA' : 'Sale (SR)';
              const saleName = q.sale_name || 'Không có tên';
              const saleKey = `${saleType} - ${saleName}`;
              if (!groupedBySale[saleKey]) { groupedBySale[saleKey] = []; saleOrder.push(saleKey); }
              groupedBySale[saleKey].push(q);
            });

            let globalIndex = 0;
            let bodyHtml = '';
            saleOrder.forEach(saleKey => {
              const group = groupedBySale[saleKey] || [];
              const groupTotal = group.reduce((s, q) => s + (parseMoney(q.total_amount) || 0), 0);
              // Spacer preserved, sale header intentionally removed per request
              bodyHtml += '<div style="margin-bottom:8px;"></div>';
              group.forEach(q => {
                globalIndex++;
                const originalIndex = quotes.indexOf(q);
                const qr = (Array.isArray(qrMap) ? qrMap[originalIndex] : null);
                bodyHtml += `<div class="print-outlet" style="margin-bottom:5px;border:1px solid #333;border-radius:6px;padding:8px;">${renderManageOrderPointRowNoPrice(q, globalIndex, qr)}</div>`;
              });
            });

            if (!bodyHtml) bodyHtml = '<div style="color:#666;font-size:12px">Không có dữ liệu</div>';

            printEl.innerHTML = headerHtml + bodyHtml;

            const styleTag = document.createElement('style');
            styleTag.id = 'print-production-style';
            styleTag.textContent = `
              @media print {
                @page { size: A4 portrait; margin: 10mm; @bottom-center { content: counter(page) " / " counter(pages) " trang"; } }
                body > *:not(#print-production-container) { display: none !important; }
                /* Center and constrain to printable area, padding 15px */
                #print-production-container { box-shadow: none !important; margin: 0 auto !important; width: calc(190mm + 10px); padding: 15px; box-sizing: border-box; position: relative; left: -30px; }
                #print-production-container .print-outlet { page-break-inside: avoid; margin-bottom: 5px; width: 100%; box-sizing: border-box; border: 1px solid #333; border-radius: 6px; padding: 8px; }
                #print-production-container .manage-page { page-break-inside: avoid; }
                /* Tables: horizontal separators only + compact header */
                #print-production-container table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; box-sizing: border-box; }
                #print-production-container thead th { background: #f3f4f6; padding: 4px 8px; font-weight: 700; color: #111; }
                #print-production-container thead th:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
                #print-production-container thead th:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
                #print-production-container th, #print-production-container td { border: none; padding: 4px 6px; text-align: left; vertical-align: top; }
                /* Darken horizontal separators for print */
                #print-production-container tbody tr td { border-bottom: 1px solid #333; }
                /* Remove extra vertical spacing inside outlet blocks */
                #print-production-container .print-outlet > * { margin-top: 0 !important; margin-bottom: 0 !important; }
                #print-production-container .print-outlet .mt-2 { margin-top: 2px !important; }
                #print-production-container .print-outlet table { margin-top: 4px !important; margin-bottom: 4px !important; }
                /* Make images and wide elements scale down to available width */
                #print-production-container img, #print-production-container svg { max-width: 100% !important; height: auto !important; }
              }
              /* Preview styles when not printing */
              #print-production-container { width: calc(190mm + 10px); margin: 0 auto; padding: 15px; box-sizing: border-box; position: relative; left: -30px; }
              /* Preview: also make separators and outlet frames more visible */
              #print-production-container .print-outlet { border: 1px solid #333; border-radius: 6px; padding: 8px; }
              #print-production-container tbody tr td { border-bottom: 1px solid #333; }
              #print-production-container table { width: 100%; border-collapse: separate; border-spacing: 0; }
              #print-production-container thead th { background: #f3f4f6; padding: 4px 8px; font-weight: 700; color: #111; }
              #print-production-container th, #print-production-container td { padding: 4px 6px; }
            `;

            document.head.appendChild(styleTag);
            document.body.appendChild(printEl);

            function cleanup() {
              try { document.body.removeChild(printEl); } catch (e) { /* ignore */ }
              try { document.head.removeChild(styleTag); } catch (e) { /* ignore */ }
              window.removeEventListener('afterprint', cleanup);
              try { document.getElementById('export-production-pdf-btn').disabled = false; } catch (e) { }
            }

            window.addEventListener('afterprint', cleanup);
            try { document.getElementById('export-production-pdf-btn').disabled = true; } catch (e) { }
            setTimeout(() => { window.print(); }, 50);
          } catch (e) {
            console.error('exportProductionPdf error', e);
            if (typeof showToast === 'function') showToast('Không thể xuất PDF: ' + (e.message || 'Lỗi'));
          }
        }

        // Bind export button
        const exportBtn = document.getElementById('export-production-pdf-btn');
        if (exportBtn && !exportBtn._bound) {
          exportBtn._bound = true;
          exportBtn.addEventListener('click', exportProductionPdf);
        }

        // Independent 'Ra Đơn Hàng' exporter (duplicate of Thi công's behavior but includes prices)
        function exportGenerateOrderPdf() {
          try {
            const container = document.getElementById('manage-order-pages');
            const title = (document.getElementById('manage-order-details-title') || {}).textContent || '';
            const subtitle = (document.getElementById('manage-order-details-subtitle') || {}).textContent || '';
            const quotes = (container && container._quotes) ? container._quotes : [];

            const printEl = document.createElement('div');
            printEl.id = 'print-generate-container';
            printEl.style.background = '#fff';
            printEl.style.width = 'calc(190mm + 10px)';
            printEl.style.minHeight = '277mm';
            printEl.style.boxSizing = 'border-box';
            printEl.style.padding = '15px';
            printEl.style.margin = '0 auto';
            printEl.style.fontFamily = 'Segoe UI, Arial, sans-serif';
            printEl.style.color = '#111';
            printEl.style.fontSize = '12px';

            const titleText = (document.getElementById('manage-order-details-title') || {}).textContent || title;
            const subtitleText = (document.getElementById('manage-order-details-subtitle') || {}).textContent || subtitle;
            const orderMatch = titleText.match(/Đơn hàng:\s*(.*)/i);
            const orderNumber = orderMatch ? orderMatch[1].trim() : (titleText || '');
            const unitMatch = subtitleText.match(/Đơn vị thi công:\s*([^•]+)/i);
            const unit = unitMatch ? unitMatch[1].trim() : '';
            const dueMatch = subtitleText.match(/Hạn thi công:\s*(.*)/i);
            const due = dueMatch ? dueMatch[1].trim() : '';
            var displayDue = 'Chưa có';
            if (due) {
              var dObj = new Date(due);
              if (!isNaN(dObj)) displayDue = dObj.toLocaleDateString('vi-VN');
              else displayDue = due;
            }

            // Total money of all quotes (for header on page 1)
            const totalAmount = (quotes || []).reduce((s, q) => s + (parseMoney(q.total_amount) || 0), 0);

            const headerHtml = `
              <div style="text-align:center;margin-bottom:8mm">
                <h1 style="margin:0;font-size:18px;">Danh sách thi công đơn hàng: <strong style="font-weight:700">${escapeHtml(orderNumber)}</strong></h1>
                <div style="font-size:12px;color:#555;margin-top:6px">Thi công: <strong>${escapeHtml(unit)}</strong> - Thời hạn thi công <strong>${escapeHtml(displayDue)}</strong></div>
                <div style="font-size:13px;color:#111;margin-top:8px">Tổng tiền toàn bộ: <strong>${formatCurrency(totalAmount)}</strong></div>
              </div>
              <div style="margin-bottom:6mm;font-size:12px;">Tổng điểm: ${quotes.length}</div>
            `;

            // Group quotes by sale and render groups with continuous numbering
            const groupedBySale2 = {};
            const saleOrder2 = [];
            quotes.forEach(q => {
              const saleType = q.sale_type === 'TBA' ? 'TBA' : 'Sale (SR)';
              const saleName = q.sale_name || 'Không có tên';
              const saleKey = `${saleType} - ${saleName}`;
              if (!groupedBySale2[saleKey]) { groupedBySale2[saleKey] = []; saleOrder2.push(saleKey); }
              groupedBySale2[saleKey].push(q);
            });

            let globalIndex2 = 0;
            let bodyHtml = '';
            saleOrder2.forEach(saleKey => {
              const group = groupedBySale2[saleKey] || [];
              const groupTotal = group.reduce((s, q) => s + (parseMoney(q.total_amount) || 0), 0);
              bodyHtml += `<div style="margin-bottom:8px;"><h2 style="margin:0;font-size:14px;">${escapeHtml(saleKey)} (${group.length} báo giá - ${formatCurrency(groupTotal)})</h2></div>`;
              group.forEach(q => {
                globalIndex2++;
                bodyHtml += `<div class="print-outlet" style="margin-bottom:5px;border:1px solid #333;border-radius:6px;padding:8px;">${renderManageOrderPointRow(q, globalIndex2)}</div>`;
              });
            });
            if (!bodyHtml) bodyHtml = '<div style="color:#666;font-size:12px">Không có dữ liệu</div>';

            printEl.innerHTML = headerHtml + bodyHtml;

            const styleTag = document.createElement('style');
            styleTag.id = 'print-generate-style';
            styleTag.textContent = `
              @media print {
                @page { size: A4 portrait; margin: 10mm; @bottom-center { content: counter(page) " / " counter(pages) " trang"; } }
                body > *:not(#print-generate-container) { display: none !important; }
                #print-generate-container { box-shadow: none !important; margin: 0 auto !important; width: calc(190mm + 10px); padding: 15px; box-sizing: border-box; position: relative; left: -30px; }
                #print-generate-container .print-outlet { page-break-inside: avoid; margin-bottom: 5px; width: 100%; box-sizing: border-box; }
                #print-generate-container table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; box-sizing: border-box; }
                #print-generate-container thead th { background: #f3f4f6; padding: 4px 8px; font-weight: 700; color: #111; }
                #print-generate-container th, #print-generate-container td { border: none; padding: 4px 6px; text-align: left; vertical-align: top; }
                #print-generate-container tbody tr td { border-bottom: 1px solid #333; }
              }
              #print-generate-container { width: calc(190mm + 10px); margin: 0 auto; padding: 15px; box-sizing: border-box; position: relative; left: -30px; }
              #print-generate-container table { width: 100%; border-collapse: separate; border-spacing: 0; }
              #print-generate-container thead th { background: #f3f4f6; padding: 4px 8px; font-weight: 700; color: #111; }
              #print-generate-container th, #print-generate-container td { padding: 4px 6px; }
            `;

            document.head.appendChild(styleTag);
            document.body.appendChild(printEl);

            function cleanup() {
              try { document.body.removeChild(printEl); } catch (e) { /* ignore */ }
              try { document.head.removeChild(styleTag); } catch (e) { /* ignore */ }
              window.removeEventListener('afterprint', cleanup);
              try { document.getElementById('generate-order-pdf-btn').disabled = false; } catch (e) { }
            }

            window.addEventListener('afterprint', cleanup);
            try { document.getElementById('generate-order-pdf-btn').disabled = true; } catch (e) { }
            setTimeout(() => { window.print(); }, 50);
          } catch (e) {
            console.error('exportGenerateOrderPdf error', e);
            if (typeof showToast === 'function') showToast('Không thể xuất PDF: ' + (e.message || 'Lỗi'));
          }
        }

        // Bind independent generate order button
        const genBtn = document.getElementById('generate-order-pdf-btn');
        if (genBtn && !genBtn._bound) {
          genBtn._bound = true;
          genBtn.addEventListener('click', exportGenerateOrderPdf);
        }

        // --- Production modal performance helpers ---
        // Avoid repeatedly JSON.parse-ing productionOrders quote_keys/items for every quote.
        // Cache parsed arrays in a WeakMap so we don't mutate order objects (safe for persistence).
        const __qcagProductionOrderParseCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;

        function __qcagSafeParseJsonArray(value) {
          if (!value) return [];
          if (Array.isArray(value)) return value;
          if (typeof value !== 'string') return [];
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            return [];
          }
        }

        function __qcagGetParsedOrderPayload(order) {
          if (!order) return { quoteKeys: [], items: [] };
          if (!__qcagProductionOrderParseCache) {
            return {
              quoteKeys: __qcagSafeParseJsonArray(order.quote_keys),
              items: __qcagSafeParseJsonArray(order.items),
            };
          }
          const cached = __qcagProductionOrderParseCache.get(order);
          if (cached) return cached;
          const payload = {
            quoteKeys: __qcagSafeParseJsonArray(order.quote_keys),
            items: __qcagSafeParseJsonArray(order.items),
          };
          __qcagProductionOrderParseCache.set(order, payload);
          return payload;
        }

        function __qcagBuildProductionQuoteKeySet() {
          const set = new Set();
          try {
            if (!Array.isArray(productionOrders) || productionOrders.length === 0) return set;
            for (let oi = 0; oi < productionOrders.length; oi++) {
              const ord = productionOrders[oi];
              if (!ord) continue;
              const payload = __qcagGetParsedOrderPayload(ord);
              const keys = payload.quoteKeys;
              if (Array.isArray(keys) && keys.length) {
                for (let ki = 0; ki < keys.length; ki++) {
                  const k = keys[ki];
                  if (k !== undefined && k !== null && String(k)) set.add(String(k));
                }
              }
              const items = payload.items;
              if (Array.isArray(items) && items.length) {
                for (let ii = 0; ii < items.length; ii++) {
                  const it = items[ii];
                  if (!it) continue;
                  let k2 = '';
                  try {
                    if (typeof getQuoteKey === 'function') k2 = getQuoteKey(it);
                  } catch (e) { /* ignore */ }
                  if (!k2) k2 = it.quote_key || it.quote_code || it.__backendId || it.id || it.spo_number || '';
                  if (k2) set.add(String(k2));
                }
              }
            }
          } catch (e) {
            // ignore
          }
          return set;
        }

        function renderProductionQuotes(quotes) {
            const container = document.getElementById('production-quotes-list');

            const __qcagProfile = (() => {
              try { return String(localStorage.getItem('QCAG_PROFILE_PRODUCTION_MODAL') || '') === '1'; } catch (e) { return false; }
            })();
            const __t0 = (__qcagProfile && window.performance && typeof performance.now === 'function') ? performance.now() : 0;

            if (quotes.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-6 text-sm">Không có báo giá nào</p>';
                // Reset container state to prevent stale data
                if (container._prodRowMap) container._prodRowMap.clear();
                if (container._prodIndex) container._prodIndex = [];
                if (container._prodVisible) container._prodVisible.clear();
                if (container._prodSearchIndex) container._prodSearchIndex.clear();
                container._prodPage = 1;
                return;
            }

            // Compact, single-line rows matching header (STT - Mã BG - Khu Vực - SPO - Outlet Code - Tên Outlet - Tên Sale - Số Tiền - Trạng Thái)


            // Lọc theo filter trạng thái SPO
            let filterType = window.__productionSPOFilter || 'all';
            const __tFilter0 = (__qcagProfile && window.performance && typeof performance.now === 'function') ? performance.now() : 0;

            // Build once per render (uses WeakMap to avoid repeat JSON.parse)
            const __inProductionKeySet = __qcagBuildProductionQuoteKeySet();

            const filteredQuotes = quotes.filter(quote => {
                const spoNumber = quote.spo_number && String(quote.spo_number).trim();
                const spoStatus = String(quote.spo_status || '').toLowerCase();
                const isApproved = !!spoNumber && (spoStatus.includes('approved') || spoStatus.includes('variation'));
                const isUnapproved = !spoNumber || (!isApproved && (!spoStatus.includes('cancelled') && !spoStatus.includes('rejected') && !spoStatus.includes('accept') && !spoStatus.includes('installed') && !spoStatus.includes('finish')));
                if (filterType === 'approved') return isApproved;
                if (filterType === 'unapproved') return isUnapproved;
              // Exclude quotes that already belong to a production order or have an order number,
              // unless QCAG explicitly indicates a recreate/"Chờ tạo đơn" request.
              try {
                const qKey = (typeof getQuoteKey === 'function') ? String(getQuoteKey(quote)) : '';
                const hasOrderNumber = !!(quote && (quote.qcag_order_number || quote.order_number));
                const inProduction = !!(qKey && __inProductionKeySet && __inProductionKeySet.has(qKey));
                if (hasOrderNumber || inProduction) {
                  const q = computeQCAGStatus(quote);
                  if (!q || q.status !== 'Chờ tạo đơn') return false;
                }
              } catch (e) { /* ignore and proceed */ }
              return isApproved || isUnapproved;
            });

            const __tFilter1 = (__qcagProfile && window.performance && typeof performance.now === 'function') ? performance.now() : 0;

            const __tHtml0 = (__qcagProfile && window.performance && typeof performance.now === 'function') ? performance.now() : 0;

            // Pagination setup (defaults)
            const paginationId = 'production-pagination';
            const pageSizeOptions = [25,50,100,200];
            const defaultPageSize = 50;
            if (!container._prodPageSize) container._prodPageSize = defaultPageSize;
            if (!container._prodPage) container._prodPage = 1;
            const totalMatches = filteredQuotes.length;
            const totalPages = Math.max(1, Math.ceil(totalMatches / container._prodPageSize));
            if (container._prodPage > totalPages) container._prodPage = totalPages;
            const pageStart = (container._prodPage - 1) * container._prodPageSize;
            const pageEnd = pageStart + container._prodPageSize;
            const pageSlice = filteredQuotes.slice(pageStart, pageEnd);
            const pageIds = new Set(pageSlice.map(q => getQuoteKey(q)));

            // Ensure pagination controls exist (insert above the list container)
            (function ensurePaginationControls() {
              let pagEl = document.getElementById(paginationId);
              if (!pagEl) {
                pagEl = document.createElement('div');
                pagEl.id = paginationId;
                pagEl.className = 'flex items-center gap-2 px-2 py-2 text-sm';
                // simple controls: prev, info, next, pageSize
                pagEl.innerHTML = `
                  <button id="production-page-prev" class="px-2 py-1 border rounded">Prev</button>
                  <div id="production-page-info" class="text-xs text-gray-600">Trang ${container._prodPage} / ${totalPages} (${totalMatches})</div>
                  <button id="production-page-next" class="px-2 py-1 border rounded">Next</button>
                  <div class="ml-auto">Số hàng: <select id="production-page-size" class="border px-1 py-0.5">${pageSizeOptions.map(s => `<option value="${s}" ${s===container._prodPageSize? 'selected':''}>${s}</option>`).join('')}</select></div>
                `;
                // insert pagEl above the header row if possible (user requested pagination above header)
                const header = container.previousElementSibling;
                if (header && header.parentNode) header.parentNode.insertBefore(pagEl, header);
                else if (container && container.parentNode) container.parentNode.insertBefore(pagEl, container);
              } else {
                // update info and page-size options
                const info = pagEl.querySelector('#production-page-info');
                if (info) info.textContent = `Trang ${container._prodPage} / ${totalPages} (${totalMatches})`;
                const ps = pagEl.querySelector('#production-page-size');
                if (ps) ps.value = String(container._prodPageSize);
              }

              // bind controls once
              try {
                if (!pagEl._bound) {
                  pagEl._bound = true;
                  const prevBtn = pagEl.querySelector('#production-page-prev');
                  const nextBtn = pagEl.querySelector('#production-page-next');
                  const sizeSel = pagEl.querySelector('#production-page-size');
                  if (prevBtn) prevBtn.addEventListener('click', () => { container._prodPage = Math.max(1, (container._prodPage||1) - 1); renderProductionQuotes(productionModalFilteredQuotes); });
                  if (nextBtn) nextBtn.addEventListener('click', () => { const tp = Math.max(1, Math.ceil((productionModalFilteredQuotes || []).length / container._prodPageSize)); container._prodPage = Math.min(tp, (container._prodPage||1) + 1); renderProductionQuotes(productionModalFilteredQuotes); });
                  if (sizeSel) sizeSel.addEventListener('change', function() { container._prodPageSize = parseInt(this.value, 10) || defaultPageSize; container._prodPage = 1; renderProductionQuotes(productionModalFilteredQuotes); });
                }
              } catch (e) { /* ignore */ }
            })();

            // Incremental DOM rendering: build rows once and then show/hide by diffing ids
            // Store per-container maps on the container element to avoid globals
            // IMPORTANT: If filteredQuotes is empty after filtering, reset container state
            // to prevent stale incremental DOM from blocking fresh renders
            if (filteredQuotes.length === 0 && container._prodRowMap) {
              container._prodRowMap.clear();
              container._prodIndex = [];
              container._prodVisible.clear();
              container._prodSearchIndex.clear();
              container.innerHTML = '<p class="text-gray-500 text-center py-6 text-sm">Không có báo giá nào</p>';
              return;
            }
            
            if (!container._prodRowMap) {
              container._prodRowMap = new Map(); // id -> element
              container._prodIndex = []; // array of ids in insertion order
              container._prodVisible = new Set();
              container._prodSearchIndex = new Map();
              // build DOM nodes
              container.innerHTML = '';
              const frag = document.createDocumentFragment();
              filteredQuotes.forEach((quote, idx) => {
                const key = getQuoteKey(quote);
                const el = document.createElement('div');
                el.className = 'quote-row flex items-center text-[12px] px-2 py-4 border-b hover:bg-gray-50 cursor-pointer';
                if (selectedQuotes.has(key)) el.classList.add('bg-blue-50');
                // Visual indicator for quotes requesting recreation (đã báo hủy, chờ tạo đơn mới)
                const isRecreateRequest = !!(quote && quote.__recreateRequested);
                if (isRecreateRequest) el.classList.add('border-l-4', 'border-l-orange-500', 'bg-orange-50');
                el.dataset.quoteId = key;
                // build inner structure
                const recreateLabel = isRecreateRequest ? '<span class="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded ml-1" title="Đã báo hủy, chờ tạo đơn mới">TẠO ĐƠN MỚI</span>' : '';
                el.innerHTML = `
                  <div class="w-6 flex items-center justify-center">
                    <input type="checkbox" class="quote-checkbox w-3.5 h-3.5 text-blue-600" data-quote-id="${key}" ${selectedQuotes.has(key) ? 'checked' : ''} />
                  </div>
                  <div class="w-20 text-gray-500 select-none">${idx + 1}</div>
                  <div class="w-20 whitespace-nowrap font-medium">${quote.quote_code || '-'}${recreateLabel}</div>
                  <div class="w-20 whitespace-nowrap">${quote.area || '-'}</div>
                  <div class="w-24 text-center whitespace-nowrap">${quote.spo_number || '-'}</div>
                  <div class="w-24 ml-3 whitespace-nowrap">${quote.outlet_code || '-'}</div>
                  <div class="w-72 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">${quote.outlet_name || '-'}</div>
                  <div class="w-36 whitespace-nowrap overflow-hidden text-ellipsis text-gray-700">${quote.sale_name || ''}</div>
                  <div class="w-20 text-right font-semibold text-blue-600 whitespace-nowrap">${formatCurrency(parseMoney(quote.total_amount) || 0)}</div>
                  <div class="w-52 pl-2 whitespace-nowrap"><span class="px-1.5 py-0.5 rounded">${quote.spo_number ? (quote.spo_status || '') : 'Chưa có SPO'}</span></div>
                `;
                // attach handlers
                const checkbox = el.querySelector('input.quote-checkbox');
                if (checkbox) {
                  checkbox.addEventListener('change', function(e) {
                    const quoteId = String(this.dataset.quoteId);
                    if (this.checked) selectedQuotes.add(quoteId);
                    else selectedQuotes.delete(quoteId);
                    updateSelectedCount();
                    updateSelectedSummary();
                    const row = this.closest('.quote-row');
                    if (row) row.classList.toggle('bg-blue-50', this.checked);
                    updateSelectAllState();
                  });
                }
                el.addEventListener('click', function(e) {
                  if (e.target.closest('input.quote-checkbox')) return;
                  const quoteId = this.dataset.quoteId;
                  const cb = this.querySelector('input.quote-checkbox');
                  const willSelect = !selectedQuotes.has(quoteId);
                  if (willSelect) { selectedQuotes.add(quoteId); if (cb) cb.checked = true; }
                  else { selectedQuotes.delete(quoteId); if (cb) cb.checked = false; }
                  this.classList.toggle('bg-blue-50', willSelect);
                  updateSelectedCount();
                  updateSelectedSummary();
                  updateSelectAllState();
                });

                // compute and store searchable text on element for potential client-side filters

                try {
                  const parts = [quote.outlet_name, quote.outlet_code, quote.quote_code || quote.quoteCode, quote.spo_number, quote.area, quote.sale_name, quote.ss_name];
                  el.dataset.search = parts.map(p => normalizeForSearch(p)).filter(Boolean).join(' ');
                } catch (e) { el.dataset.search = '' }
                // populate container-level search index
                try { container._prodSearchIndex.set(key, el.dataset.search || ''); } catch (e) { /* ignore */ }

                // hide rows not on current page
                if (!pageIds.has(key)) {
                  el.classList.add('hidden');
                } else {
                  container._prodVisible.add(key);
                }
                frag.appendChild(el);
                container._prodRowMap.set(key, el);
                container._prodIndex.push(key);
              });
              container.appendChild(frag);
            } else {
              // Container already built: compute which ids should be visible based on current page slice
              const newVisible = pageIds; // show only ids on the current page
              // add any new rows that don't exist yet
              const toCreate = [];
              newVisible.forEach(id => { if (!container._prodRowMap.has(id)) toCreate.push(id); });
              if (toCreate.length) {
                const frag2 = document.createDocumentFragment();
                toCreate.forEach(id => {
                  // find quote data from 'quotes' param or currentQuotes
                  const quote = (filteredQuotes.find(q => getQuoteKey(q) === id) || currentQuotes.find(q => getQuoteKey(q) === id));
                  if (!quote) return;
                  const idx = container._prodIndex.length + 1;
                  const el = document.createElement('div');
                  el.className = 'quote-row flex items-center text-[12px] px-2 py-4 border-b hover:bg-gray-50 cursor-pointer';
                  if (selectedQuotes.has(id)) el.classList.add('bg-blue-50');
                  // Visual indicator for quotes requesting recreation
                  const isRecreateRequest = !!(quote && quote.__recreateRequested);
                  if (isRecreateRequest) el.classList.add('border-l-4', 'border-l-orange-500', 'bg-orange-50');
                  el.dataset.quoteId = id;
                  const recreateLabel = isRecreateRequest ? '<span class="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded ml-1" title="Đã báo hủy, chờ tạo đơn mới">TẠO ĐƠN MỚI</span>' : '';
                  el.innerHTML = `
                    <div class="w-6 flex items-center justify-center">
                      <input type="checkbox" class="quote-checkbox w-3.5 h-3.5 text-blue-600" data-quote-id="${id}" ${selectedQuotes.has(id) ? 'checked' : ''} />
                    </div>
                    <div class="w-20 text-gray-500 select-none">${idx}</div>
                    <div class="w-20 whitespace-nowrap font-medium">${quote.quote_code || '-'}${recreateLabel}</div>
                    <div class="w-20 whitespace-nowrap">${quote.area || '-'}</div>
                    <div class="w-24 text-center whitespace-nowrap">${quote.spo_number || '-'}</div>
                    <div class="w-24 ml-3 whitespace-nowrap">${quote.outlet_code || '-'}</div>
                    <div class="w-72 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">${quote.outlet_name || '-'}</div>
                    <div class="w-36 whitespace-nowrap overflow-hidden text-ellipsis text-gray-700">${quote.sale_name || ''}</div>
                    <div class="w-20 text-right font-semibold text-blue-600 whitespace-nowrap">${formatCurrency(parseMoney(quote.total_amount) || 0)}</div>
                    <div class="w-52 pl-2 whitespace-nowrap"><span class="px-1.5 py-0.5 rounded">${quote.spo_number ? (quote.spo_status || '') : 'Chưa có SPO'}</span></div>
                  `;
                  const checkbox = el.querySelector('input.quote-checkbox');
                  if (checkbox) checkbox.addEventListener('change', function() {
                    const quoteId = String(this.dataset.quoteId);
                    if (this.checked) selectedQuotes.add(quoteId); else selectedQuotes.delete(quoteId);
                    updateSelectedCount(); updateSelectedSummary();
                    const row = this.closest('.quote-row'); if (row) row.classList.toggle('bg-blue-50', this.checked);
                    updateSelectAllState();
                  });
                  el.addEventListener('click', function(e) {
                    if (e.target.closest('input.quote-checkbox')) return;
                    const quoteId = this.dataset.quoteId;
                    const cb = this.querySelector('input.quote-checkbox');
                    const willSelect = !selectedQuotes.has(quoteId);
                    if (willSelect) { selectedQuotes.add(quoteId); if (cb) cb.checked = true; } else { selectedQuotes.delete(quoteId); if (cb) cb.checked = false; }
                    this.classList.toggle('bg-blue-50', willSelect);
                    updateSelectedCount(); updateSelectedSummary(); updateSelectAllState();
                  });
                  try { const parts = [quote.outlet_name, quote.outlet_code, quote.quote_code || quote.quoteCode, quote.spo_number, quote.area, quote.sale_name, quote.ss_name]; el.dataset.search = parts.map(p => normalizeForSearch(p)).filter(Boolean).join(' '); } catch(e){ el.dataset.search=''; }
                  try { container._prodSearchIndex.set(id, el.dataset.search || ''); } catch (e) { /* ignore */ }
                  frag2.appendChild(el);
                  container._prodRowMap.set(id, el);
                  container._prodIndex.push(id);
                });
                container.appendChild(frag2);
              }

              // compute diffs
              const currentlyVisible = container._prodVisible || new Set();
              const toHide = [];
              const toShow = [];
              currentlyVisible.forEach(id => { if (!newVisible.has(id)) toHide.push(id); });
              newVisible.forEach(id => { if (!currentlyVisible.has(id)) toShow.push(id); });

              if (toHide.length || toShow.length) {
                window.requestAnimationFrame(() => {
                  toHide.forEach(id => { const r = container._prodRowMap.get(id); if (r) r.classList.add('hidden'); container._prodVisible.delete(id); });
                  toShow.forEach(id => { const r = container._prodRowMap.get(id); if (r) r.classList.remove('hidden'); container._prodVisible.add(id); });
                });
              }
            }

            const __tHtml1 = (__qcagProfile && window.performance && typeof performance.now === 'function') ? performance.now() : 0;
            const __tDom1 = (__qcagProfile && window.performance && typeof performance.now === 'function') ? performance.now() : __tHtml1;

            // Select-all control (footer button toggling visible rows)
            const selectAllBtn = document.getElementById('production-select-all-btn');
            function updateSelectAllState() {
              if (!selectAllBtn) return;
              const allCheckboxes = Array.from(container.querySelectorAll('.quote-checkbox'));
              const checkboxes = allCheckboxes.filter(cb => { const r = cb.closest('.quote-row'); return r && !r.classList.contains('hidden'); });
              if (!checkboxes || checkboxes.length === 0) {
                selectAllBtn.disabled = true;
                selectAllBtn.textContent = 'Chọn tất cả';
                return;
              }
              selectAllBtn.disabled = false;
              const total = checkboxes.length;
              const checkedCount = checkboxes.filter(cb => cb.checked).length;
              if (checkedCount === total) {
                selectAllBtn.textContent = 'Bỏ chọn tất cả';
              } else if (checkedCount === 0) {
                selectAllBtn.textContent = 'Chọn tất cả';
              } else {
                selectAllBtn.textContent = `Chọn tất cả (${total - checkedCount})`;
              }
            }
            // initialize state
            updateSelectAllState();
            if (selectAllBtn && !selectAllBtn._bound) {
              selectAllBtn._bound = true;
                selectAllBtn.addEventListener('click', function() {
                const allCheckboxes = Array.from(container.querySelectorAll('.quote-checkbox'));
                const checkboxes = allCheckboxes.filter(cb => { const r = cb.closest('.quote-row'); return r && !r.classList.contains('hidden'); });
                if (!checkboxes || checkboxes.length === 0) return;
                const total = checkboxes.length;
                const checkedCount = checkboxes.filter(cb => cb.checked).length;
                const willSelectAll = checkedCount !== total;
                checkboxes.forEach(cb => {
                  const id = String(cb.dataset.quoteId);
                  cb.checked = willSelectAll;
                  if (willSelectAll) selectedQuotes.add(id);
                  else selectedQuotes.delete(id);
                  const row = cb.closest('.quote-row');
                  if (row) row.classList.toggle('bg-blue-50', willSelectAll);
                });
                updateSelectedCount();
                updateSelectedSummary();
                updateSelectAllState();
              });
            }

            if (__qcagProfile) {
              try {
                const __tEnd = (window.performance && typeof performance.now === 'function') ? performance.now() : __t0;
                console.log('renderProductionQuotes', {
                  inputCount: quotes.length,
                  filteredCount: filteredQuotes.length,
                  filterMs: Math.round(__tFilter1 - __tFilter0),
                  htmlMs: Math.round(__tHtml1 - __tHtml0),
                  domSetMs: Math.round(__tDom1 - __tHtml1),
                  totalMs: Math.round(__tEnd - __t0)
                });
              } catch (e) { /* ignore */ }
            }
        }

        function updateSelectedCount() {
            document.getElementById('selected-count').textContent = selectedQuotes.size;
            document.getElementById('create-production-list').disabled = selectedQuotes.size === 0;
            // Update stats bar figures too
            const selectedQuotesList = currentQuotes.filter(q => selectedQuotes.has(getQuoteKey(q)));
            const totalAmount = selectedQuotesList.reduce((sum, q) => sum + (parseMoney(q.total_amount) || 0), 0);
            const selCountEl = document.getElementById('selected-count-stat');
            const selTotalEl = document.getElementById('selected-total-stat');
            if (selCountEl) selCountEl.textContent = selectedQuotes.size;
            if (selTotalEl) selTotalEl.textContent = formatCurrency(totalAmount);
            const sideCount = document.getElementById('selected-count-side');
            if (sideCount) sideCount.textContent = selectedQuotes.size;
        }

        function updateSelectedSummary() {
            const listDiv = document.getElementById('selected-quotes-simple');
            if (!listDiv) return;
            const selectedQuotesList = currentQuotes.filter(q => selectedQuotes.has(getQuoteKey(q)));
            if (selectedQuotesList.length === 0) {
                listDiv.innerHTML = '<div class="text-[12px] text-gray-500">Chưa chọn báo giá nào</div>';
                return;
            }
            listDiv.innerHTML = selectedQuotesList.map(q => `
        <div class="flex items-center justify-between text-[12px] bg-white border rounded px-2 py-1 whitespace-nowrap">
          <span class="overflow-hidden text-ellipsis pr-2">${q.outlet_name || '-'}</span>
          <span class="text-gray-600">${q.sale_name || ''}</span>
        </div>
      `).join('');
        }

        // Close the production selection modal
        function closeProductionModal(preserveSelection = false) {
            const modal = document.getElementById('production-order-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            if (!preserveSelection) selectedQuotes.clear();
            ensureScrollLock();
        }

