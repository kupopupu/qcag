        // ========== PRODUCTION MODAL TAB FUNCTIONS ==========
        
        // Switch between tabs in production modal
        function switchProductionTab(tabName) {
          productionModalCurrentTab = tabName;
          const tabSelect = document.getElementById('production-tab-select');
          const tabPending = document.getElementById('production-tab-pending');
          const contentSelect = document.getElementById('production-tab-content-select');
          const contentPending = document.getElementById('production-tab-content-pending');
          
          if (tabName === 'select') {
            tabSelect.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            tabSelect.classList.remove('text-gray-500');
            tabPending.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            tabPending.classList.add('text-gray-500');
            contentSelect.classList.remove('hidden');
            contentPending.classList.add('hidden');
          } else {
            tabPending.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            tabPending.classList.remove('text-gray-500');
            tabSelect.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            tabSelect.classList.add('text-gray-500');
            contentPending.classList.remove('hidden');
            contentSelect.classList.add('hidden');
            renderPendingOrdersList();
          }
        }
        
        // Add selected quotes to pending list (or to existing order if in add-more mode)
        function addToPendingList() {
          const createBtn = document.getElementById('create-production-list');
          const addingToOrderId = createBtn && createBtn._addingToOrder;
          
          const selectedQuotesList = currentQuotes.filter(q => selectedQuotes.has(getQuoteKey(q)));
          
          if (selectedQuotesList.length === 0) {
            showToast('Vui lòng chọn ít nhất một báo giá');
            return;
          }
          
          if (addingToOrderId) {
            // Adding to existing order
            const order = pendingOrders.find(o => o.id === addingToOrderId);
            if (order) {
              // Add quotes to order (avoid duplicates)
              const existingKeys = new Set(order.quotes.map(q => getQuoteKey(q)));
              let addedCount = 0;
              
              selectedQuotesList.forEach(quote => {
                const key = getQuoteKey(quote);
                if (!existingKeys.has(key)) {
                  order.quotes.push(quote);
                  addedCount++;
                }
              });
              
              // Update order totals
              order.totalPoints = order.quotes.length;
              order.totalAmount = 0;
              order.quotes.forEach(q => {
                order.totalAmount += parseMoney(q.total_amount) || 0;
              });
              
              // Remove added quotes from selection list
              const keysToRemove = new Set(selectedQuotesList.map(q => getQuoteKey(q)));
              currentQuotes = currentQuotes.filter(q => !keysToRemove.has(getQuoteKey(q)));
              productionModalQuotesToFilter = productionModalQuotesToFilter.filter(q => !keysToRemove.has(getQuoteKey(q)));
              productionModalFilteredQuotes = productionModalFilteredQuotes.filter(q => !keysToRemove.has(getQuoteKey(q)));
              
              selectedQuotes.clear();
              renderProductionQuotes(productionModalFilteredQuotes);
              updateSelectedCount();
              updatePendingCount();
              
              // Save to backend
              savePendingOrderToBackend(order).then(() => {
                savePendingOrdersToStorage(); // Also backup to localStorage
              });
              
              showToast(`Đã thêm ${addedCount} báo giá vào đơn`);
              
              // Reset button
              createBtn.textContent = 'Thêm Vào Chờ Duyệt';
              delete createBtn._addingToOrder;
              
              // Re-open detail modal
              openPendingOrderDetailModal(addingToOrderId);
              return;
            }
          }
          
          // Original logic: Create new order
          const orderId = 'pending_' + Date.now();
          const authUser = (typeof window !== 'undefined' && window.__qcagAuthUser) ? window.__qcagAuthUser : null;
          const userName = (authUser && authUser.name && authUser.name.trim()) ? authUser.name : (authUser && authUser.username ? authUser.username : 'User');
          let totalAmount = 0;
          selectedQuotesList.forEach(q => {
            totalAmount += parseMoney(q.total_amount) || 0;
          });
          
          const newOrder = {
            id: orderId,
            createdBy: userName,
            createdAt: Date.now(),
            quotes: [...selectedQuotesList],
            totalPoints: selectedQuotesList.length,
            totalAmount: totalAmount
          };
          
          pendingOrders.push(newOrder);
          
          // Remove added quotes from currentQuotes so they don't appear in selection tab anymore
          const keysToRemove = new Set(selectedQuotesList.map(q => getQuoteKey(q)));
          currentQuotes = currentQuotes.filter(q => !keysToRemove.has(getQuoteKey(q)));
          productionModalQuotesToFilter = productionModalQuotesToFilter.filter(q => !keysToRemove.has(getQuoteKey(q)));
          productionModalFilteredQuotes = productionModalFilteredQuotes.filter(q => !keysToRemove.has(getQuoteKey(q)));
          
          // Clear selection
          selectedQuotes.clear();
          renderProductionQuotes(productionModalFilteredQuotes);
          updateSelectedCount();
          
          // Update pending count badge
          updatePendingCount();
          
          // Save to backend
          savePendingOrderToBackend(newOrder).then(() => {
            savePendingOrdersToStorage(); // Also backup to localStorage
          });
          
          showToast(`Đã thêm ${selectedQuotesList.length} báo giá vào danh sách chờ duyệt`);
          
          // Switch to pending tab
          switchProductionTab('pending');
        }
        
        // Remove order from pending list
        async function removePendingOrder(orderId) {
          const removedOrder = pendingOrders.find(o => o.id === orderId);
          if (!removedOrder) return;
          
          if (!confirm(`Bạn có chắc muốn xóa đơn này (${removedOrder.totalPoints} báo giá)?`)) return;
          
          // Delete from backend first
          const result = await deletePendingOrderFromBackend(orderId);
          
          pendingOrders = pendingOrders.filter(o => o.id !== orderId);
          
          // Add all quotes from this order back to selection list
          removedOrder.quotes.forEach(quote => {
            currentQuotes.push(quote);
            productionModalQuotesToFilter.push(quote);
            productionModalFilteredQuotes.push(quote);
          });
          
          updatePendingCount();
          savePendingOrdersToStorage();
          renderPendingOrdersList();
          showToast('Đã xóa đơn và trả lại các báo giá vào danh sách chọn');
        }
        
        // Clear all pending orders
        async function clearPendingList() {
          if (pendingOrders.length === 0) return;
          if (!confirm('Bạn có chắc muốn xóa tất cả đơn chờ duyệt?')) return;
          
          // Delete all from backend
          const result = await clearAllPendingOrdersFromBackend();
          
          // Add all quotes from all orders back to selection list
          pendingOrders.forEach(order => {
            order.quotes.forEach(quote => {
              currentQuotes.push(quote);
              productionModalQuotesToFilter.push(quote);
              productionModalFilteredQuotes.push(quote);
            });
          });
          
          pendingOrders = [];
          
          updatePendingCount();
          savePendingOrdersToStorage();
          renderPendingOrdersList();
          showToast('Đã xóa tất cả đơn chờ duyệt');
        }
        
        // Update pending count badge
        function updatePendingCount() {
          const countEl = document.getElementById('pending-count');
          let totalCount = 0;
          pendingOrders.forEach(o => totalCount += o.totalPoints);
          if (countEl) countEl.textContent = totalCount;
          
          // Update save button state
          const saveBtn = document.getElementById('pending-save-order');
          if (saveBtn) saveBtn.disabled = pendingOrders.length === 0;
        }
        
        // Render pending orders list (summary view)
        function renderPendingOrdersList() {
          const container = document.getElementById('pending-quotes-list');
          if (!container) return;
          
          // Apply search filter
          const searchInput = document.getElementById('pending-search');
          const searchTerm = (searchInput && searchInput.value || '').toLowerCase().trim();
          
          let filtered = pendingOrders;
          if (searchTerm) {
            filtered = pendingOrders.filter(order => {
              const text = order.createdBy.toLowerCase() + ' ' + order.id.toLowerCase();
              return text.includes(searchTerm);
            });
          }
          
          if (filtered.length === 0) {
            container.innerHTML = '<div class="p-8 text-center text-gray-500">Chưa có đơn chờ duyệt nào</div>';
            updatePendingSummary([]);
            return;
          }
          
          let html = '';
          filtered.forEach((order, idx) => {
            const createdDate = new Date(order.createdAt).toLocaleString('vi-VN');
            const amount = typeof formatCurrency === 'function' ? formatCurrency(order.totalAmount || 0) : (order.totalAmount || 0);
            
            // Extract unique areas from quotes
            const uniqueAreas = [...new Set(order.quotes.map(q => q.area).filter(Boolean))];
            const areasText = uniqueAreas.length > 0 ? uniqueAreas.join(', ') : '-';
            
            html += `
              <div class="flex items-center px-3 py-2 border-b border-gray-100 hover:bg-gray-50 text-sm" data-order-id="${order.id}">
                <div class="w-16 text-gray-600">${idx + 1}</div>
                <div class="w-28 font-medium text-blue-600">${order.totalPoints}</div>
                <div class="w-32 font-semibold text-green-600">${amount}</div>
                <div class="w-48 text-gray-700 text-xs truncate" title="${areasText}">${areasText}</div>
                <div class="w-32 text-gray-700">${order.createdBy}</div>
                <div class="w-44 text-xs text-gray-600">${createdDate}</div>
                <div class="flex-1 flex justify-center gap-2">
                  <button class="pending-view-detail-btn px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded" data-order-id="${order.id}">
                    Xem Chi Tiết
                  </button>
                  <button class="pending-export-excel-btn px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded" data-order-id="${order.id}">
                    Xuất Excel
                  </button>
                  <button class="pending-save-single-btn px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded" data-order-id="${order.id}">
                    Lưu Đơn Này
                  </button>
                  <button class="pending-remove-order-btn px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded" data-order-id="${order.id}">
                    Xóa
                  </button>
                </div>
              </div>
            `;
          });
          
          container.innerHTML = html;
          
          // Bind view detail buttons
          container.querySelectorAll('.pending-view-detail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const orderId = btn.dataset.orderId;
              openPendingOrderDetailModal(orderId);
            });
          });
          
          // Bind export excel buttons
          container.querySelectorAll('.pending-export-excel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const orderId = btn.dataset.orderId;
              exportPendingOrderToExcel(orderId);
            });
          });
          
          // Bind save single order buttons
          container.querySelectorAll('.pending-save-single-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const orderId = btn.dataset.orderId;
              saveSinglePendingOrder(orderId);
            });
          });
          
          // Bind remove buttons
          container.querySelectorAll('.pending-remove-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const orderId = btn.dataset.orderId;
              removePendingOrder(orderId);
            });
          });
          
          updatePendingSummary(filtered);
        }
        
        // Update pending summary (total points and amount)
        function updatePendingSummary(orders) {
          const list = orders || pendingOrders;
          let totalPoints = 0;
          let totalAmount = 0;
          list.forEach(order => {
            totalPoints += order.totalPoints;
            totalAmount += order.totalAmount;
          });
          
          const pointsEl = document.getElementById('pending-total-points');
          const amountEl = document.getElementById('pending-total-amount');
          if (pointsEl) pointsEl.textContent = totalPoints;
          if (amountEl) amountEl.textContent = typeof formatCurrency === 'function' ? formatCurrency(totalAmount) : totalAmount + ' đ';
        }
        
        // Open modal to view detail of a pending order
        let currentViewingOrderId = null; // Track which order is being viewed
        
        function openPendingOrderDetailModal(orderId) {
          const order = pendingOrders.find(o => o.id === orderId);
          if (!order) return;
          
          currentViewingOrderId = orderId;
          
          // Open a new modal showing the detail list
          const modal = document.getElementById('pending-order-detail-modal');
          if (!modal) return;
          
          // Render order info and quotes list
          renderPendingOrderDetail(order);
          
          modal.classList.remove('hidden');
          ensureScrollLock();
        }
        
        // Render detail of a pending order in modal
        function renderPendingOrderDetail(order) {
          const headerEl = document.getElementById('pending-order-detail-header');
          const listEl = document.getElementById('pending-order-detail-list');
          
          if (headerEl) {
            const createdDate = new Date(order.createdAt).toLocaleString('vi-VN');
            const amount = typeof formatCurrency === 'function' ? formatCurrency(order.totalAmount || 0) : (order.totalAmount || 0);
            headerEl.innerHTML = `
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xl font-bold text-gray-800">Chi Tiết Đơn Chờ Duyệt</h3>
                  <div class="mt-1 text-sm text-gray-600">
                    <span>Người tạo: <span class="font-medium">${order.createdBy}</span></span>
                    <span class="mx-2">|</span>
                    <span>Thời gian: ${createdDate}</span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-sm text-gray-600">Tổng số điểm: <span class="font-bold text-blue-600">${order.totalPoints}</span></div>
                  <div class="text-sm text-gray-600">Tổng giá trị: <span class="font-bold text-green-600">${amount}</span></div>
                </div>
              </div>
            `;
          }
          
          if (listEl) {
            let html = '';
            order.quotes.forEach((quote, idx) => {
              const quoteKey = getQuoteKey(quote);
              const quoteCode = (typeof formatQuoteCode === 'function' && quote.quote_code) ? formatQuoteCode(quote) : (quote.quote_code || '-');
              const amount = typeof formatCurrency === 'function' ? formatCurrency(quote.total_amount || 0) : (quote.total_amount || 0);
              
              html += `
                <div class="flex items-center px-2 py-2 border-b border-gray-100 hover:bg-gray-50 text-sm">
                  <div class="w-16 text-gray-600">${idx + 1}</div>
                  <div class="w-24 font-medium text-blue-600">${quoteCode}</div>
                  <div class="w-20">${quote.area || '-'}</div>
                  <div class="w-28 text-center">${quote.spo_number || '-'}</div>
                  <div class="w-28">${quote.outlet_code || '-'}</div>
                  <div class="w-72 min-w-0 truncate">${quote.outlet_name || '-'}</div>
                  <div class="w-36 truncate">${quote.sale_name || '-'}</div>
                  <div class="w-24 text-right font-medium text-green-600">${amount}</div>
                  <div class="w-20 text-center">
                    <button class="pending-detail-remove-quote-btn text-red-500 hover:text-red-700 p-1" data-quote-key="${quoteKey}" title="Xóa báo giá">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              `;
            });
            
            if (order.quotes.length === 0) {
              html = '<div class="p-8 text-center text-gray-500">Chưa có báo giá nào trong đơn này</div>';
            }
            
            listEl.innerHTML = html;
            
            // Bind remove quote buttons
            listEl.querySelectorAll('.pending-detail-remove-quote-btn').forEach(btn => {
              btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const quoteKey = btn.dataset.quoteKey;
                removeQuoteFromPendingOrder(order.id, quoteKey);
              });
            });
          }
        }
        
        // Remove a quote from a specific pending order
        function removeQuoteFromPendingOrder(orderId, quoteKey) {
          const order = pendingOrders.find(o => o.id === orderId);
          if (!order) return;
          
          const removedQuote = order.quotes.find(q => getQuoteKey(q) === quoteKey);
          if (!removedQuote) return;
          
          // Remove quote from order
          order.quotes = order.quotes.filter(q => getQuoteKey(q) !== quoteKey);
          
          // Update order totals
          order.totalPoints = order.quotes.length;
          order.totalAmount = 0;
          order.quotes.forEach(q => {
            order.totalAmount += parseMoney(q.total_amount) || 0;
          });
          
          // Add quote back to selection list
          currentQuotes.push(removedQuote);
          productionModalQuotesToFilter.push(removedQuote);
          productionModalFilteredQuotes.push(removedQuote);
          
          // If order is now empty, remove it
          if (order.quotes.length === 0) {
            pendingOrders = pendingOrders.filter(o => o.id !== orderId);
            // Close detail modal
            const detailModal = document.getElementById('pending-order-detail-modal');
            if (detailModal) detailModal.classList.add('hidden');
            ensureScrollLock();
          } else {
            // Re-render detail modal
            renderPendingOrderDetail(order);
          }
          
          // Update pending list and counts
          renderPendingOrdersList();
          updatePendingCount();
          savePendingOrdersToStorage();
          
          showToast('Đã xóa báo giá khỏi đơn');
        }
        
        // Save a single pending order as production order
        async function saveSinglePendingOrder(orderId) {
          const order = pendingOrders.find(o => o.id === orderId);
          if (!order) return;
          
          if (order.quotes.length === 0) {
            showToast('Đơn này không có báo giá nào');
            return;
          }
          
          // Use the existing saveToManagement logic
          currentProductionData = order.quotes;
          
          // Call existing save function
          await saveToManagement();
          
          // If save successful, remove this order from pending
          if (currentProductionData.length === 0) {
            pendingOrders = pendingOrders.filter(o => o.id !== orderId);
            updatePendingCount();
            savePendingOrdersToStorage();
            renderPendingOrdersList();
            
            // Close detail modal if open
            const detailModal = document.getElementById('pending-order-detail-modal');
            if (detailModal && !detailModal.classList.contains('hidden')) {
              detailModal.classList.add('hidden');
              ensureScrollLock();
            }
          }
        }
        
        // Save pending orders as production orders
        async function savePendingAsProductionOrder() {
          if (pendingOrders.length === 0) {
            showToast('Không có đơn chờ duyệt nào');
            return;
          }
          
          // Combine all quotes from all pending orders
          let allQuotes = [];
          pendingOrders.forEach(order => {
            allQuotes = allQuotes.concat(order.quotes);
          });
          
          // Use the existing saveToManagement logic with all quotes
          currentProductionData = allQuotes;
          
          // Call existing save function
          await saveToManagement();
          
          // If save successful, clear pending orders
          if (currentProductionData.length === 0) {
            pendingOrders = [];
            updatePendingCount();
            savePendingOrdersToStorage();
            // Close production modal
            closeProductionModal(false);
            // Reset tab to select
            switchProductionTab('select');
          }
        }
        
        // Open modal to add more quotes to current viewing order
        function openAddQuotesToOrderModal() {
          if (!currentViewingOrderId) return;
          
          const order = pendingOrders.find(o => o.id === currentViewingOrderId);
          if (!order) return;
          
          // Switch back to select tab
          switchProductionTab('select');
          
          // Clear current selection
          selectedQuotes.clear();
          
          // Hide detail modal but keep it for return
          const detailModal = document.getElementById('pending-order-detail-modal');
          if (detailModal) detailModal.classList.add('hidden');
          
          // Show message to user
          showToast('Chọn báo giá để thêm vào đơn, sau đó nhấn "Thêm Vào Đơn Này"');
          
          // Change button text temporarily
          const createBtn = document.getElementById('create-production-list');
          if (createBtn) {
            createBtn.textContent = 'Thêm Vào Đơn Này';
            createBtn._addingToOrder = currentViewingOrderId;
          }
        }
        
        // Setup production modal tab handlers (call once)
        function setupProductionModalTabHandlers() {
          const modal = document.getElementById('production-order-modal');
          if (!modal || modal._tabHandlersBound) return;
          modal._tabHandlersBound = true;
          
          // Tab buttons
          const tabSelect = document.getElementById('production-tab-select');
          const tabPending = document.getElementById('production-tab-pending');
          
          if (tabSelect) tabSelect.addEventListener('click', () => switchProductionTab('select'));
          if (tabPending) tabPending.addEventListener('click', () => switchProductionTab('pending'));
          
          // Pending tab buttons
          const clearAllBtn = document.getElementById('pending-clear-all');
          const backBtn = document.getElementById('pending-back-to-select');
          const saveBtn = document.getElementById('pending-save-order');
          
          if (clearAllBtn) clearAllBtn.addEventListener('click', clearPendingList);
          if (backBtn) backBtn.addEventListener('click', () => switchProductionTab('select'));
          if (saveBtn) saveBtn.addEventListener('click', savePendingAsProductionOrder);
          
          // Pending search
          const searchInput = document.getElementById('pending-search');
          if (searchInput) {
            searchInput.addEventListener('input', () => {
              renderPendingOrdersList();
            });
          }
          
          // Setup detail modal close button
          const detailModal = document.getElementById('pending-order-detail-modal');
          if (detailModal && !detailModal._closeHandlerBound) {
            detailModal._closeHandlerBound = true;
            const closeBtn = document.getElementById('close-pending-order-detail-modal');
            const closeBtn2 = document.getElementById('pending-detail-close');
            const addMoreBtn = document.getElementById('pending-detail-add-more');
            
            if (closeBtn) {
              closeBtn.addEventListener('click', () => {
                detailModal.classList.add('hidden');
                currentViewingOrderId = null;
                ensureScrollLock();
              });
            }
            
            if (closeBtn2) {
              closeBtn2.addEventListener('click', () => {
                detailModal.classList.add('hidden');
                currentViewingOrderId = null;
                ensureScrollLock();
              });
            }
            
            if (addMoreBtn) {
              addMoreBtn.addEventListener('click', () => {
                openAddQuotesToOrderModal();
              });
            }
          }
        }
        
        // ========== END PRODUCTION MODAL TAB FUNCTIONS ==========
