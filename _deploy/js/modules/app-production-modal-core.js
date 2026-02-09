        // ===== PRODUCTION MODAL FILTER STATE (GLOBAL) =====
        // These must be global to persist across modal opens and allow event listeners to reference them correctly
        let productionModalAreaFilters = new Set();
        let productionModalApprovedOnly = false;
        let productionModalUnapprovedOnly = false;
        let productionModalActiveFilter = 'all';
        let productionModalTermForSelection = '';
        let productionModalQuotesToFilter = [];
        let productionModalFilteredQuotes = [];

        function openProductionOrderModal(options = {}) {
            const {
                preserveSelection = false, skipReload = false
            } = options;

            const __qcagProfile = (() => {
              try { return String(localStorage.getItem('QCAG_PROFILE_PRODUCTION_MODAL') || '') === '1'; } catch (e) { return false; }
            })();
            const __qcagT0 = (__qcagProfile && window.performance && typeof performance.now === 'function') ? performance.now() : 0;
            if (__qcagProfile) {
              try { console.groupCollapsed('[perf] openProductionOrderModal'); } catch (e) { /* ignore */ }
            }

            document.getElementById('production-order-modal').classList.remove('hidden');
            ensureScrollLock();
            // Setup tab handlers for production modal (only once)
            setupProductionModalTabHandlers();
            // Update pending count badge
            updatePendingCount();
            // Reset selection state unless preserving (e.g., when returning from list modal)
            if (!preserveSelection) {
              selectedQuotes.clear();
            }
            // ===== VIEW MODE + PAGINATION & RENDERING =====
            let viewMode = 'list'; // 'list' | 'outlet'
            window.currentViewInProductionModal = viewMode; // Track globally
            let listPage = 1;
            let outletPage = 1;
            const PER_PAGE = 100;
            let searchTerm = '';

            function paginate(arr, page, perPage) {
              const total = arr.length;
              const totalPages = Math.max(1, Math.ceil(total / perPage));
              const safePage = Math.min(Math.max(1, page), totalPages);
              const start = (safePage - 1) * perPage;
              const end = start + perPage;
              return { page: safePage, totalPages, slice: arr.slice(start, end), total, start: start + 1, end: Math.min(end, total) };
            }

            function updatePaginationUI(pageInfo) {
              const wrap = document.getElementById('pagination-container');
              const info = document.getElementById('pagination-info');
              const prev = document.getElementById('prev-page');
              const next = document.getElementById('next-page');
              const input = document.getElementById('pagination-current-input');
              const total = document.getElementById('pagination-total');
              if (!pageInfo) { wrap.classList.add('hidden'); return; }
              wrap.classList.remove('hidden');
              info.textContent = `Hiển thị ${pageInfo.start}-${pageInfo.end}/${pageInfo.total}`;
              if (prev) prev.disabled = pageInfo.page <= 1;
              if (next) next.disabled = pageInfo.page >= pageInfo.totalPages;
              if (input) {
                input.value = pageInfo.page;
                input.min = 1;
                input.max = pageInfo.totalPages;
              }
              if (total) {
                total.textContent = pageInfo.totalPages;
              }
            }

            function setPaginationHandlers(getPageInfo, setPage, renderFn) {
              const prev = document.getElementById('prev-page');
              const next = document.getElementById('next-page');
              const input = document.getElementById('pagination-current-input');

              if (prev) {
                prev.onclick = () => {
                  const pi = getPageInfo();
                  if (pi.page > 1) {
                    setPage(pi.page - 1);
                    renderFn();
                  }
                };
              }

              if (next) {
                next.onclick = () => {
                  const pi = getPageInfo();
                  if (pi.page < pi.totalPages) {
                    setPage(pi.page + 1);
                    renderFn();
                  }
                };
              }

              if (input) {
                const commitInput = () => {
                  const pi = getPageInfo();
                  const value = parseInt(input.value, 10);
                  if (!Number.isFinite(value)) {
                    input.value = pi.page;
                    return;
                  }
                  const target = Math.min(Math.max(1, value), pi.totalPages);
                  if (target !== pi.page) {
                    setPage(target);
                    renderFn();
                  } else {
                    input.value = pi.page;
                  }
                };
                input.onkeydown = (event) => {
                  if (event.key === 'Enter') {
                    commitInput();
                  }
                };
                input.onblur = commitInput;
              }
            }

            function updateMainList() {
              if (viewMode === 'list') {
                renderListView();
              } else {
                renderOutletView();
              }
            }

            function filterQuotesBase(quotes) {
              const term = (searchTerm || '').toLowerCase().trim();
              if (!term) return quotes;
              return quotes.filter(q => {
                const outletName = String(q && q.outlet_name || '').toLowerCase();
                const outletCode = String(q && q.outlet_code || '').toLowerCase();
                const area = String(q && q.area || '').toLowerCase();
                const spo = String(q && q.spo_number || '').toLowerCase();
                let quoteCode = '';
                try {
                  quoteCode = String((typeof formatQuoteCode === 'function' ? formatQuoteCode(q) : (q && q.quote_code)) || '');
                } catch (e) {
                  quoteCode = String(q && q.quote_code || '');
                }
                quoteCode = quoteCode.toLowerCase();
                let orderNo = '';
                try {
                  orderNo = String((typeof getQcagOrderNumber === 'function' ? getQcagOrderNumber(q) : '') || (q && (q.order_number || q.qcag_order_number)) || '');
                } catch (e) {
                  orderNo = String(q && (q.order_number || q.qcag_order_number) || '');
                }
                orderNo = orderNo.toLowerCase();
                return (
                  outletName.includes(term) ||
                  outletCode.includes(term) ||
                  area.includes(term) ||
                  quoteCode.includes(term) ||
                  spo.includes(term) ||
                  orderNo.includes(term)
                );
              });
            }

            function renderListView() {
              const container = document.getElementById('quotes-list');
              let list = [...currentQuotes];
              // newest first
              list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
              list = filterQuotesBase(list);
              const pi = paginate(list, listPage, PER_PAGE);
              listPage = pi.page;
              updatePaginationUI(pi);
              window.currentViewInProductionModal = 'list'; // Update global tracker

              if (pi.total === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">Chưa có báo giá nào</p>';
                return;
              }

              container.innerHTML = `
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mã BG</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Khu Vực</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SPO</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">OutletCode</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tên Outlet</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sale</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tiền</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status SPO</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status QCAG</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Số ĐH</th>
                      <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    ${pi.slice.map((quote, idxOnPage) => {
                      const idxGlobal = (pi.start - 1) + idxOnPage + 1; // natural numbering across all
                      const items = JSON.parse(quote.items || '[]');
                      const rowKey = getQuoteKey(quote);
                      const qcag = quote.qcag_status || '-';
                      const isProduced = String(qcag || '').includes('Đã ra đơn');
                      return `
                        <tr class="hover:bg-gray-50 cursor-pointer" data-row-key="${rowKey}" onclick="toggleQuoteDetails('${rowKey}')">
                          <td class="px-4 py-6 whitespace-nowrap text-sm font-semibold text-gray-900">${quote.qcag_status === 'Hủy' ? `<span class="text-red-600">${formatQuoteCode(quote) || idxGlobal}</span>` : formatQuoteCode(quote) || idxGlobal}</td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm text-gray-900">${quote.area || ''}</td>
                          <td class="px-4 py-3 whitespace-nowrap text-sm">
                            ${quote.sale_type === 'TBA' ? 'TBA' : 'SR'}
                            ${quote.sale_name ? `<div class="text-xs text-gray-600 mt-1">${quote.sale_name}</div>` : ''}
                          </td>
                          </td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm text-gray-900">${quote.outlet_code || ''}</td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm text-gray-900">${quote.outlet_name || ''}</td>
                          <td class="px-4 py-3 whitespace-nowrap text-sm">
                            ${quote.sale_type === 'TBA' ? 'TBA' : 'SR'}
                            ${quote.sale_name ? `<div class="text-xs text-gray-600 mt-1">${quote.sale_name}</div>` : ''}
                          </td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm font-semibold text-blue-600">${formatCurrency(parseMoney(quote.total_amount)||0)}</td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm">
                            <div onclick="event.stopPropagation(); editSPOStatus('${quote.__backendId}')" class="cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <span class="px-2 py-1 text-xs font-medium rounded ${getSPOStatusClass(quote.spo_status)}">${getSPOStatusText(quote.spo_status)}</span>
                            </div>
                          </td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm">${renderQCAGStatusHtml(quote)}</td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm text-gray-900">${getQcagOrderNumber(quote) || ''}</td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm">
                            ${(() => {
                              const isCancelled = quote.qcag_status === 'Hủy';
                              return isCancelled ? `<button onclick="event.stopPropagation(); openRedoModal('${rowKey}')" class="bg-green-600 text-white hover:bg-green-700 font-medium action-fixed-width h-7"><i class="fas fa-redo"></i></button>` : isProduced ? `<button onclick="event.stopPropagation(); openReportCancelModal('${rowKey}')" class="text-yellow-900 hover:text-yellow-700 font-medium action-fixed-width" title="Báo huỷ"><svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6"/></svg></button>` : `<button onclick="event.stopPropagation(); deleteQuote('${rowKey}')" class="text-red-600 hover:text-red-800 font-medium action-fixed-width" title="Xóa"><svg xmlns=\"http://www.w3.org/2000/svg\" class=\"w-4 h-4\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6\"/></svg></button>`;
                            })()}
                          </td>
                        </tr>
                        <tr id="details-${rowKey}" class="hidden">
                          <td colspan="11" class="px-4 py-4 bg-gray-50">
                            <div class="flex gap-3">
                              <!-- Cột trái 75%: Chi tiết báo giá -->
                              <div class="flex-[3] space-y-4">
                                <div class="flex justify-between items-start gap-6">
                                  <div class="text-sm space-y-2">
                                    <div class="flex flex-wrap gap-4">
                                      <div>
                                        <span class="font-medium text-gray-700">Chức vụ:</span>
                                        ${quote.sale_type === 'TBA' ? ' <span class="text-orange-800">TBA</span>' : ' <span class="text-gray-700">SR</span>'}
                                      </div>
                                      ${quote.sale_code ? `<div><span class=\"font-medium text-gray-700\">Mã Sale:</span> <span class=\"text-gray-600\">${quote.sale_code}</span></div>` : ''}
                                      ${quote.sale_name ? `<div><span class=\"font-medium text-gray-700\">Tên Sale:</span> <span class=\"text-gray-600\">${quote.sale_name}</span></div>` : ''}
                                      ${quote.ss_name ? `<div><span class=\"font-medium text-gray-700\">Tên SS:</span> <span class=\"text-gray-600\">${quote.ss_name}</span></div>` : ''}
                                    </div>
                                    <div class="flex flex-wrap gap-4 mt-2">
                                      <div>
                                        <span class="font-medium text-gray-700">Ngày tạo:</span>
                                        <span class="text-gray-600">${new Date(quote.created_at).toLocaleDateString('vi-VN')}</span>
                                      </div>
                                      ${quote.spo_number ? `<div><span class=\"font-medium text-gray-700\">Số SPO:</span> <span class=\"text-blue-600 font-medium\">${quote.spo_number}</span></div>` : ''}
                                      ${quote.address && quote.address !== 'Địa chỉ sẽ hiển thị tự động khi nhập' ? `<div><span class=\"font-medium text-gray-700\">Địa chỉ:</span> <span class=\"text-gray-600\">${quote.address}</span></div>` : ''}
                                    </div>
                                  </div>
                                  ${(() => { 
                                    let imgs = []; 
                                    try { imgs = JSON.parse(quote.images || '[]'); } catch (e) { imgs = []; }
                                    if (!Array.isArray(imgs) || !imgs.length) return '<div class=\"text-xs text-gray-400\">Không có hình</div>';
                                    return `<div class=\"w-64 flex-shrink-0\"><h4 class=\"font-semibold text-gray-800 mb-2 text-sm\">Hình ảnh (${imgs.length})</h4><div class=\"grid grid-cols-2 gap-2\">${imgs.map(im => `<div class=\"border rounded bg-white overflow-hidden cursor-pointer\" onclick=\"event.stopPropagation(); openImageViewer('${im.data}','${(im.name||'').replace(/'/g,'&#39;')}')\"><img src='${im.data}' alt='${(im.name||'').replace(/'/g,'&#39;')}' class=\"w-full h-24 object-cover\"></div>`).join('')}</div></div>`; 
                                  })()}
                                </div>
                                <div class="space-y-3">
                                  <h4 class="font-semibold text-gray-800">Chi Tiết Hạng Mục (${items.length} mục)</h4>
                                <div class="overflow-x-auto">
                                  <table class="min-w-full text-sm">
                                    <thead class="bg-gray-100">
                                      <tr>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Code</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Nội dung</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Brand</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Ngang x Cao</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">SL</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">ĐVT</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Đơn giá</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">Thành tiền</th>
                                      </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-200">
                                      ${items.map(item => `
                                        <tr class="hover:bg-gray-50">
                                          <td class="px-3 py-2 text-gray-900 font-medium">${item.code}</td>
                                          <td class="px-3 py-2 text-gray-700">${item.content}</td>
                                          <td class="px-3 py-2 text-gray-600">${item.brand || '-'}</td>
                                          <td class="px-3 py-2 text-gray-600">${item.width && item.height ? `${item.width}m × ${item.height}m` : '-'}</td>
                                          <td class="px-3 py-2 text-gray-900">${item.quantity}</td>
                                          <td class="px-3 py-2 text-gray-600">${item.unit}</td>
                                          <td class="px-3 py-2 text-gray-900">${formatCurrency(parseMoney(item.price) || 0)}</td>
                                          <td class="px-3 py-2 text-blue-600 font-semibold">${item.total}</td>
                                        </tr>
                                      `).join('')}
                                    </tbody>
                                  </table>
                                </div>
                                  <div class="flex justify-end">
                                    <span class="text-lg font-bold text-blue-600">Tổng cộng: ${formatCurrency(parseMoney(quote.total_amount)||0)}</span>
                                  </div>
                                </div>
                              </div>
                              <!-- Cột phải 25%: Xem nhanh ghi chú -->
                              <div class="flex-1 notes-preview" data-notes-preview="${rowKey}">
                                ${renderNotesPreviewHTML(quote)}
                              </div>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              `;

              setPaginationHandlers(
                () => paginate(filterQuotesBase([...currentQuotes].sort((a,b)=> new Date(b.created_at)-new Date(a.created_at))), listPage, PER_PAGE),
                (p) => { listPage = p; },
                () => renderListView()
              );
            }
            window.renderProductionListView = renderListView; // Export to global

            function renderOutletView() {
              window.currentViewInProductionModal = 'outlet'; // Update global tracker
              const container = document.getElementById('quotes-list');
              // group by outlet_code
              const map = new Map();
              for (const q of currentQuotes) {
                const code = q.outlet_code || 'UNKNOWN';
                if (!map.has(code)) map.set(code, []);
                map.get(code).push(q);
              }
              // build groups and sort by latest quote time desc
              let groups = Array.from(map.entries()).map(([code, arr]) => {
                const sorted = [...arr].sort((a,b)=> new Date(b.created_at)-new Date(a.created_at));
                const latest = sorted[0];
                return {
                  outlet_code: code,
                  outlet_name: latest?.outlet_name || '',
                  area: latest?.area || '',
                  address: latest?.address || '',
                  quotes: sorted
                };
              });
              // filter by search
              const term = (searchTerm||'').toLowerCase().trim();
              if (term) {
                groups = groups.filter(g =>
                  (g.outlet_name||'').toLowerCase().includes(term) ||
                  (g.outlet_code||'').toLowerCase().includes(term) ||
                  (g.area||'').toLowerCase().includes(term)
                );
              }
              // sort by latest created_at
              groups.sort((a,b)=> new Date(a.quotes[0]?.created_at||0) < new Date(b.quotes[0]?.created_at||0) ? 1 : -1);

              const pi = paginate(groups, outletPage, PER_PAGE);
              outletPage = pi.page;
              updatePaginationUI(pi);

              if (pi.total === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">Không có Outlet nào</p>';
                return;
              }

              container.innerHTML = `
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Khu Vực</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outlet Code</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên Outlet</th>
                      <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Số lượng báo giá</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    ${pi.slice.map((g, idxOnPage) => {
                      const stt = (pi.start - 1) + idxOnPage + 1;
                      const key = `outlet_${g.outlet_code.replace(/[^a-zA-Z0-9_-]/g,'_')}`;
                      const addr = (g.address && g.address !== 'Địa chỉ sẽ hiển thị tự động khi nhập') ? g.address : '';
                      return `
                        <tr class="hover:bg-gray-50">
                          <td class="px-4 py-6 whitespace-nowrap text-sm text-gray-900">${stt}</td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm text-gray-900">${g.area}</td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm text-gray-900">${g.outlet_code}</td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm text-gray-900">
                            <div class="font-medium">${g.outlet_name}</div>
                            ${addr ? `<div class=\"text-xs text-gray-500\">${addr}</div>` : ''}
                          </td>
                          <td class="px-4 py-6 whitespace-nowrap text-sm text-right">
                            <button class="text-blue-600 hover:underline" onclick="toggleOutletQuotes('${key}')">${g.quotes.length}</button>
                          </td>
                        </tr>
                        <tr id="${key}" class="hidden">
                          <td colspan="5" class="px-4 py-4 bg-gray-50">
                            ${renderOutletQuotesTable(g.quotes)}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              `;

              setPaginationHandlers(
                () => paginate(groups, outletPage, PER_PAGE),
                (p) => { outletPage = p; },
                () => renderOutletView()
              );
            }
            window.renderProductionOutletView = renderOutletView; // Export to global

            function renderOutletQuotesTable(quotes) {
              const rows = quotes.map((quote, idx) => {
                const quoteCode = formatQuoteCode(quote) || (idx + 1);
                const isProduced = String(quote.qcag_status || '').includes('Đã ra đơn');
                return `
                  <tr class="hover:bg-white/60">
                    <td class="px-3 py-2 text-xs font-semibold text-gray-900">${quote.qcag_status === 'Hủy' ? `<span class="text-red-600">${quoteCode}</span>` : quoteCode}</td>
                    <td class="px-3 py-2 text-xs">${quote.area || ''}</td>
                    <td class="px-3 py-2 text-xs">${quote.spo_number || ''}</td>
                    <td class="px-3 py-2 text-xs">${quote.qcag_status === 'Hủy' ? `<span class="text-red-600">${quote.outlet_code || ''}</span>` : quote.outlet_code || ''}</td>
                    <td class="px-3 py-2 text-xs">${quote.qcag_status === 'Hủy' ? `<span class="text-red-600">${quote.outlet_name || ''}</span>` : quote.outlet_name || ''}</td>
                    <td class="px-3 py-2 text-xs">
                      <span class="px-1.5 py-0.5 text-[10px] font-medium rounded ${quote.sale_type === 'TBA' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}">${quote.sale_type || 'Sale (SR)'}</span>
                      ${quote.sale_name ? `<div class=\"text-[10px] text-gray-600 mt-1\">${quote.sale_name}</div>` : ''}
                    </td>
                    <td class="px-3 py-2 text-xs text-right text-blue-600 font-medium">${formatCurrency(parseMoney(quote.total_amount)||0)}</td>
                    <td class="px-3 py-2 text-xs">
                      <span class="px-1.5 py-0.5 rounded ${getSPOStatusClass(quote.spo_status)}">${getSPOStatusText(quote.spo_status)}</span>
                    </td>
                    <td class="px-3 py-2 text-xs">${renderQCAGStatusHtml(quote)}</td>
                    <td class="px-3 py-2 text-xs">${getQcagOrderNumber(quote) || ''}</td>
                    <td class="px-3 py-2 text-xs">
                      <div class="inline-flex items-center gap-2">
                        ${(() => {
                          const isCancelled = quote.qcag_status === 'Hủy';
                          const shouldShowCancel3 = isProduced || (computeQCAGStatus ? computeQCAGStatus(quote).status === 'Chờ tạo đơn' : false) || hasEverHadOrder(quote);
                          return isCancelled ? `<button onclick="event.stopPropagation(); openRedoModal('${getQuoteKey(quote)}')" class="px-2 py-1 text-xs bg-green-600 text-white rounded action-fixed-width h-7 hover:bg-green-700" title="Làm lại"><i class="fas fa-redo"></i></button>` : shouldShowCancel3 ? `<button onclick="event.stopPropagation(); openReportCancelModal('${getQuoteKey(quote)}')" class="px-2 py-1 text-xs bg-yellow-400 text-yellow-900 rounded action-fixed-width hover:bg-yellow-500 hover:text-yellow-900" title="Báo huỷ"><svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6"/></svg></button>` : `<button onclick="event.stopPropagation(); deleteQuote('${getQuoteKey(quote)}')" class="px-2 py-1 text-xs bg-red-600 text-white rounded action-fixed-width" title="Xóa"><svg xmlns=\"http://www.w3.org/2000/svg\" class=\"w-4 h-4\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6\"/></svg></button>`;
                        })()}
                        ${(() => { const c = getQuoteNotes(quote).length; const countClass = c > 0 ? 'note-btn-count has-notes' : 'note-btn-count'; const pdfBtn = `<button onclick=\"event.stopPropagation(); exportQuoteAsPdf('${getQuoteKey(quote)}')\" class=\"px-2 py-1 text-xs bg-indigo-600 text-white rounded inline-flex items-center gap-1\" title=\"PDF\">PDF</button>`; return `${pdfBtn}<button onclick=\"event.stopPropagation(); openQuoteNotesModal('${getQuoteKey(quote)}')\" data-note-btn=\"${getQuoteKey(quote)}\" class=\"note-btn note-btn-compact\" title=\"Ghi chú\"><span class=\"note-btn-main\"></span><span class=\"${countClass}\">${c || 0}</span></button>`; })()}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('');
              return `
                <div class="overflow-x-auto">
                  <table class="min-w-full text-sm">
                    <thead class="bg-gray-100">
                      <tr>
                        <th class="px-3 py-2 text-left text-[11px] text-gray-600">Mã BG</th>
                        <th class="px-3 py-2 text-left text-[11px] text-gray-600">Khu Vực</th>
                        <th class="px-3 py-2 text-left text-[11px] text-gray-600">SPO</th>
                        <th class="px-3 py-2 text-left text-[11px] text-gray-600">OutletCode</th>
                        <th class="px-3 py-2 text-left text-[11px] text-gray-600">Tên Outlet</th>
                        <th class="px-3 py-2 text-left text-[11px] text-gray-600">Sale</th>
                        <th class="px-3 py-2 text-right text-[11px] text-gray-600">Tiền</th>
                        <th class="px-3 py-2 text-left text-[11px] text-gray-600">Status SPO</th>
                        <th class="px-3 py-2 text-left text-[11px] text-gray-600">Status QCAG</th>
                        <th class="px-3 py-2 text-left text-[11px] text-gray-600">Số ĐH</th>
                        <th class="px-3 py-2 text-left text-[11px] text-gray-600">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y">${rows}</tbody>
                  </table>
                </div>
              `;
            }

            window.toggleOutletQuotes = function(id) {
              const row = document.getElementById(id);
              if (!row) return;
              prepareCollapsibleRow(row);
              const shouldOpen = !row.classList.contains('open');
              const headerRow = row.previousElementSibling;
              const panel = row.querySelector('.collapsible');
              const stopPin = pinRowDuringAnimation(headerRow || row, panel);
              setCollapsibleState(row, shouldOpen);
            }

            // ===== Selection & Filtering for Production Modal =====
            const APPROVED = getApprovedSet();
            const PRODUCED = getProducedSet();
            // Base: start with all quotes (filters and toggles will narrow down)
            // Using global variables to maintain state across modal opens



            function applySelectionFilters() {
              let arr = [...productionModalQuotesToFilter];

              // Approved / unapproved toggles take precedence
              if (productionModalApprovedOnly) {
                // Require a SPO number as well as an approved status
                arr = arr.filter(q => (q.spo_number && /Approved|Checked Variation/i.test(String(q.spo_status || ''))));
              }
              if (productionModalUnapprovedOnly) {
                // Unapproved includes missing SPO or statuses that are not cancelled/rejected/accepted/finished/approved
                arr = arr.filter(q => (!q.spo_number) || !/cancel|reject|accept|finish|Approved|Checked Variation/i.test(String(q.spo_status || '')));
              }
              // Nếu không chọn trạng thái, hiển thị cả hai nhóm
              if (!productionModalApprovedOnly && !productionModalUnapprovedOnly) {
                arr = arr.filter(q => (q.spo_number && /Approved|Checked Variation/i.test(String(q.spo_status || ''))) || (!q.spo_number) || !/cancel|reject|accept|finish|Approved|Checked Variation/i.test(String(q.spo_status || '')));
              }

              // Specific status filter or selected
              if (productionModalActiveFilter === 'selected') {
                // Selected filter must show ALL selected quotes regardless of other filters.
                // Return the full selected set directly from currentQuotes.
                return currentQuotes.filter(q => selectedQuotes.has(getQuoteKey(q)));
              } else if (productionModalActiveFilter && productionModalActiveFilter !== 'all') {
                // If activeFilter matches one of the exact status strings, filter by it
                arr = arr.filter(q => q.spo_status === productionModalActiveFilter);
              }

              // Area multi-select
              if (productionModalAreaFilters && productionModalAreaFilters.size > 0) {
                arr = arr.filter(q => productionModalAreaFilters.has(q.area));
              }

              // Search term
              if (productionModalTermForSelection) {
                const norm = (typeof normalizeForSearch === 'function') ? normalizeForSearch(productionModalTermForSelection) : String(productionModalTermForSelection || '').toLowerCase();
                try {
                  const c = document.getElementById('production-quotes-list');
                  if (c && c._prodSearchIndex && typeof c._prodSearchIndex.get === 'function') {
                    arr = arr.filter(q => {
                      try {
                        const k = getQuoteKey(q);
                        const s = String(c._prodSearchIndex.get(k) || '');
                        return s.indexOf(norm) !== -1;
                      } catch (e) { return false; }
                    });
                  } else {
                    const t = productionModalTermForSelection.toLowerCase();
                    arr = arr.filter(q => {
                      const outletName = String(q && q.outlet_name || '').toLowerCase();
                      const outletCode = String(q && q.outlet_code || '').toLowerCase();
                      const area = String(q && q.area || '').toLowerCase();
                      const saleName = String(q && q.sale_name || '').toLowerCase();
                      const ssName = String(q && q.ss_name || '').toLowerCase();
                      const spo = String(q && q.spo_number || '').toLowerCase();
                      let quoteCode = '';
                      try {
                        quoteCode = String((typeof formatQuoteCode === 'function' ? formatQuoteCode(q) : (q && q.quote_code)) || '');
                      } catch (e) {
                        quoteCode = String(q && q.quote_code || '');
                      }
                      quoteCode = quoteCode.toLowerCase();
                      let orderNo = '';
                      try {
                        orderNo = String((typeof getQcagOrderNumber === 'function' ? getQcagOrderNumber(q) : '') || (q && (q.order_number || q.qcag_order_number)) || '');
                      } catch (e) {
                        orderNo = String(q && (q.order_number || q.qcag_order_number) || '');
                      }
                      orderNo = orderNo.toLowerCase();
                      return (
                        outletName.includes(t) ||
                        outletCode.includes(t) ||
                        area.includes(t) ||
                        saleName.includes(t) ||
                        ssName.includes(t) ||
                        quoteCode.includes(t) ||
                        spo.includes(t) ||
                        orderNo.includes(t)
                      );
                    });
                  }
                } catch (e) {
                  // fallback to previous behavior
                  const t = productionModalTermForSelection.toLowerCase();
                  arr = arr.filter(q => String(q && (q.outlet_name || '')).toLowerCase().includes(t));
                }
              }
              return arr;
            }

            // Bind search - simplified to match main list behavior
            const sInput = document.getElementById('production-search');
            if (sInput && !sInput._bound) {
              sInput._bound = true;
              sInput._emptyTimer = null;
              
              sInput.addEventListener('input', function(e) {
                const v = (e.target.value || '').trim();
                if (!v) {
                  // Input is empty - schedule auto-restore after 1s
                  if (sInput._emptyTimer) clearTimeout(sInput._emptyTimer);
                  sInput._emptyTimer = setTimeout(() => {
                    sInput._emptyTimer = null;
                    productionModalTermForSelection = '';
                    try { const c = document.getElementById('production-quotes-list'); if (c) c._prodPage = 1; } catch (e) {}
                    // FORCE REBUILD: Clear cached state to ensure fresh render
                    const container = document.getElementById('production-quotes-list');
                    if (container) {
                      delete container._prodRowMap;
                      delete container._prodVisible;
                      delete container._prodBuilt;
                    }
                    // Apply current filters and render
                    const sorted = sortQuotes(applySelectionFilters(), 'newest');
                    productionModalFilteredQuotes = sorted;
                    renderProductionQuotes(sorted);
                    updateSelectedCount();
                  }, 1000);
                } else {
                  // Cancel pending auto-restore when user types
                  if (sInput._emptyTimer) {
                    clearTimeout(sInput._emptyTimer);
                    sInput._emptyTimer = null;
                  }
                }
              });

              sInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // Cancel any pending auto-restore
                  if (sInput._emptyTimer) {
                    clearTimeout(sInput._emptyTimer);
                    sInput._emptyTimer = null;
                  }
                  productionModalTermForSelection = (sInput.value || '').trim();
                  // Reset to page 1
                  try { const c = document.getElementById('production-quotes-list'); if (c) c._prodPage = 1; } catch (e) { /* ignore */ }
                  // FORCE REBUILD: Clear cached state to ensure fresh render
                  const container = document.getElementById('production-quotes-list');
                  if (container) {
                    delete container._prodRowMap;
                    delete container._prodVisible;
                    delete container._prodBuilt;
                  }
                  // Apply search term and other filters
                  const sorted = sortQuotes(applySelectionFilters(), 'newest');
                  productionModalFilteredQuotes = sorted;
                  renderProductionQuotes(sorted);
                  updateSelectedCount();
                }
              });

              // Allow quick clear with Escape key
              sInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  sInput.value = '';
                  productionModalTermForSelection = '';
                  try { const c = document.getElementById('production-quotes-list'); if (c) c._prodPage = 1; } catch (e) { /* ignore */ }
                  // FORCE REBUILD: Clear cached state
                  const container = document.getElementById('production-quotes-list');
                  if (container) {
                    delete container._prodRowMap;
                    delete container._prodVisible;
                    delete container._prodBuilt;
                  }
                  const sorted = sortQuotes(applySelectionFilters(), 'newest');
                  productionModalFilteredQuotes = sorted;
                  renderProductionQuotes(sorted);
                  updateSelectedCount();
                }
              });
            }

            // Multi toggles and filters - using global variables

            // Reset UI state when opening modal (unless preserving selection)
            if (typeof preserveSelection === 'undefined' || !preserveSelection) {
              // Clear visual active classes
              document.querySelectorAll('#production-order-modal .area-filter, #production-order-modal .toggle-filter').forEach(b => b.classList.remove('active'));
              document.querySelectorAll('#production-order-modal .filter-btn').forEach(b => b.classList.remove('active'));
              const allBtn = document.querySelector('#production-order-modal .filter-btn[data-filter="all"]');
              if (allBtn) allBtn.classList.add('active');

              // Reset search input and internal term
              const ps = document.getElementById('production-search');
              if (ps) { ps.value = ''; }
              productionModalTermForSelection = '';
              try { const c = document.getElementById('production-quotes-list'); if (c) c._prodPage = 1; } catch (e) { /* ignore */ }

              // Reset filter state vars
              productionModalAreaFilters.clear();
              productionModalApprovedOnly = false;
              productionModalUnapprovedOnly = false;
              productionModalActiveFilter = 'all';

              // Reset list to full current quotes
              productionModalQuotesToFilter = [...currentQuotes];
              productionModalFilteredQuotes = productionModalQuotesToFilter;

              // Re-render is done once at the end of openProductionOrderModal
              // to avoid doing the expensive filter/render twice.
              updateSelectedCount();
              updateSelectedSummary();
            }

            // Bind status filter buttons (single-selection, with toggle support for 'selected')
            document.querySelectorAll('#production-order-modal .filter-btn').forEach(btn => {
              if (btn._bound) return;
              btn._bound = true;
              btn.addEventListener('click', () => {
                const filterName = btn.dataset.filter || 'all';
                if (filterName === 'selected') {
                  // Toggle behavior for selected filter
                  const currentlyActive = btn.classList.contains('active');
                  document.querySelectorAll('#production-order-modal .filter-btn').forEach(b => b.classList.remove('active'));
                  if (!currentlyActive) {
                    btn.classList.add('active');
                    productionModalActiveFilter = 'selected';
                  } else {
                    // turning off 'selected'
                    productionModalActiveFilter = 'all';
                    // If no filters remain, reset to full list
                    if (!productionModalApprovedOnly && !productionModalUnapprovedOnly && productionModalAreaFilters.size === 0 && !productionModalTermForSelection) {
                      productionModalQuotesToFilter = [...currentQuotes];
                      productionModalFilteredQuotes = productionModalQuotesToFilter;
                      renderProductionQuotes(productionModalQuotesToFilter);
                      updateSelectedCount();
                      return;
                    }
                  }
                } else {
                  // normal single-selection behavior
                  document.querySelectorAll('#production-order-modal .filter-btn').forEach(b => b.classList.remove('active'));
                  btn.classList.add('active');
                  productionModalActiveFilter = filterName;
                }
                const sorted = sortQuotes(applySelectionFilters(), 'newest');
                productionModalFilteredQuotes = sorted;
                renderProductionQuotes(sorted);
                updateSelectedCount();
              });
            });

            // Area buttons (single-select now)
            document.querySelectorAll('#production-order-modal .area-filter').forEach(btn => {
              if (btn._bound) return;
              btn._bound = true;
              btn.addEventListener('click', () => {
                const area = btn.dataset.area;
                const currentlyActive = btn.classList.contains('active');
                // Clear previous selection (single-select behavior)
                document.querySelectorAll('#production-order-modal .area-filter').forEach(b => b.classList.remove('active'));
                productionModalAreaFilters.clear();
                // If it wasn't active, activate this one; otherwise leave none active (toggle off)
                if (!currentlyActive) {
                  productionModalAreaFilters.add(area);
                  btn.classList.add('active');
                }

                // If no filters remain active, reset to full list for consistency
                if (!productionModalApprovedOnly && !productionModalUnapprovedOnly && productionModalAreaFilters.size === 0 && !productionModalTermForSelection && productionModalActiveFilter === 'all') {
                  productionModalQuotesToFilter = [...currentQuotes];
                  productionModalFilteredQuotes = productionModalQuotesToFilter;
                  renderProductionQuotes(productionModalQuotesToFilter);
                  updateSelectedCount();
                  return;
                }

                const sorted = sortQuotes(applySelectionFilters(), 'newest');
                productionModalFilteredQuotes = sorted;
                renderProductionQuotes(sorted);
                updateSelectedCount();
              });
            });

            // Approved / Unapproved toggles
            const approvedBtn = document.getElementById('filter-approved');
            if (approvedBtn && !approvedBtn._bound) {
              approvedBtn._bound = true;
              approvedBtn.addEventListener('click', () => {
                productionModalApprovedOnly = !productionModalApprovedOnly;
                approvedBtn.classList.toggle('active', productionModalApprovedOnly);
                // Ensure unapproved is off when approved is enabled
                if (productionModalApprovedOnly) {
                  productionModalUnapprovedOnly = false;
                  const ub = document.getElementById('filter-unapproved');
                  if (ub) ub.classList.remove('active');
                }
                // If no filters remain active, reset to full list for consistency
                if (!productionModalApprovedOnly && !productionModalUnapprovedOnly && productionModalAreaFilters.size === 0 && !productionModalTermForSelection && productionModalActiveFilter === 'all') {
                  productionModalQuotesToFilter = [...currentQuotes];
                  productionModalFilteredQuotes = productionModalQuotesToFilter;
                  renderProductionQuotes(productionModalQuotesToFilter);
                  updateSelectedCount();
                  return;
                }
                const sorted = sortQuotes(applySelectionFilters(), 'newest');
                productionModalFilteredQuotes = sorted;
                renderProductionQuotes(sorted);
                updateSelectedCount();
              });
            }

            const unapprovedBtn = document.getElementById('filter-unapproved');
            if (unapprovedBtn && !unapprovedBtn._bound) {
              unapprovedBtn._bound = true;
              unapprovedBtn.addEventListener('click', () => {
                productionModalUnapprovedOnly = !productionModalUnapprovedOnly;
                unapprovedBtn.classList.toggle('active', productionModalUnapprovedOnly);
                // Ensure approved is off when unapproved is enabled
                if (productionModalUnapprovedOnly) {
                  productionModalApprovedOnly = false;
                  const ab = document.getElementById('filter-approved');
                  if (ab) ab.classList.remove('active');
                }
                // If no filters remain active, reset to full list for consistency
                if (!productionModalApprovedOnly && !productionModalUnapprovedOnly && productionModalAreaFilters.size === 0 && !productionModalTermForSelection && productionModalActiveFilter === 'all') {
                  productionModalQuotesToFilter = [...currentQuotes];
                  productionModalFilteredQuotes = productionModalQuotesToFilter;
                  renderProductionQuotes(productionModalQuotesToFilter);
                  updateSelectedCount();
                  return;
                }
                const sorted = sortQuotes(applySelectionFilters(), 'newest');
                productionModalFilteredQuotes = sorted;
                renderProductionQuotes(sorted);
                updateSelectedCount();
              });
            }

            // Clear filters
            const clearFiltersBtn = document.getElementById('clear-filters');
            if (clearFiltersBtn && !clearFiltersBtn._bound) {
              clearFiltersBtn._bound = true;
                clearFiltersBtn.addEventListener('click', () => {
                  productionModalAreaFilters.clear();
                  productionModalApprovedOnly = false;
                  productionModalUnapprovedOnly = false;
                  document.querySelectorAll('#production-order-modal .area-filter, #production-order-modal .toggle-filter').forEach(b => b.classList.remove('active'));
                  document.querySelectorAll('#production-order-modal .filter-btn').forEach(b => b.classList.remove('active'));
                  const allBtn = document.querySelector('#production-order-modal .filter-btn[data-filter="all"]');
                  if (allBtn) allBtn.classList.add('active');
                  productionModalActiveFilter = 'all';
                  // Reset quotesToFilter về danh sách gốc
                  productionModalQuotesToFilter = [...currentQuotes];
                  productionModalFilteredQuotes = productionModalQuotesToFilter;
                  renderProductionQuotes(productionModalQuotesToFilter);
                  updateSelectedCount();
                });
            }

            // Bind action buttons
            const closeBtn = document.getElementById('close-production-modal');
            if (closeBtn && !closeBtn._bound) {
              closeBtn._bound = true;
              closeBtn.addEventListener('click', () => closeProductionModal(false));
            }
            const cancelBtn = document.getElementById('cancel-production');
            if (cancelBtn && !cancelBtn._bound) {
              cancelBtn._bound = true;
              cancelBtn.addEventListener('click', () => closeProductionModal(false));
            }
            const createListBtn = document.getElementById('create-production-list');
            if (createListBtn && !createListBtn._bound) {
              createListBtn._bound = true;
              createListBtn.addEventListener('click', createProductionList);
            }

            // Apply sort
            const sortValue = (document.getElementById('production-sort') || {}).value || 'newest';
            productionModalQuotesToFilter = sortQuotes(productionModalQuotesToFilter, sortValue);

            productionModalFilteredQuotes = productionModalQuotesToFilter;
            renderProductionQuotes(productionModalQuotesToFilter);
            updateStatsBar();

            if (__qcagProfile) {
              try {
                const __qcagT1 = (window.performance && typeof performance.now === 'function') ? performance.now() : __qcagT0;
                console.log('totalMs', Math.round(__qcagT1 - __qcagT0));
              } catch (e) { /* ignore */ }
              try { console.groupEnd(); } catch (e) { /* ignore */ }
            }
        }

        function sortQuotes(quotes, sortValue) {
            const arr = [...quotes];
            switch (sortValue) {
                case 'amount_desc':
                  return arr.sort((a, b) => (parseMoney(b.total_amount) || 0) - (parseMoney(a.total_amount) || 0));
                case 'amount_asc':
                  return arr.sort((a, b) => (parseMoney(a.total_amount) || 0) - (parseMoney(b.total_amount) || 0));
                case 'area':
                    return arr.sort((a, b) => (a.area || '').localeCompare(b.area || ''));
                case 'sale_name':
                    return arr.sort((a, b) => (a.sale_name || '').localeCompare(b.sale_name || ''));
                case 'newest':
                default:
                    return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
        }

        function getApprovedSet() {
            return new Set([
                'Area Sales Manager Approved...',
                'Sales Supervisor Checked Variation',
                'Sales Rep Checked Variation'
            ]);
        }

            // Reviewed set: statuses considered "Đã duyệt SPO" (ASM + SS Checked)
            function getReviewedSet() {
              return new Set([
                'Area Sales Manager Approved...',
                'Sales Supervisor Checked Variation'
              ]);
            }

        function getProducedSet() {
            return new Set([
                'Sales Rep Accepted',
                'Store Keeper Finish',
                'Sales Admin Finish',
                'Sales Supervisor Finish',
                'Sign Maker Installed Signage'
            ]);
        }

        function updateFilterCounts() {
            const APPROVED = getApprovedSet();
            const PRODUCED = getProducedSet();
            const eligible = currentQuotes.filter(q => APPROVED.has(q.spo_status) && !PRODUCED.has(q.spo_status));
            const byStatus = {
                'Area Sales Manager Approved...': 0,
                'Sales Supervisor Checked Variation': 0,
                'Sales Rep Checked Variation': 0
            };
            eligible.forEach(q => {
                if (byStatus[q.spo_status] !== undefined) byStatus[q.spo_status]++;
            });

            // Update spans
            document.querySelectorAll('.js-count').forEach(span => {
                const status = span.dataset.status;
                if (status === '__ALL__') {
                    span.textContent = eligible.length;
                } else if (byStatus[status] !== undefined) {
                    span.textContent = byStatus[status];
                }
            });
        }

        // Stable key for quotes across sources (SDK, seeded, local). Avoids 'undefined' selecting all.
        function getQuoteKey(q) {
            if (!q) return '';
            // Prefer permanent quote code, then backend id, explicit id, SPO number
            const primary = q.quote_code || q.__backendId || q.id || q.spo_number;
            if (primary) return String(primary);
            // Fallback compose from stable fields available in both SDK and seeded data
            const outlet = q.outlet_code || 'OC';
            const sale = q.sale_name || 'SN';
            const created = q.created_at || q.date || '';
            const total = q.total_amount != null ? q.total_amount : '';
            return String(`${outlet}__${sale}__${created}__${total}`);
        }

          // Resolve quote key from various shapes/inputs (object or string)
          function resolveQuoteKey(input, fallbackKey) {
            if (!input && !fallbackKey) return '';
            if (typeof input === 'string' || typeof input === 'number') return String(input);
            const q = input || {};
            try {
              if (typeof getQuoteKey === 'function') {
                const k = getQuoteKey(q);
                if (k) return String(k);
              }
            } catch (e) { /* ignore */ }
            const direct = q.quote_key || q.quoteKey || q.quote_code || q.quoteCode || q.__backendId || q.id || q.spo_number || q.outlet_code;
            if (direct) return String(direct);
            if (fallbackKey) return String(fallbackKey);
            return '';
          }

        // Display code for "Mã báo giá" consistently across views
        function formatQuoteCode(q) {
          if (!q) return '';
          // Prefer explicit human identifiers
          if (q.quote_code) return String(q.quote_code);
          if (q.spo_number) return String(q.spo_number);
          if (q.__backendId) return String(q.__backendId);
          if (q.id) return String(q.id);
          // Compact from key if needed
          const key = getQuoteKey(q);
          // Try to shorten long composite keys
          if (key.includes('__')) {
            const parts = key.split('__');
            const outlet = parts[0] || '';
            const dateStr = parts[2] || '';
            const ymd = dateStr ? new Date(dateStr).toISOString().slice(0,10).replace(/-/g,'') : '';
            return `BG-${outlet}-${ymd}`;
          }
          return key || '';
        }

        function updateStatsBar() {
            const APPROVED = getApprovedSet();
            const PRODUCED = getProducedSet();
            const eligible = currentQuotes.filter(q => APPROVED.has(q.spo_status) && !PRODUCED.has(q.spo_status));
            const selectedList = currentQuotes.filter(q => selectedQuotes.has(getQuoteKey(q)));
            const totalSelected = selectedList.reduce((sum, q) => sum + (parseMoney(q.total_amount) || 0), 0);

            const eligibleEl = document.getElementById('eligible-count');
            const selCountEl = document.getElementById('selected-count-stat');
            const selTotalEl = document.getElementById('selected-total-stat');
            if (eligibleEl) eligibleEl.textContent = eligible.length;
            if (selCountEl) selCountEl.textContent = selectedQuotes.size;
            if (selTotalEl) selTotalEl.textContent = formatCurrency(totalSelected);
        }

        // Extract Số ĐH: prefer production order record (SQL), then dedicated fields, then fallback parsing qcag_status
        function getQcagOrderNumber(q) {
          if (!q) return '';
          // 1) If this quote appears inside a production order, use its spo_number (saved in SQL)
          try {
            const key = resolveQuoteKey(q);
            const found = typeof findQuoteInProductionOrders === 'function' ? findQuoteInProductionOrders(String(key)) : null;
            const orderNum = found && found.order && found.order.spo_number;
            if (orderNum && orderNum !== 'Chưa nhập số đơn hàng') return String(orderNum);
          } catch (e) { /* ignore */ }

          // 2) Dedicated fields on the quotation itself
          if (q.qcag_order_number) return String(q.qcag_order_number);
          if (q.order_number) return String(q.order_number);

          // 3) Fallback: parse qcag_status text
          const s = q.qcag_status ? String(q.qcag_status) : '';
          const m = s.match(/\bĐH\s*(\S+)/i);
          return m ? m[1] : '';
        }

        function escapeForNotes(value) {
          if (value === undefined || value === null) return '';
          const str = String(value);
          if (typeof escapeHtml === 'function') {
            return escapeHtml(str);
          }
          return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        function findQuoteByIdentifier(identifier) {
          if (identifier === undefined || identifier === null) return null;
          const identifierStr = String(identifier);
          if (!identifierStr || identifierStr === 'undefined' || identifierStr === 'null') return null;
          return currentQuotes.find(q => {
            if (!q) return false;
            const key = getQuoteKey(q);
            if (key && key === identifierStr) return true;
            if (q.__backendId != null && String(q.__backendId) === identifierStr) return true;
            if (q.id != null && String(q.id) === identifierStr) return true;
            if (q.spo_number != null && String(q.spo_number) === identifierStr) return true;
            return false;
          }) || null;
        }

        function openQuoteNotesModal(identifier) {
          const modal = document.getElementById('quote-notes-modal');
          const subtitle = document.getElementById('note-modal-subtitle');
          // Always show the modal if available
          if (!modal) {
            if (typeof showToast === 'function') showToast('Không tìm thấy cửa sổ ghi chú.');
            return;
          }
          const quote = findQuoteByIdentifier(identifier);
          modal.classList.remove('hidden');
          ensureScrollLock();
          if (!quote) {
            // No quote found: still allow composing a generic note (won't persist)
            noteModalState.activeQuoteKey = null;
            if (subtitle) subtitle.textContent = '';
            document.getElementById('note-history').innerHTML = '<div class="note-empty-state">Không tìm thấy báo giá. Bạn có thể nhập ghi chú nhưng sẽ không được lưu.</div>';
            resetNoteComposer({ clearFiles: true, focus: true });
            try { setupNoteMentions(); } catch (e) {}
            return;
          }
          noteModalState.activeQuoteKey = getQuoteKey(quote);
          const outlet = quote.outlet_name || quote.outlet_code || '';
          const spo = quote.spo_number ? ` • SPO: ${quote.spo_number}` : '';
          if (subtitle) subtitle.textContent = `${outlet}${spo}`;
          renderNoteHistory(quote);
          resetNoteComposer({ clearFiles: true, focus: true });
          try { setupNoteMentions(); } catch (e) {}
        }
        window.openQuoteNotesModal = openQuoteNotesModal;

        function closeQuoteNotesModal() {
          const modal = document.getElementById('quote-notes-modal');
          if (!modal) return;
          modal.classList.add('hidden');
          noteModalState.activeQuoteKey = null;
          resetNoteComposer({ focus: false });
          ensureScrollLock();
        }

        function renderNoteHistory(quote) {
          const container = document.getElementById('note-history');
          if (!container) return;
          const notes = getQuoteNotes(quote);
          if (!notes.length) {
            container.innerHTML = '<div class="note-empty-state">Chưa có ghi chú nào. Bấm gửi để thêm ghi chú đầu tiên.</div>';
            return;
          }

          const html = `<ul class="note-list">${notes.map((note) => {
            const timestamp = note && note.at ? new Date(note.at).toLocaleString('vi-VN') : 'Không rõ thời gian';
            const rawText = note && note.text ? String(note.text) : '';
            const isUser = note && note.user_generated === true;
            // For legacy auto notes that start with [Tự động], strip the prefix for display
            let displayText = rawText;
            if (!isUser) displayText = displayText.replace(/^\[Tự động\]\s*/i, '');

            // Highlight @mentions after escaping. Use explicit mention map when available
            const escaped = escapeForNotes(displayText || '');
            function escapeRegex(s) { return String(s || '').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'); }
            let textWithMentions = String(escaped);
            try {
              if (Array.isArray(note && note.mentions) && note.mentions.length) {
                note.mentions.forEach(m => {
                  const disp = escapeForNotes(m.name || m.username || '');
                  if (!disp) return;
                  const re = new RegExp('@' + escapeRegex(disp), 'g');
                  textWithMentions = textWithMentions.replace(re, `<span class="note-mention" style="background:#e6f0ff;color:#0366d6;padding:2px 4px;border-radius:4px;display:inline-block;white-space:nowrap">@${disp}</span>`);
                });
              }
            } catch (e) {}
            // fallback: highlight simple @username tokens
            textWithMentions = textWithMentions.replace(/@([a-zA-Z0-9_.-]+)/g, function(m, uname) {
              return `<span class="note-mention" style="background:#e6f0ff;color:#0366d6;padding:2px 4px;border-radius:4px">@${escapeForNotes(uname)}</span>`;
            });
            const textBlock = displayText ? `<p>${textWithMentions}</p>` : '';
            const authorLabel = getNoteAuthorLabel(note);
            const authorHtml = authorLabel ? `<span class="note-author">${escapeForNotes(authorLabel)}</span>` : '';
            const badge = `<span class="note-badge ${isUser ? 'note-badge-user' : 'note-badge-system'}">${isUser ? 'Chủ động' : 'Tự động'}</span>`;
            const attachments = Array.isArray(note?.attachments) ? note.attachments : [];
            const attachmentsHtml = attachments.length ? `<div class="note-attachments">${attachments.map((att, attIdx) => renderNoteAttachment(att, attIdx)).join('')}</div>` : '';
            const fallbackText = (!textBlock && !attachmentsHtml) ? '<p class="italic text-gray-500">(Không có nội dung)</p>' : '';
            const metaParts = [badge, `<span class="note-timestamp">${escapeForNotes(timestamp)}</span>`];
            if (authorHtml) metaParts.push(authorHtml);
            const metaRow = `<div class="note-meta">${metaParts.join('<span class="note-meta-sep">•</span>')}</div>`;
            return `
              <li class="note-entry">
                ${metaRow}
                <div class="note-bubble ${isUser ? 'user-note' : 'system-note'}">
                  ${textBlock || ''}
                  ${fallbackText}
                  ${attachmentsHtml}
                </div>
              </li>
            `;
          }).join('')}</ul>`;

          container.innerHTML = html;
          attachNoteImagePreviewHandlers(container);
          container.scrollTop = container.scrollHeight;
        }

        function renderNoteAttachment(attachment, index) {
          if (!attachment) return '';
          const isImage = isImageAttachment(attachment);
          const dataUrl = attachment.data || attachment.url || '';
          if (isImage && dataUrl) {
            const imageName = escapeForNotes(attachment.name || `Hình ảnh ${index + 1}`);
            const altText = escapeForNotes(`Hình ảnh ghi chú ${index + 1}`);
            return `
              <div class="note-attachment-item is-image">
                <img src="${dataUrl}" alt="${altText}" data-viewer-name="${imageName}" loading="lazy" decoding="async" draggable="false">
              </div>
            `;
          }
          const name = escapeForNotes(attachment.name || `Tệp ${index + 1}`);
          const sizeLabel = attachment.size ? `<span class="text-xs text-gray-500">${formatFileSize(attachment.size)}</span>` : '';
          const icon = '[FILE]';
          const downloadLink = dataUrl ? `<a class="text-xs text-blue-600 hover:underline" href="${dataUrl}" download="${name}">Tải xuống</a>` : '';
          return `
            <div class="note-attachment-item">
              <span class="font-semibold">${icon} ${name}</span>
              ${sizeLabel}
              ${downloadLink}
            </div>
          `;
        }

        function attachNoteImagePreviewHandlers(container) {
          if (!container) return;
          const images = container.querySelectorAll('.note-attachment-item.is-image img');
          images.forEach((img) => {
            if (img._viewerBound) return;
            img._viewerBound = true;
            img.addEventListener('click', () => {
              const src = img.getAttribute('src');
              if (!src) return;
              const name = img.getAttribute('data-viewer-name') || '';
              openImageViewer(src, name);
            });
          });
        }

        function isImageAttachment(attachment) {
          if (!attachment) return false;
          const type = attachment.type || '';
          if (type.startsWith('image/')) return true;
          const dataUrl = attachment.data || attachment.url || '';
          return dataUrl.startsWith('data:image') || dataUrl.match(/\.(png|jpe?g|gif|webp|svg)(\?|$)/i);
        }

        function renderPendingFiles() {
          const wrap = document.getElementById('note-pending-files');
          if (!wrap) return;
          const pending = noteModalState.pendingFiles;
          if (!pending.length) {
            wrap.innerHTML = '';
            wrap.classList.add('hidden');
            syncNoteSubmitState();
            return;
          }

          wrap.classList.remove('hidden');
          wrap.innerHTML = pending.map((file, idx) => {
            const name = escapeForNotes(file.name || `Tệp ${idx + 1}`);
            const sizeLabel = file.size ? ` (${formatFileSize(file.size)})` : '';
            return `<span class="pending-file-pill">${name}${sizeLabel}<button type="button" data-remove-index="${idx}" aria-label="Xóa tệp">×</button></span>`;
          }).join('');

          wrap.querySelectorAll('button[data-remove-index]').forEach(btn => {
            if (btn._bound) return;
            btn._bound = true;
            btn.addEventListener('click', (event) => {
              const index = Number(event.currentTarget.getAttribute('data-remove-index'));
              if (!Number.isNaN(index)) {
                noteModalState.pendingFiles.splice(index, 1);
                renderPendingFiles();
              }
            });
          });

          syncNoteSubmitState();
        }

        function resetNoteComposer(options = {}) {
          const { clearFiles = true, focus = true } = options;
          const messageInput = document.getElementById('note-message-input');
          const formEl = document.getElementById('note-compose-form');
          if (messageInput) {
            messageInput.value = '';
            messageInput.setAttribute('value', '');
            messageInput.textContent = '';
            messageInput.defaultValue = '';
            if (typeof messageInput.setRangeText === 'function') {
              messageInput.setRangeText('');
            }
            if (typeof messageInput.setSelectionRange === 'function') {
              messageInput.setSelectionRange(0, 0);
            } else {
              messageInput.selectionStart = 0;
              messageInput.selectionEnd = 0;
            }
          }
          if (clearFiles) {
            noteModalState.pendingFiles = [];
            // clear any mention tracking
            noteModalState.currentMentions = [];
            try { hideMentionDropdown(); } catch (e) {}
          }
          renderPendingFiles();
          if (formEl && clearFiles) {
            formEl.reset();
          }
          if (messageInput) {
            const ensureCleared = () => {
              messageInput.value = '';
              messageInput.dispatchEvent(new Event('input', { bubbles: true }));
              if (focus) {
                messageInput.focus();
              }
            };
            const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
            schedule(ensureCleared); // Defer to avoid stale text from async DOM work
          } else {
            syncNoteSubmitState();
          }
        }

        // --- Mention autocomplete for note composer (@username) ---
        function getRegisteredUsersForMentions() {
          try {
            const raw = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem('qcag_registered_users') : null;
            const users = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(users)) return [];
            return users.filter(u => u && u.username).map(u => ({ username: String(u.username), name: String(u.name || u.username) }));
          } catch (e) { return []; }
        }

        let __noteMentionState = { dropdown: null, items: [], visible: false, selectedIndex: -1 };

        function ensureNoteMentionDropdown() {
          if (__noteMentionState.dropdown) return __noteMentionState.dropdown;
          const dd = document.createElement('div');
          dd.id = 'note-mention-dropdown';
          dd.style.position = 'absolute';
          dd.style.zIndex = 1200;
          dd.style.minWidth = '200px';
          dd.style.maxHeight = '220px';
          dd.style.overflow = 'auto';
          dd.style.background = '#fff';
          dd.style.border = '1px solid #ddd';
          dd.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
          dd.style.borderRadius = '6px';
          dd.style.display = 'none';
          dd.className = 'note-mention-dropdown';
          document.body.appendChild(dd);
          __noteMentionState.dropdown = dd;
          dd.addEventListener('mousedown', function(e){ e.preventDefault(); });
          return dd;
        }

        function showMentionDropdownFor(textarea, query) {
          const dd = ensureNoteMentionDropdown();
          const all = getRegisteredUsersForMentions();
          const q = String(query || '').replace(/^@/, '').toLowerCase();
          const filtered = all.filter(u => (u.username || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q)).slice(0, 50);
          __noteMentionState.items = filtered;
          __noteMentionState.selectedIndex = filtered.length ? 0 : -1;
          dd.innerHTML = filtered.map((u, idx) => `<div data-idx="${idx}" class="mention-item" style="padding:6px 8px;cursor:pointer;border-bottom:1px solid #f3f3f3">` +
            `<div style="font-size:13px;font-weight:600">${escapeForNotes(u.name)}</div>` +
            `<div style="font-size:12px;color:#666">@${escapeForNotes(u.username)}</div>` +
            `</div>`).join('');

          // Position dropdown near caret
          try {
            const rect = textarea.getBoundingClientRect();
            dd.style.left = (rect.left + window.pageXOffset + 8) + 'px';
            // Measure actual content height after rendering
            dd.style.display = 'block';
            dd.style.visibility = 'hidden';
            const actualHeight = dd.scrollHeight;
            dd.style.visibility = 'visible';
            // choose above if not enough space below
            const spaceBelow = window.innerHeight - rect.bottom;
            const maxHeight = 220;
            const neededHeight = Math.min(actualHeight, maxHeight);
            if (spaceBelow < neededHeight && rect.top > neededHeight) {
              // show above textarea: anchor bottom at rect.top - 6 and set height so it shrinks from top
              const bottomAnchor = rect.top + window.pageYOffset - 6;
              dd.style.height = neededHeight + 'px';
              dd.style.top = (bottomAnchor - neededHeight) + 'px';
            } else {
              // show below textarea: anchor top at rect.bottom + 6 and set height
              dd.style.height = neededHeight + 'px';
              dd.style.top = (rect.bottom + window.pageYOffset + 6) + 'px';
            }
          } catch (e) {}

          dd.style.display = filtered.length ? 'block' : 'none';
          __noteMentionState.visible = filtered.length > 0;

          dd.querySelectorAll('.mention-item').forEach(el => {
            el.addEventListener('click', function(ev){
              const idx = Number(ev.currentTarget.getAttribute('data-idx'));
              const u = __noteMentionState.items[idx];
              if (u) insertMentionAtCursor(textarea, u.username, u.name);
              hideMentionDropdown();
              textarea.focus();
            });
          });
        }

        function hideMentionDropdown() {
          const dd = ensureNoteMentionDropdown();
          dd.style.display = 'none';
          __noteMentionState.visible = false;
          __noteMentionState.items = [];
          __noteMentionState.selectedIndex = -1;
        }

        function insertMentionAtCursor(textarea, username, displayName) {
          if (!textarea) return;
          const val = textarea.value || '';
          const selStart = textarea.selectionStart || 0;
          const selEnd = textarea.selectionEnd || selStart;
          // find the @ token start before selStart
          let atPos = val.lastIndexOf('@', selStart - 1);
          if (atPos < 0) atPos = selStart; // fallback
          // build new value: before @ + @displayName + space + after token
          const before = val.slice(0, atPos);
          const after = val.slice(selEnd);
          // trim to remove any extra spaces in name
          const nameToInsert = String(displayName || username || '').trim();
          const insertText = `@${nameToInsert} `;
          const newPos = before.length + insertText.length;
          textarea.value = before + insertText + after;
          // track mention mapping for submission
          try {
            noteModalState.currentMentions = noteModalState.currentMentions || [];
            // avoid duplicates
            const exists = noteModalState.currentMentions.find(m => String(m.username) === String(username));
            if (!exists) {
              noteModalState.currentMentions.push({ username: String(username), name: String(nameToInsert) });
            }
          } catch (e) {}
          // fire input event
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          try { textarea.setSelectionRange(newPos, newPos); } catch (e) {}
        }

        function setupNoteMentions() {
          const ta = document.getElementById('note-message-input');
          if (!ta) return;
          // prevent double-binding
          if (ta._mentionsBound) return; ta._mentionsBound = true;

          ta.addEventListener('input', function(e){
            const v = ta.value || '';
            const sel = ta.selectionStart || v.length;
            const lastAt = v.lastIndexOf('@', sel - 1);
            if (lastAt >= 0) {
              // ensure @ is either at start or preceded by whitespace
              const pre = v.charAt(lastAt - 1);
              if (lastAt === 0 || /\s/.test(pre)) {
                const token = v.slice(lastAt, sel);
                // if token contains space or newline, cancel
                if (/\s/.test(token)) { hideMentionDropdown(); return; }
                showMentionDropdownFor(ta, token);
                return;
              }
            }
            hideMentionDropdown();
          });

          ta.addEventListener('keydown', function(e){
            const dd = ensureNoteMentionDropdown();
            if (!__noteMentionState.visible) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              __noteMentionState.selectedIndex = Math.min(__noteMentionState.selectedIndex + 1, __noteMentionState.items.length - 1);
              // highlight
              dd.querySelectorAll('.mention-item').forEach((el, idx) => el.style.background = idx === __noteMentionState.selectedIndex ? '#f0f8ff' : '');
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              __noteMentionState.selectedIndex = Math.max(__noteMentionState.selectedIndex - 1, 0);
              dd.querySelectorAll('.mention-item').forEach((el, idx) => el.style.background = idx === __noteMentionState.selectedIndex ? '#f0f8ff' : '');
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              if (__noteMentionState.selectedIndex >= 0 && __noteMentionState.items[__noteMentionState.selectedIndex]) {
                e.preventDefault();
                const u = __noteMentionState.items[__noteMentionState.selectedIndex];
                insertMentionAtCursor(ta, u.username, u.name);
                hideMentionDropdown();
              }
            }
            if (e.key === 'Escape') {
              hideMentionDropdown();
            }
          });

          document.addEventListener('click', function(ev){
            const dd = __noteMentionState.dropdown;
            if (!dd || !__noteMentionState.visible) return;
            if (ev.target === dd || dd.contains(ev.target)) return;
            if (ev.target === ta) return;
            hideMentionDropdown();
          });
        }

        function submitNoteComposer() {
          const messageInput = document.getElementById('note-message-input');
          const message = messageInput ? messageInput.value.trim() : '';
          const hasFiles = noteModalState.pendingFiles.length > 0;
          if (!message && !hasFiles) {
            if (typeof showToast === 'function') {
              showToast('Vui lòng nhập ghi chú hoặc đính kèm tệp.');
            }
            return false;
          }

          if (!noteModalState.activeQuoteKey) {
            return false;
          }

          const idx = currentQuotes.findIndex(q => getQuoteKey(q) === noteModalState.activeQuoteKey);
          if (idx < 0) {
            if (typeof showToast === 'function') {
              showToast('Không thể lưu ghi chú cho báo giá này.');
            }
            return false;
          }

          const entry = {
            text: message,
            at: new Date().toISOString(),
            // mark as user-generated so render logic treats this as an active message
            user_generated: true
          };

          // Attach mentions collected via autocomplete (if any)
          try {
            if (Array.isArray(noteModalState.currentMentions) && noteModalState.currentMentions.length) {
              // store array of { username, name }
              entry.mentions = noteModalState.currentMentions.map(m => ({ username: String(m.username), name: String(m.name || m.username) }));
            }
          } catch (e) { /* ignore */ }

          if (noteModalState.pendingFiles.length) {
            entry.attachments = noteModalState.pendingFiles.map(file => ({
              name: file.name,
              size: file.size,
              type: file.type,
              data: file.data
            }));
          }

          const updated = appendNoteEntryToQuote(idx, entry, 'Đã lưu ghi chú');
          if (!updated) {
            return false;
          }
          // Aggressively clear input state immediately on success
          try {
            if (messageInput) {
              messageInput.value = '';
              messageInput.textContent = '';
              messageInput.defaultValue = '';
              messageInput.setAttribute('value', '');
              messageInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            noteModalState.pendingFiles = [];
            // Defer a hard reset to ensure no stale text remains after DOM updates
            const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
            schedule(() => {
              resetNoteComposer({ clearFiles: true, focus: true });
              syncNoteSubmitState();
            });
          } catch (_) {}
          return true;
        }

        function getQuoteNotes(quote) {
          if (!quote) return [];
          const raw = quote.notes;
          if (Array.isArray(raw)) return raw;
          if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
              return [];
            }
          }
          return [];
        }

        function appendNoteEntryToQuote(idx, entry, toastMessage) {
          if (idx < 0 || idx >= currentQuotes.length) return null;
          const quote = currentQuotes[idx];
          if (!quote) return null;
          const enrichedEntry = ensureNoteHasAuthor(entry);
          const notes = [...getQuoteNotes(quote), enrichedEntry];
          const updated = { ...quote, notes };
          currentQuotes[idx] = updated;

          if (window.dataSdk && typeof window.dataSdk.update === 'function') {
            try {
              window.dataSdk.update(updated);
            } catch (err) {
              console.error('Lỗi cập nhật ghi chú:', err);
            }
          }

          if (noteModalState.activeQuoteKey === getQuoteKey(updated)) {
            renderNoteHistory(updated);
          }

          // Cập nhật phần xem nhanh ghi chú trong chi tiết báo giá
          const rowKey = getQuoteKey(updated);
          updateQuoteDetailsNotesPreview(rowKey, updated);
          updateNoteButtonsForQuote(rowKey, updated);

          if (toastMessage && typeof showToast === 'function') {
            showToast(toastMessage);
          }

          return updated;
        }

        function addSystemNoteForQuote(target, message) {
          if (!message || !target) return;
          const key = typeof target === 'string' ? target : getQuoteKey(target);
          if (!key) return;
          const idx = currentQuotes.findIndex(q => getQuoteKey(q) === key);
          if (idx < 0) return;
          appendNoteEntryToQuote(idx, {
            text: `[Tự động] ${message}`,
            at: new Date().toISOString()
          }, null);
        }

        function addPlainNoteForQuote(target, text) {
          if (!text || !target) return;
          const key = typeof target === 'string' ? target : getQuoteKey(target);
          if (!key) return;
          const idx = currentQuotes.findIndex(q => getQuoteKey(q) === key);
          if (idx < 0) return;
          appendNoteEntryToQuote(idx, {
            text: String(text),
            at: new Date().toISOString()
          }, null);
        }

        function getCurrentAuthUser() {
          try {
            const u = window && window.__qcagAuthUser ? window.__qcagAuthUser : null;
            if (!u || typeof u !== 'object') return null;
            return {
              username: u.username ? String(u.username) : '',
              name: u.name ? String(u.name) : '',
              role: u.role ? String(u.role) : ''
            };
          } catch (e) {
            return null;
          }
        }

        function getNoteAuthorLabel(note) {
          if (!note || typeof note !== 'object') return '';
          const name = note.author_name ? String(note.author_name).trim() : '';
          const username = note.author_username ? String(note.author_username).trim() : '';
          if (name) return name;
          if (username) return username;
          return '';
        }

        function ensureNoteHasAuthor(entry) {
          if (!entry || typeof entry !== 'object') return entry;
          if (entry.author_name || entry.author_username) return entry;
          const u = getCurrentAuthUser();
          if (!u) return entry;
          return {
            ...entry,
            author_name: u.name || '',
            author_username: u.username || ''
          };
        }

        // Hàm helper để render preview ghi chú (hiển thị toàn bộ danh sách)
        function renderNotesPreviewHTML(quote) {
          const notes = getQuoteNotes(quote);
          if (!notes.length) {
            return `
              <div class="bg-gray-100 border border-gray-200 rounded-lg p-3 h-full flex items-center justify-center">
                <div class="text-center text-gray-400 text-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
                  <p>Chưa có ghi chú</p>
                </div>
              </div>
            `;
          }

          const newestFirst = [...notes].reverse();
          const headerTime = newestFirst[0]?.at ? new Date(newestFirst[0].at).toLocaleString('vi-VN') : '';
          const entries = newestFirst.map((note, idx) => {
            const timeLabel = note?.at ? new Date(note.at).toLocaleString('vi-VN') : 'Không rõ thời gian';
            const author = getNoteAuthorLabel(note);
            const authorHtml = author ? `<div class="text-[11px] text-gray-500 mt-1">${escapeForNotes(author)}</div>` : '';
            const rawText = note?.text ? String(note.text) : '';
            const escText = escapeForNotes(rawText);
            // highlight mentions from attached mentions array if present
            let textWithMentionsPreview = escText;
            try {
              if (Array.isArray(note?.mentions) && note.mentions.length) {
                note.mentions.forEach(m => {
                  const disp = escapeForNotes(m.name || m.username || '');
                  if (!disp) return;
                  const re = new RegExp('@' + disp.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
                  textWithMentionsPreview = textWithMentionsPreview.replace(re, `<span class="note-mention" style="background:#e6f0ff;color:#0366d6;padding:2px 4px;border-radius:4px;display:inline-block;white-space:nowrap">@${disp}</span>`);
                });
              }
            } catch (e) {}
            textWithMentionsPreview = textWithMentionsPreview.replace(/@([a-zA-Z0-9_.-]+)/g, function(m, uname){ return `<span class="note-mention" style="background:#e6f0ff;color:#0366d6;padding:2px 4px;border-radius:4px;display:inline-block;white-space:nowrap">@${escapeForNotes(uname)}</span>`; });
            const textHtml = rawText ? `<div class="text-xs text-gray-800 whitespace-pre-wrap break-words mt-1">${textWithMentionsPreview}</div>` : '<div class="text-xs italic text-gray-500 mt-1">(Không có nội dung văn bản)</div>';
            const attachments = Array.isArray(note?.attachments) ? note.attachments : [];
            const attachmentsHtml = attachments.length
              ? `<div class="flex flex-wrap gap-2 mt-2">${attachments.map((att, attIdx) => renderNoteAttachment(att, attIdx)).join('')}</div>`
              : '';
            return `
              <div class="bg-white/80 border border-yellow-200 rounded-md p-2 shadow-sm">
                <div class="flex items-center justify-between text-[11px] text-yellow-700">
                  <span>Ghi chú #${newestFirst.length - idx}</span>
                  <span>${escapeForNotes(timeLabel)}</span>
                </div>
                ${textHtml}
                ${authorHtml}
                ${attachmentsHtml}
              </div>
            `;
          }).join('');

          return `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 h-full flex flex-col">
              <div class="flex items-center justify-between mb-2">
                <h4 class="font-semibold text-yellow-800 text-xs flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
                  <span>Ghi chú (${notes.length})</span>
                </h4>
                <span class="text-[10px] text-yellow-700">Mới nhất: ${escapeForNotes(headerTime)}</span>
              </div>
              <div class="flex-1 overflow-y-auto space-y-2 max-h-72">
                ${entries}
              </div>
            </div>
          `;
        }

        function updateNoteButtonsForQuote(rowKey, quote) {
          const buttons = document.querySelectorAll(`[data-note-btn="${rowKey}"]`);
          if (!buttons.length) return;
          const count = getQuoteNotes(quote).length;
          buttons.forEach(btn => {
            const countBox = btn.querySelector('.note-btn-count');
            if (!countBox) return;
            countBox.textContent = count || 0;
            countBox.classList.toggle('has-notes', count > 0);
          });
        }

        // Cập nhật phần preview ghi chú trong chi tiết báo giá đang mở
        function updateQuoteDetailsNotesPreview(rowKey, quote) {
          const containers = document.querySelectorAll(`[data-notes-preview="${rowKey}"]`);
          if (!containers.length) return;
          const html = renderNotesPreviewHTML(quote);
          containers.forEach(container => {
            container.innerHTML = html;
          });
          updateNoteButtonsForQuote(rowKey, quote);
        }

        function syncNoteSubmitState() {
          const messageInput = document.getElementById('note-message-input');
          const submitBtn = document.getElementById('note-submit-btn');
          if (!submitBtn) return;
          const hasMessage = messageInput ? messageInput.value.trim().length > 0 : false;
          const hasFiles = noteModalState.pendingFiles.length > 0;
          submitBtn.disabled = !(hasMessage || hasFiles);
        }

        function handleNoteFiles(fileList, options = {}) {
          if (!fileList || !fileList.length) return;
          const imagesOnly = !!options.imagesOnly;
          const availableSlots = NOTE_MODAL_MAX_FILES - noteModalState.pendingFiles.length;
          if (availableSlots <= 0) {
            if (typeof showToast === 'function') {
              showToast(`Chỉ có thể đính tối đa ${NOTE_MODAL_MAX_FILES} tệp.`);
            }
            return;
          }

          let files = Array.from(fileList).slice(0, availableSlots);
          if (files.length < fileList.length && typeof showToast === 'function') {
            showToast(`Đã chọn quá ${NOTE_MODAL_MAX_FILES} tệp, chỉ lấy ${files.length} tệp đầu tiên.`);
          }

          if (imagesOnly) {
            const invalid = files.filter(file => !isImageFile(file));
            if (invalid.length && typeof showToast === 'function') {
              showToast('Vui lòng chọn tệp hình ảnh.');
            }
            files = files.filter(file => isImageFile(file));
          }

          if (!files.length) {
            syncNoteSubmitState();
            return;
          }

          const processors = files.map(file => (
            isImageFile(file) ? processImageFile(file) : processNonImageFile(file)
          ));

          Promise.allSettled(processors)
            .then(results => {
              const successfulFiles = [];
              results.forEach((result, idx) => {
                const original = files[idx];
                if (result.status === 'fulfilled') {
                  successfulFiles.push(result.value);
                } else {
                  const reason = result.reason || {};
                  if (reason && reason.code === 'FILE_TOO_LARGE') {
                    if (typeof showToast === 'function') {
                      showToast(`Tệp "${original.name}" vượt quá 5MB. Vui lòng chọn tệp nhỏ hơn.`);
                    }
                  } else if (typeof showToast === 'function') {
                    showToast(`Không thể xử lý "${original.name}". Vui lòng thử lại.`);
                  }
                }
              });

              if (imagesOnly) {
                if (!successfulFiles.length) {
                  syncNoteSubmitState();
                  return;
                }
                const quoteIdx = currentQuotes.findIndex(q => getQuoteKey(q) === noteModalState.activeQuoteKey);
                if (quoteIdx < 0) {
                  if (typeof showToast === 'function') {
                    showToast('Không tìm thấy báo giá để gửi ảnh.');
                  }
                  syncNoteSubmitState();
                  return;
                }
                let sentCount = 0;
                successfulFiles.forEach(fileObj => {
                  const entry = {
                    text: '',
                    at: new Date().toISOString(),
                    attachments: [fileObj]
                  };
                  const updated = appendNoteEntryToQuote(quoteIdx, entry, null);
                  if (updated) sentCount++;
                });
                if (sentCount && typeof showToast === 'function') {
                  showToast(sentCount > 1 ? `Đã gửi ${sentCount} ảnh` : 'Đã gửi ảnh');
                }
                syncNoteSubmitState();
              } else {
                if (successfulFiles.length) {
                  noteModalState.pendingFiles.push(...successfulFiles);
                  renderPendingFiles();
                } else {
                  syncNoteSubmitState();
                }
              }
            })
            .finally(() => {
              const fileInputEl = document.getElementById('note-file-input');
              if (fileInputEl) fileInputEl.value = '';
              const imageInputEl = document.getElementById('note-image-input');
              if (imageInputEl) imageInputEl.value = '';
              syncNoteSubmitState();
            });
        }

        function formatFileSize(bytes) {
          if (bytes === undefined || bytes === null || isNaN(bytes)) return '';
          const thresh = 1024;
          if (Math.abs(bytes) < thresh) return `${bytes} B`;
          const units = ['KB', 'MB', 'GB', 'TB'];
          let u = -1;
          let size = bytes;
          do {
            size /= thresh;
            ++u;
          } while (Math.abs(size) >= thresh && u < units.length - 1);
          return `${size.toFixed(1)} ${units[u]}`;
        }

        function isImageFile(file) {
          if (!file) return false;
          if (file.type) {
            return file.type.startsWith('image/');
          }
          const name = file.name || '';
          const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
          return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
        }

        function convertNameToJpg(name) {
          if (!name) return 'image.jpg';
          const base = name.replace(/\.[^.]+$/, '');
          return `${base}.jpg`;
        }

        function scaleImageDimensions(width, height) {
          const w = Math.max(1, Math.round(width || 1));
          const h = Math.max(1, Math.round(height || 1));
          const ratio = Math.min(1,
            NOTE_MAX_IMAGE_WIDTH / w,
            NOTE_MAX_IMAGE_HEIGHT / h
          );
          if (ratio >= 1) {
            return { width: w, height: h };
          }
          return {
            width: Math.max(1, Math.round(w * ratio)),
            height: Math.max(1, Math.round(h * ratio))
          };
        }

        function processImageFile(file) {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const img = new Image();
              img.onload = () => {
                const dims = scaleImageDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height);
                const canvas = document.createElement('canvas');
                canvas.width = dims.width;
                canvas.height = dims.height;
                const ctx = canvas.getContext('2d', { alpha: false });
                if (!ctx) {
                  reject(new Error('Không thể xử lý ảnh.'));
                  return;
                }
                ctx.drawImage(img, 0, 0, dims.width, dims.height);
                canvas.toBlob((blob) => {
                  if (!blob) {
                    reject(new Error('Không thể chuyển đổi ảnh.'));
                    return;
                  }
                  const finalReader = new FileReader();
                  finalReader.onload = () => {
                    resolve({
                      name: convertNameToJpg(file.name),
                      size: blob.size,
                      type: 'image/jpeg',
                      data: finalReader.result
                    });
                  };
                  finalReader.onerror = () => reject(finalReader.error || new Error('Không thể đọc ảnh đã chuyển đổi.'));
                  finalReader.readAsDataURL(blob);
                }, 'image/jpeg', NOTE_JPEG_QUALITY);
              };
              img.onerror = () => reject(new Error('Không thể tải ảnh.'));
              img.src = reader.result;
            };
            reader.onerror = () => reject(reader.error || new Error('Không thể đọc ảnh.'));
            reader.readAsDataURL(file);
          });
        }

        function processNonImageFile(file) {
          return new Promise((resolve, reject) => {
            if (file.size > NOTE_MAX_FILE_SIZE) {
              reject({ code: 'FILE_TOO_LARGE', file });
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream',
                data: reader.result
              });
            };
            reader.onerror = () => reject(reader.error || new Error('Không thể đọc tệp.'));
            reader.readAsDataURL(file);
          });
        }

        function setupNoteModal() {
          const imageBtn = document.getElementById('note-attach-image-btn');
          if (imageBtn && !imageBtn._bound) {
            imageBtn._bound = true;
            imageBtn.addEventListener('click', (event) => {
              event.preventDefault();
              const input = document.getElementById('note-image-input');
              if (input) input.click();
            });
          }

          const fileBtn = document.getElementById('note-attach-file-btn');
          if (fileBtn && !fileBtn._bound) {
            fileBtn._bound = true;
            fileBtn.addEventListener('click', (event) => {
              event.preventDefault();
              const input = document.getElementById('note-file-input');
              if (input) input.click();
            });
          }

          const closeBtn = document.getElementById('close-note-modal');
          if (closeBtn && !closeBtn._bound) {
            closeBtn._bound = true;
            closeBtn.addEventListener('click', (event) => {
              event.preventDefault();
              closeQuoteNotesModal();
            });
          }

          const imageInput = document.getElementById('note-image-input');
          if (imageInput && !imageInput._bound) {
            imageInput._bound = true;
            imageInput.addEventListener('change', (event) => {
              handleNoteFiles(event.target.files, { imagesOnly: true });
            });
          }

          const fileInput = document.getElementById('note-file-input');
          if (fileInput && !fileInput._bound) {
            fileInput._bound = true;
            fileInput.addEventListener('change', (event) => {
              handleNoteFiles(event.target.files, { imagesOnly: false });
            });
          }

          const form = document.getElementById('note-compose-form');
          if (form && !form._bound) {
            form._bound = true;
            form.addEventListener('submit', (event) => {
              event.preventDefault();
              if (submitNoteComposer()) {
                resetNoteComposer();
              }
            });
          }

          const messageInput = document.getElementById('note-message-input');
          if (messageInput && !messageInput._bound) {
            messageInput._bound = true;
            messageInput.addEventListener('input', () => {
              syncNoteSubmitState();
            });
            // Allow Enter to send the note, Shift+Enter keeps new lines
            messageInput.addEventListener('keydown', (event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
                return;
              }
              const hasContent = messageInput.value.trim().length > 0 || noteModalState.pendingFiles.length > 0;
              if (!hasContent) {
                return;
              }
              event.preventDefault();
              if (submitNoteComposer()) {
                resetNoteComposer();
              }
            });
          }

          if (!document._noteModalEscBound) {
            document._noteModalEscBound = true;
            document.addEventListener('keydown', (event) => {
              if (event.key === 'Escape') {
                const modal = document.getElementById('quote-notes-modal');
                if (modal && !modal.classList.contains('hidden')) {
                  closeQuoteNotesModal();
                }
              }
            });
          }

          const backdrop = document.getElementById('quote-notes-modal');
          if (backdrop && !backdrop._bound) {
            backdrop._bound = true;
            backdrop.addEventListener('click', (event) => {
              if (event.target === backdrop) {
                closeQuoteNotesModal();
              }
            });
          }
        }

        setupNoteModal();
