
    // Helper function to update quote data across all modals and cached locations
    function updateQuoteInAllModals(quoteKey, updatedQuoteData) {
      if (!quoteKey || !updatedQuoteData) return;
      
      try {
        // 1. Update in Production Orders
        const found = findQuoteInProductionOrders(quoteKey);
        if (found) {
          const { order, orderIndex, quoteIndex } = found;
          let quotes = [];
          try { quotes = JSON.parse(order.items || '[]'); } catch (e) { quotes = []; }
          
          if (Array.isArray(quotes) && quotes[quoteIndex]) {
            // Merge updated data into production order quote
            quotes[quoteIndex] = { 
              ...quotes[quoteIndex], 
              ...updatedQuoteData,
              // Clear pending flags
              __updatedSinceQc: undefined,
              __itemsChanged: undefined,
              __imagesChanged: undefined,
              added_items_notes: undefined,
              qcag_override_status: null,
              qcag_note: null,
              qcag_at: null,
              __overrideClearing: true
            };
            
            // Clean undefined fields
            Object.keys(quotes[quoteIndex]).forEach(k => {
              if (quotes[quoteIndex][k] === undefined) delete quotes[quoteIndex][k];
            });
            
            const updatedOrder = { ...order, items: JSON.stringify(quotes) };
            productionOrders[orderIndex] = updatedOrder;
            
            // Save to backend
            if (window.dataSdk && typeof window.dataSdk.update === 'function') {
              window.dataSdk.update(updatedOrder).catch(() => {});
            }
          }
        }
        
        // 2. Update in Xin Phép modal if it has the quote
        if (window.__lastXinphepList && Array.isArray(window.__lastXinphepList)) {
          const xinphepIndex = window.__lastXinphepList.findIndex(q => {
            const qk = q.quote_key || q.quote_code || q.quoteCode || '';
            return String(qk) === String(quoteKey);
          });
          
          if (xinphepIndex >= 0) {
            // Parse items for clean format
            let cleanItems = [];
            try {
              const items = JSON.parse(updatedQuoteData.items || '[]');
              cleanItems = items.map(it => ({
                code: it.code || '',
                content: it.content || '',
                brand: it.brand || '',
                width: it.width || '',
                height: it.height || '',
                quantity: it.quantity || '',
                unit: it.unit || '',
                price: it.price || '',
                total: it.total || ''
              }));
            } catch (e) { cleanItems = []; }
            
            // Update xinphep list entry
            window.__lastXinphepList[xinphepIndex] = {
              ...window.__lastXinphepList[xinphepIndex],
              outlet_code: updatedQuoteData.outlet_code || '',
              outlet_name: updatedQuoteData.outlet_name || '',
              area: updatedQuoteData.area || '',
              sale_type: updatedQuoteData.sale_type || '',
              sale_name: updatedQuoteData.sale_name || '',
              sale_phone: updatedQuoteData.sale_phone || '',
              outlet_phone: updatedQuoteData.outlet_phone || '',
              address: updatedQuoteData.address || '',
              spo_number: updatedQuoteData.spo_number || '',
              items: JSON.stringify(cleanItems),
              quote_code: updatedQuoteData.quote_code || ''
            };
            
            // Re-render xinphep modal if it's visible
            const xinphepModal = document.getElementById('xinphep-modal');
            if (xinphepModal && !xinphepModal.classList.contains('hidden')) {
              if (typeof window.renderXinphepList === 'function') {
                window.renderXinphepList(window.__lastXinphepList);
              }
            }
          }
        }
        
        // 3. Refresh Acceptance modal if it's open
        try {
          const adm = document.getElementById('acceptance-detail-modal');
          if (adm && !adm.classList.contains('hidden')) {
            try { renderAcceptanceDetailModal(); } catch (e) {}
            try { renderAcceptanceImages(); } catch (e) {}
            try { 
              if (window.__renderAcceptanceProductionOrders) {
                window.__renderAcceptanceProductionOrders(); 
              }
            } catch (e) {}
          }
        } catch (e) {}
        
        // 4. Refresh Manage Production Orders modal if it's open
        try {
          const manageModal = document.getElementById('manage-production-orders-modal');
          if (manageModal && !manageModal.classList.contains('hidden')) {
            renderProductionOrdersList(productionOrders);
          }
        } catch (e) {}
        
        // 5. Refresh QC Signage modal if it's open
        try {
          const qcModal = document.getElementById('qc-signage-modal');
          if (qcModal && !qcModal.classList.contains('hidden') && typeof renderQcSignageModal === 'function') {
            renderQcSignageModal();
          }
        } catch (e) {}
        
        // 6. Clear pending flags everywhere
        try { 
          if (typeof clearPendingFlagsEverywhere === 'function') {
            clearPendingFlagsEverywhere(String(quoteKey || '')); 
          }
        } catch (_) {}
        
        console.log('[UPDATE] Updated quote in all modals:', quoteKey);
      } catch (error) {
        console.error('[UPDATE] Error updating quote in all modals:', error);
      }
    }

    // Form Submit
    document.getElementById('quote-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const isEditing = !!currentEditingQuoteKey;
      let globalLoadingToken = null;
      try {
        if (window.QcLoading && typeof window.QcLoading.show === 'function') {
          globalLoadingToken = window.QcLoading.show('Đang lưu...');
        }
      } catch (e) {}
      
      // Wait for maquette upload to complete before proceeding
      if (window.maquetteUploadInProgress) {
        try {
          if (window.QcLoading && typeof window.QcLoading.show === 'function') {
            if (globalLoadingToken) window.QcLoading.hide(globalLoadingToken);
            globalLoadingToken = window.QcLoading.show('Đang tải ảnh lên...');
          }
        } catch (e) {}
        // Poll every 200ms for max 30 seconds
        let waitCount = 0;
        while (window.maquetteUploadInProgress && waitCount < 150) {
          await new Promise(resolve => setTimeout(resolve, 200));
          waitCount++;
        }
        try {
          if (window.QcLoading && typeof window.QcLoading.show === 'function') {
            if (globalLoadingToken) window.QcLoading.hide(globalLoadingToken);
            globalLoadingToken = window.QcLoading.show('Đang lưu...');
          }
        } catch (e) {}
      }
      if (!isEditing && currentQuotes.length >= 999) {
        showToast('Đã đạt giới hạn 999 báo giá. Vui lòng xóa bớt báo giá cũ.');
        try { if (globalLoadingToken && window.QcLoading) window.QcLoading.hide(globalLoadingToken); } catch (e) {}
        return;
      }

      const submitBtn = document.getElementById('submit-btn');
      const submitText = document.getElementById('submit-text');
      const submitSpinner = document.getElementById('submit-spinner');
      submitBtn.disabled = true;
      submitSpinner.classList.remove('hidden');
      submitText.textContent = 'Đang lưu...';

      const container = document.getElementById('items-container');
      const itemElements = container.querySelectorAll('[data-item-id]');
      const items = Array.from(itemElements).map(item => ({
        code: item.querySelector('.item-code').value,
        content: item.querySelector('.item-content').value,
        brand: item.querySelector('.item-brand').value,
        width: item.querySelector('.item-width').value,
        height: item.querySelector('.item-height').value,
        quantity: item.querySelector('.item-quantity').value,
        unit: item.querySelector('.item-unit').value,
        price: item.querySelector('.item-price').value,
        total: item.querySelector('.item-total').value
      }));

      if (items.length === 0) {
        showToast('Vui lòng thêm ít nhất một hạng mục.');
        submitBtn.disabled = false;
        submitSpinner.classList.add('hidden');
        submitText.textContent = isEditing ? 'Lưu thay đổi' : 'Xác Nhận';
        try { if (globalLoadingToken && window.QcLoading) window.QcLoading.hide(globalLoadingToken); } catch (e) {}
        return;
      }

      const totalAmount = parseFloat(document.getElementById('total-amount').textContent.replace(/[^\d]/g, ''));
      const existingQuote = isEditing ? findQuoteByKey(currentEditingQuoteKey) : null;
      let quoteCode;
      try {
        // Priority: existing quote code > maquette upload code > pre-generated code > generate new
        // This ensures folder name consistency with uploaded maquette images
        quoteCode = existingQuote?.quote_code || maquetteUploadQuoteCode || newQuoteCodePreGenerated || generateQuoteCode();
      } catch (err) {
        showToast(err?.message || 'Không thể tạo mã báo giá mới');
        submitBtn.disabled = false;
        submitSpinner.classList.add('hidden');
        submitText.textContent = isEditing ? 'Lưu thay đổi' : 'Xác Nhận';
        try { if (globalLoadingToken && window.QcLoading) window.QcLoading.hide(globalLoadingToken); } catch (e) {}
        return;
      }
      const quoteId = existingQuote?.id || Date.now().toString();
      const createdAt = existingQuote?.created_at || new Date().toISOString();
      const spoNumber = existingQuote?.spo_number || '';
      const spoStatus = existingQuote?.spo_status || (spoNumber ? 'Chưa cập nhật trạng thái' : 'Chưa có SPO');

      const outletInput = document.getElementById('outlet-code');
      const normalizedOutletCode = normalizeOutletCode(outletInput ? outletInput.value : '');
      if (outletInput) outletInput.value = normalizedOutletCode;

      const quoteData = {
        ...(existingQuote || {}),
        __backendId: existingQuote?.__backendId,
        id: quoteId,
        quote_code: quoteCode,
        outlet_code: normalizedOutletCode,
        outlet_name: document.getElementById('outlet-name').value,
        spo_name: document.getElementById('spo-name').value.trim(),
        area: document.getElementById('area').value,
        outlet_phone: document.getElementById('outlet-phone').value.trim(),
        sale_type: window.saleType === 'TBA' ? 'TBA' : 'Sale (SR)',
        sale_code: document.getElementById('sale-code').value,
        sale_name: document.getElementById('sale-name').value,
        sale_phone: document.getElementById('sale-phone').value.trim(),
        ss_name: document.getElementById('ss-name').value,
        house_number: document.getElementById('house-number')?.value.trim() || '',
        street: document.getElementById('street-name')?.value.trim() || '',
        ward: document.getElementById('ward-hamlet')?.value.trim() || '',
        district: document.getElementById('commune-ward')?.value.trim() || '',
        province: document.getElementById('province-city')?.value.trim() || '',
        address: document.getElementById('full-address').textContent,
        items: JSON.stringify(items),
        images: JSON.stringify(window.currentQuoteImages || []),
        total_amount: totalAmount,
        created_at: createdAt,
        updated_at: new Date().toISOString(),
        spo_number: spoNumber,
        spo_status: spoStatus
      };

      // When user updates/saves the quote, clear the QCAG "needs update" overlay flags
      // (overlay is set by Acceptance Detail cancel/add actions and should disappear after quote is updated)
      try {
        delete quoteData.__updatedSinceQc;
        delete quoteData.__itemsChanged;
        delete quoteData.__imagesChanged;
        // If user submitted the quote, any "added_items_notes" were incorporated
        // into the saved quote content and should no longer signal a pending update.
        if (quoteData && quoteData.added_items_notes) delete quoteData.added_items_notes;
        // Persistently clear QCAG override when saving the quote
        quoteData.qcag_override_status = null;
        quoteData.qcag_note = null;
        quoteData.qcag_at = null;
        quoteData.__overrideClearing = true; // suppress UI flicker while backend clears
      } catch (e) {}
      // Also clear flags on the in-memory currentQuotes entry (so main list UI updates)
      try {
        const qKey = getQuoteKey && typeof getQuoteKey === 'function' ? getQuoteKey(quoteData) : (quoteData && (quoteData.quote_code || quoteData.id || quoteData.__backendId));
        if (qKey && Array.isArray(currentQuotes)) {
          const idx = currentQuotes.findIndex(q => (typeof getQuoteKey === 'function' ? getQuoteKey(q) : '') === String(qKey));
          if (idx >= 0) {
            delete currentQuotes[idx].__updatedSinceQc;
            delete currentQuotes[idx].__itemsChanged;
            delete currentQuotes[idx].__imagesChanged;
            if (currentQuotes[idx].added_items_notes) delete currentQuotes[idx].added_items_notes;
            currentQuotes[idx].qcag_override_status = null;
            currentQuotes[idx].qcag_note = null;
            currentQuotes[idx].qcag_at = null;
            currentQuotes[idx].__overrideClearing = true;
            try { updateMainList(); } catch (e) {}
              // If Acceptance Detail modal is open, re-render it so overlays update immediately
              try {
                const adm = document.getElementById && document.getElementById('acceptance-detail-modal');
                if (adm && !adm.classList.contains('hidden')) {
                  try { renderAcceptanceDetailModal(); } catch (e) {}
                  try { renderAcceptanceImages(); } catch (e) {}
                  try { window.__renderAcceptanceProductionOrders && window.__renderAcceptanceProductionOrders(); } catch (e) {}
                }
              } catch (e) {}
          }
        }
        // Clear any other cached copies (productionOrders, acceptance refs)
        try { clearPendingFlagsEverywhere(String(qKey || '')); } catch (_) {}
      } catch (e) {}
      try {
        console.log('[SUBMIT] cleared pending flags for', (typeof getQuoteKey === 'function' ? getQuoteKey(quoteData) : '<no-key>'), quoteData && {__updatedSinceQc: quoteData.__updatedSinceQc, __itemsChanged: quoteData.__itemsChanged, __imagesChanged: quoteData.__imagesChanged});
      } catch (e) {}
      cacheQuoteCode(getQuoteIdentityKey(quoteData), quoteCode);

      // If images were updated during this edit/create session, append a maquette update note
      try {
        if (window.quoteImagesUpdatedDuringEdit) {
          let notes = [];
          try { notes = JSON.parse(quoteData.added_items_notes || '[]') || []; } catch (e) { notes = []; }
          notes.push('Vừa update Maquette mới.');
          quoteData.added_items_notes = JSON.stringify(notes);
          // mark images changed so UI/overlays can react
          quoteData.__imagesChanged = true;
        }
      } catch (e) {}
      // reset session flag
      window.quoteImagesUpdatedDuringEdit = false;

      const pushQuoteToTop = (quote) => {
        if (!quote) return;
        ensureQuoteCodeForQuote(quote);
        const key = getQuoteKey(quote);
        const existingIdx = currentQuotes.findIndex(q => getQuoteKey(q) === key);
        if (existingIdx >= 0) {
          currentQuotes.splice(existingIdx, 1);
        }
        currentQuotes.unshift(quote);
        pendingJumpToFirstPage = true;
        listPage = 1;
        outletPage = 1;
        viewMode = 'list';
        updateMainList();
      };

      const buildEditSummary = (prev, next) => {
        if (!prev || !next) return '';
        const changes = [];
        const diff = (label, a, b) => {
          if ((a || '') !== (b || '')) changes.push(`${label}: '${a || '-'}' → '${b || '-'}'`);
        };

        diff('Outlet', prev.outlet_name, next.outlet_name);
        diff('Outlet code', prev.outlet_code, next.outlet_code);
        diff('Khu vực', prev.area, next.area);
        diff('Sale', prev.sale_name, next.sale_name);
        diff('Loại sale', prev.sale_type, next.sale_type);
        diff('Điện thoại outlet', prev.outlet_phone, next.outlet_phone);
        diff('Địa chỉ', prev.address, next.address);

        const parseItems = (q) => {
          try { const arr = JSON.parse(q.items || '[]'); return Array.isArray(arr) ? arr : []; } catch (_) { return []; }
        };
        const oldItems = parseItems(prev);
        const newItems = parseItems(next);
        const keyOf = (it) => `${it.code || ''}__${(it.content || '').toLowerCase()}`;
        const mapOld = new Map(oldItems.map(it => [keyOf(it), it]));
        const mapNew = new Map(newItems.map(it => [keyOf(it), it]));

        const added = [];
        const removed = [];
        mapNew.forEach((it, key) => { if (!mapOld.has(key)) added.push(it); });
        mapOld.forEach((it, key) => { if (!mapNew.has(key)) removed.push(it); });

        if (added.length) changes.push(`Thêm hạng mục: ${added.map(it => it.content || it.code || 'Không tên').join(', ')}`);
        if (removed.length) changes.push(`Xóa hạng mục: ${removed.map(it => it.content || it.code || 'Không tên').join(', ')}`);

        const oldTotalNum = parseFloat(prev.total_amount) || 0;
        const newTotalNum = parseFloat(next.total_amount) || 0;
        if (oldTotalNum !== newTotalNum) {
          changes.push(`Tổng tiền: ${formatCurrency(oldTotalNum)} → ${formatCurrency(newTotalNum)}`);
        }

        // If no explicit changes but same count, still log item count to give context
        if (!added.length && !removed.length && oldItems.length !== newItems.length) {
          changes.push(`Số hạng mục: ${oldItems.length} → ${newItems.length}`);
        }

        return changes.length ? `Chỉnh sửa báo giá:\n- ${changes.join('\n- ')}` : 'Chỉnh sửa báo giá (không thay đổi nội dung)';
      };

      try {
        if (!isEditing) {
          const createPromise = (window.dataSdk && typeof window.dataSdk.create === 'function')
            ? window.dataSdk.create(quoteData)
            : Promise.resolve({ isOk: false, error: new Error('Data SDK không khả dụng') });
          const timeout = new Promise(resolve => setTimeout(() => resolve({ isOk: false, error: new Error('Quá thời gian chờ lưu dữ liệu') }), 15000));
          const result = await Promise.race([createPromise, timeout]);

          if (result && result.isOk) {
            showToast('Đã tạo báo giá thành công!');
            // If backend returned the created quote, merge and push it so UI updates immediately
            try {
              const created = result.data || null;
              if (created) {
                const merged = Object.assign({}, quoteData || {}, (typeof created === 'object' ? created : {}));
                try { pushQuoteToTop(merged); } catch (e) { /* ignore push errors */ }
              }
            } catch (e) { /* ignore merge errors */ }
            // Persist any maquette images that were uploaded during create session
            try {
              const finalQuoteCode = (result && result.data && result.data.quote_code) ? result.data.quote_code : quoteCode;
              if (finalQuoteCode && Array.isArray(window.currentQuoteImages) && window.currentQuoteImages.length) {
                try { await saveQuoteImages(finalQuoteCode, window.currentQuoteImages, { render: false }); } catch (e) { /* ignore save errors */ }
              }
            } catch (e) { /* ignore */ }

            newQuoteCodePreGenerated = null; // Clear after successful creation
            maquetteUploadQuoteCode = null; // Clear maquette upload code
            closeModal();
          } else {
            if (!window.dataSdk || typeof window.dataSdk.create !== 'function') {
              pushQuoteToTop({ ...quoteData });
              showToast('Đã lưu tạm vào bộ nhớ. Kết nối dữ liệu chưa sẵn sàng.');
              closeModal();
            } else {
              const msg = result && result.error ? (result.error.message || String(result.error)) : 'Lỗi không xác định';
              showToast(`Lỗi khi tạo báo giá: ${msg}`);
            }
          }
        } else {
          const updatePromise = (window.dataSdk && typeof window.dataSdk.update === 'function')
            ? window.dataSdk.update(quoteData)
            : Promise.resolve({ isOk: true, localOnly: true });
          const result = await updatePromise;
          const success = result && (result.isOk === true || result.isOk === undefined || result === true);
          if (!success && window.dataSdk && typeof window.dataSdk.update === 'function') {
            showToast('Lỗi khi cập nhật báo giá');
          } else {
            pushQuoteToTop({ ...quoteData });

            // Update quote in all modals and cached locations
            try {
              const qKey = getQuoteKey(quoteData);
              updateQuoteInAllModals(qKey, quoteData);
            } catch (e) {
              console.error('Error updating quote in all modals:', e);
            }

            const summary = buildEditSummary(existingQuote, quoteData);
            addSystemNoteForQuote(getQuoteKey(quoteData), summary);
            showToast(window.dataSdk && typeof window.dataSdk.update === 'function' ? 'Đã cập nhật báo giá' : 'Đã cập nhật (local)');
            closeModal();
            currentEditingQuoteKey = null;
            maquetteUploadQuoteCode = null; // Clear maquette upload code
            setQuoteModalMode('create');
          }
        }
      } catch (err) {
        console.error('Submit quote error:', err);
        showToast(`Lỗi khi lưu báo giá: ${err && err.message ? err.message : 'Không xác định'}`);
      } finally {
        submitBtn.disabled = false;
        submitSpinner.classList.add('hidden');
        submitText.textContent = isEditing ? 'Lưu thay đổi' : 'Xác Nhận';
        try { if (globalLoadingToken && window.QcLoading) window.QcLoading.hide(globalLoadingToken); } catch (e) {}
      }
    });

    // Backward-compatible wrapper; keep signature but use new renderers
    function renderQuotesList(/* quotes (unused) */) { updateMainList(); }

    // Prep collapsible rows lazily to avoid rendering cost up-front
    function prepareCollapsibleRow(row) {
      if (!row || row.dataset.collapseReady === '1') return;
      row.dataset.collapseReady = '1';
      row.classList.remove('hidden');
      row.classList.add('collapsible-row');
      if (!row.dataset.collapseGroup) {
        const id = row.id || '';
        if (id.startsWith('details-')) {
          row.dataset.collapseGroup = 'quote-details';
        } else if (id.startsWith('outlet_')) {
          row.dataset.collapseGroup = 'outlet';
        }
      }
      const cell = row.querySelector('td');
      if (!cell) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'collapsible';
      while (cell.firstChild) {
        wrapper.appendChild(cell.firstChild);
      }
      cell.appendChild(wrapper);
      wrapper.style.maxHeight = '0px';
    }

    function __qcagBuildQuoteDetailsHtml(quote, rowKey) {
      if (!quote) {
        return '<div class="text-sm text-gray-500">Không tìm thấy dữ liệu chi tiết</div>';
      }
      let items = [];
      try {
        if (typeof __qcagSafeParseJsonArray === 'function') items = __qcagSafeParseJsonArray(quote.items);
        else items = JSON.parse(quote.items || '[]');
      } catch (e) { items = []; }
      if (!Array.isArray(items)) items = [];

      let imgs = [];
      try {
        if (typeof __qcagSafeParseJsonArray === 'function') imgs = __qcagSafeParseJsonArray(quote.images);
        else imgs = JSON.parse(quote.images || '[]');
      } catch (e) { imgs = []; }
      if (!Array.isArray(imgs)) imgs = [];

      const saleBadgeClass = quote.sale_type === 'TBA' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';
      const created = quote.created_at ? new Date(quote.created_at).toLocaleDateString('vi-VN') : '';
      const addressHtml = (quote.address && quote.address !== 'Địa chỉ sẽ hiển thị tự động khi nhập')
        ? `<div><span class=\"font-medium text-gray-700\">Địa chỉ:</span> <span class=\"text-gray-600\">${quote.address}</span></div>`
        : '';

      const imagesHtml = (!imgs.length)
        ? '<div class="text-xs text-gray-400">Không có hình</div>'
        : `<div class="w-64 flex-shrink-0"><h4 class="font-semibold text-gray-800 mb-2 text-sm">Hình ảnh (${imgs.length})</h4><div class="grid grid-cols-2 gap-2">${imgs.map(im => {
            const data = (im && im.data) ? im.data : '';
            const name = (im && im.name) ? String(im.name) : '';
            const safeName = name.replace(/'/g, '&#39;');
            return `<div class=\"border rounded bg-white overflow-hidden cursor-pointer\" onclick=\"event.stopPropagation(); openImageViewer('${data}','${safeName}')\"><img src='${data}' alt='${safeName}' class=\"w-full h-24 object-cover\"></div>`;
          }).join('')}</div></div>`;

      const notesPreview = (typeof renderNotesPreviewHTML === 'function') ? renderNotesPreviewHTML(quote) : '';

      return `
        <div class="flex gap-3">
          <!-- Cột trái 75%: Chi tiết báo giá -->
          <div class="flex-[3] space-y-4">
            <div class="flex justify-between items-start gap-6">
              <div class="text-sm space-y-2">
                <div class="flex flex-wrap gap-4">
                  <div>
                    <span class="font-medium text-gray-700">Chức vụ:</span>
                    <span class="px-2 py-1 text-xs font-medium rounded ml-1 ${saleBadgeClass}">${quote.sale_type || 'Sale (SR)'}</span>
                  </div>
                  ${quote.sale_code ? `<div><span class=\"font-medium text-gray-700\">Mã Sale:</span> <span class=\"text-gray-600\">${quote.sale_code}</span></div>` : ''}
                  ${quote.sale_name ? `<div><span class=\"font-medium text-gray-700\">Tên Sale:</span> <span class=\"text-gray-600\">${quote.sale_name}</span></div>` : ''}
                  ${quote.ss_name ? `<div><span class=\"font-medium text-gray-700\">Tên SS:</span> <span class=\"text-gray-600\">${quote.ss_name}</span></div>` : ''}
                </div>
                <div class="flex flex-wrap gap-4 mt-2">
                  <div>
                    <span class="font-medium text-gray-700">Ngày tạo:</span>
                    <span class="text-gray-600">${created}</span>
                  </div>
                  ${quote.spo_number ? `<div><span class=\"font-medium text-gray-700\">Số SPO:</span> <span class=\"text-blue-600 font-medium\">${quote.spo_number}</span></div>` : ''}
                  ${addressHtml}
                </div>
              </div>
              ${imagesHtml}
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
                    ${items.map(item => {
                      const size = (item.width && item.height) ? `${item.width}m × ${item.height}m` : '-';
                      return `
                        <tr class="hover:bg-gray-50">
                          <td class="px-3 py-2 text-gray-900 font-medium">${item.code || ''}</td>
                          <td class="px-3 py-2 text-gray-700">${item.content || ''}</td>
                          <td class="px-3 py-2 text-gray-600">${item.brand || '-'}</td>
                          <td class="px-3 py-2 text-gray-600">${size}</td>
                          <td class="px-3 py-2 text-gray-900">${item.quantity || ''}</td>
                          <td class="px-3 py-2 text-gray-600">${item.unit || ''}</td>
                          <td class="px-3 py-2 text-gray-900">${formatCurrency(parseMoney(item.price) || 0)}</td>
                          <td class="px-3 py-2 text-blue-600 font-semibold">${formatCurrencyExact((parseMoney(item.price) || 0) * (parseNumber(item.quantity) || 0))}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
              <div class="flex justify-end">
                <span class="text-lg font-bold text-blue-600">Tổng cộng: ${formatCurrency(parseMoney(quote.total_amount)||0)}</span>
              </div>
            </div>
          </div>
          <!-- Cột phải 25%: Xem nhanh ghi chú -->
          <div class="flex-1 notes-preview" data-notes-preview="${rowKey}">${notesPreview}</div>
        </div>
      `;
    }

    function __qcagEnsureQuoteDetailsLoaded(detailRow, key) {
      if (!detailRow || !key) return;
      if (detailRow.dataset.detailsLoaded === '1') return;
      let quote = null;
      try {
        quote = currentQuotes.find(q => (typeof getQuoteKey === 'function') ? getQuoteKey(q) === key : false) || null;
      } catch (e) { quote = null; }

      const html = __qcagBuildQuoteDetailsHtml(quote, key);
      const panel = detailRow.querySelector('.collapsible');
      const td = detailRow.querySelector('td');
      if (panel) {
        panel.innerHTML = html;
      } else if (td) {
        td.innerHTML = html;
      }
      detailRow.dataset.detailsLoaded = '1';
    }

    const nextFrame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb) => setTimeout(cb, 16);

    function getScrollContainer(el) {
      if (!el || typeof window === 'undefined') {
        return document.scrollingElement || document.documentElement || document.body;
      }
      let node = el.parentElement;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY || style.overflow;
        if (/(auto|scroll)/i.test(overflowY) && node.scrollHeight > node.clientHeight + 2) {
          return node;
        }
        node = node.parentElement;
      }
      return document.scrollingElement || document.documentElement || document.body;
    }

    function measureRowOffset(row, container) {
      if (!row) return 0;
      const isRoot = container === document.body || container === document.documentElement || container === document.scrollingElement;
      const containerRect = isRoot ? null : container.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      return rowRect.top - (containerRect ? containerRect.top : 0);
    }

    function pinRowDuringAnimation(row, panel) {
      if (!row || !panel) return () => {};
      const scrollEl = getScrollContainer(row);
      const baseTop = measureRowOffset(row, scrollEl);
      let running = true;

      const tick = () => {
        if (!running) return;
        const currentTop = measureRowOffset(row, scrollEl);
        const delta = currentTop - baseTop;
        if (Math.abs(delta) > 0.25) {
          scrollEl.scrollTop += delta;
        }
        nextFrame(tick);
      };
      nextFrame(tick);

      const stop = () => { running = false; };
      const onEnd = (evt) => {
        if (evt && (evt.target !== panel || (evt.propertyName && evt.propertyName !== 'max-height'))) return;
        stop();
        panel.removeEventListener('transitionend', onEnd);
      };
      panel.addEventListener('transitionend', onEnd);
      setTimeout(stop, 900);
      return stop;
    }

    function setCollapsibleState(row, shouldOpen) {
      if (!row) return;
      prepareCollapsibleRow(row);
      const panel = row.querySelector('.collapsible');
      if (!panel) return;

      const handleTransitionEnd = (evt) => {
        if (evt.target !== panel || evt.propertyName !== 'max-height') return;
        if (shouldOpen) {
          panel.style.maxHeight = 'none';
        } else {
          panel.style.maxHeight = '';
        }
        panel.removeEventListener('transitionend', handleTransitionEnd);
      };
      panel.addEventListener('transitionend', handleTransitionEnd);

      if (shouldOpen) {
        panel.style.maxHeight = 'none';
        const targetHeight = panel.scrollHeight;
        panel.style.maxHeight = '0px';
        nextFrame(() => {
          row.classList.add('open');
          panel.classList.add('open');
          panel.style.maxHeight = `${targetHeight}px`;
        });
      } else {
        panel.style.maxHeight = 'none';
        const currentHeight = panel.scrollHeight;
        panel.style.maxHeight = `${currentHeight}px`;
        void panel.offsetHeight;
        nextFrame(() => {
          row.classList.remove('open');
          panel.classList.remove('open');
          panel.style.maxHeight = '0px';
        });
      }
    }

    // Toggle Quote Details
    window.toggleQuoteDetails = function(key) {
      const detailRow = document.getElementById(`details-${key}`);
      if (!detailRow) return;

      const willOpen = !detailRow.classList.contains('open');
      if (willOpen) {
        try { __qcagEnsureQuoteDetailsLoaded(detailRow, key); } catch (e) { /* ignore */ }
      }

      // Prepare once: unwrap hidden/content into .collapsible and keep it in flow (no display none)
      prepareCollapsibleRow(detailRow);

      const panel = detailRow.querySelector('.collapsible');
      if (!panel) return;

      const headerRow = document.querySelector(`tr[data-row-key="${key}"]`) || detailRow.previousElementSibling;
      // willOpen computed above

      // Keep level-1 row visually locked while level-2 animates height
      const stopPin = pinRowDuringAnimation(headerRow || detailRow, panel);

      // Close other detail rows in the same group without letting header rows jump
      document.querySelectorAll('tr[data-collapse-group="quote-details"].open').forEach(row => {
        if (row !== detailRow) {
          setCollapsibleState(row, false);
        }
      });

      setCollapsibleState(detailRow, willOpen);
    };

    // Delete Quote with confirmation modal
    window.deleteQuote = function(backendId) {
      const keyStr = backendId != null ? String(backendId) : '';
      if (!keyStr) {
        showToast('Không tìm thấy báo giá để xóa');
        return;
      }

      const quoteMatchesKey = (q) => {
        if (!q) return false;
        const candidates = [q.__backendId, q.id, q.quote_code, q.spo_number, getQuoteKey(q)];
        return candidates.some(v => v != null && String(v) === keyStr);
      };

      const quote = currentQuotes.find(quoteMatchesKey);
      if (!quote) {
        showToast('Không tìm thấy báo giá để xóa');
        return;
      }

      // Prevent deleting a quote that has been produced — require Báo huỷ instead
      const isProduced = String(quote.qcag_status || '').includes('Đã ra đơn');
      if (isProduced) {
        showToast('Báo giá đã ra đơn sản xuất — sử dụng "Báo huỷ" để đánh dấu huỷ');
        return;
      }

      // Remove any stale overlay before adding a new one
      const stale = document.getElementById('delete-quote-overlay');
      if (stale) stale.remove();

      const outletLabel = quote.outlet_name || quote.outlet_code || 'này';
      const overlay = document.createElement('div');
      overlay.id = 'delete-quote-overlay';
      overlay.className = 'fixed inset-0 z-[120] modal-backdrop flex items-center justify-center p-4';
      overlay.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-xl font-bold text-gray-800">Xác nhận xóa</h3>
              <p class="text-sm text-gray-500 mt-1">Thao tác này sẽ xóa báo giá khỏi danh sách.</p>
            </div>
            <button type="button" class="text-gray-400 hover:text-gray-600 text-2xl leading-none" data-action="cancel-delete" aria-label="Đóng">×</button>
          </div>
          <p class="text-gray-800 mb-6">Bạn có chắc chắn xóa báo giá (${outletLabel}) không?</p>
          <div class="flex justify-end gap-3">
            <button type="button" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-4 py-2 rounded" data-action="cancel-delete">Hủy (Esc)</button>
            <button type="button" class="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded" data-action="confirm-delete">Xác nhận (Enter)</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      ensureScrollLock();

      const confirmBtn = overlay.querySelector('[data-action="confirm-delete"]');
      const cancelBtns = overlay.querySelectorAll('[data-action="cancel-delete"]');
      let isProcessing = false;

      const cleanup = () => {
        document.removeEventListener('keydown', handleKeydown, true);
        overlay.remove();
        ensureScrollLock();
      };

      const handleCancel = () => {
        if (isProcessing) return;
        cleanup();
      };

      const handleKeydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          handleCancel();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          confirmBtn.click();
        }
      };

      document.addEventListener('keydown', handleKeydown, true);
      cancelBtns.forEach(btn => btn.addEventListener('click', handleCancel));

      confirmBtn.addEventListener('click', async () => {
        if (isProcessing) return;
        isProcessing = true;
        confirmBtn.disabled = true;
        cancelBtns.forEach(btn => btn.disabled = true);
        confirmBtn.innerHTML = '<div class="loading-spinner"></div>';

        try {
          const hasBackendDelete = window.dataSdk && typeof window.dataSdk.delete === 'function';
          const result = hasBackendDelete ? await window.dataSdk.delete(quote) : { isOk: true, localOnly: true };

          const success = result && (result.isOk === true || result.isOk === undefined || result === true);

          if (!success && hasBackendDelete) {
            showToast('Lỗi khi xóa báo giá');
            return;
          }

          // Remove locally regardless (demo mode or backend success)
          currentQuotes = currentQuotes.filter(q => !quoteMatchesKey(q));
          selectedQuotes.delete(getQuoteKey(quote));
          productionModalFilteredQuotes = productionModalFilteredQuotes.filter(q => !quoteMatchesKey(q));
          pendingJumpToFirstPage = true;
          updateMainList();

          const productionModal = document.getElementById('production-order-modal');
          const isProductionOpen = productionModal && !productionModal.classList.contains('hidden');
          if (isProductionOpen && typeof renderProductionQuotes === 'function') {
            renderProductionQuotes(productionModalFilteredQuotes);
            if (typeof updateSelectedCount === 'function') updateSelectedCount();
            if (typeof updateSelectedSummary === 'function') updateSelectedSummary();
          }

          showToast(hasBackendDelete ? 'Đã xóa báo giá' : 'Đã xóa báo giá (local)');
        } catch (err) {
          console.error('Delete quote failed', err);
          // Fallback: still remove locally so demo không kẹt UI
          currentQuotes = currentQuotes.filter(q => !quoteMatchesKey(q));
          productionModalFilteredQuotes = productionModalFilteredQuotes.filter(q => !quoteMatchesKey(q));
          pendingJumpToFirstPage = true;
          updateMainList();
          showToast('Đã xóa báo giá (local)');
        } finally {
          cleanup();
        }
      });

      setTimeout(() => { confirmBtn.focus(); }, 0);
    };

    // Open Cancel Report Modal for a produced quote (Báo huỷ)
    window.openReportCancelModal = function(backendId) {
      const keyStr = backendId != null ? String(backendId) : '';
      if (!keyStr) { showToast('Không tìm thấy báo giá'); return; }
      const quoteMatchesKey = (q) => {
        if (!q) return false;
        const candidates = [q.__backendId, q.id, q.quote_code, q.spo_number, getQuoteKey(q)];
        return candidates.some(v => v != null && String(v) === keyStr);
      };
      const quote = currentQuotes.find(quoteMatchesKey);
      if (!quote) { showToast('Không tìm thấy báo giá'); return; }

      // Remove stale overlay
      const stale = document.getElementById('report-cancel-overlay');
      if (stale) stale.remove();

      const overlay = document.createElement('div');
      overlay.id = 'report-cancel-overlay';
      overlay.className = 'fixed inset-0 z-[120] modal-backdrop flex items-center justify-center p-4';
      overlay.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-xl font-bold text-gray-800">Báo huỷ báo giá</h3>
              <p class="text-sm text-gray-500 mt-1">Nhập lý do (tuỳ chọn) và chọn trạng thái liên quan.</p>
            </div>
            <button type="button" class="text-gray-400 hover:text-gray-600 text-2xl leading-none" data-action="cancel-report" aria-label="Đóng">×</button>
          </div>
          <div class="mb-4">
            <input id="cancel-reason-input" placeholder="Lý do báo huỷ (tuỳ chọn)" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div class="flex justify-end gap-3">
            <button id="confirm-cancel-produced" class="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded">Đã sản xuất</button>
            <button id="confirm-cancel-not-produced" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-4 py-2 rounded">Chưa sản xuất</button>
            <button type="button" class="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded" data-action="cancel-report">Hủy</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      ensureScrollLock();

      const cleanup = () => { document.removeEventListener('keydown', handleKeydown, true); overlay.remove(); ensureScrollLock(); };
      const handleCancel = () => cleanup();
      const handleKeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); handleCancel(); } };
      document.addEventListener('keydown', handleKeydown, true);
      overlay.querySelectorAll('[data-action="cancel-report"]').forEach(b => b.addEventListener('click', handleCancel));

      const finish = async (produced) => {
        const btn = document.getElementById(produced ? 'confirm-cancel-produced' : 'confirm-cancel-not-produced');
        if (!btn) return;
        btn.disabled = true;
        const reason = String(document.getElementById('cancel-reason-input').value || '').trim();
        try {
          const reasonText = reason ? `, huỷ vì ${reason}` : '';
          const noteText = `Báo giá này ${produced ? 'đã sản xuất' : 'chưa sản xuất'}${reasonText}`;
          const existingNotes = getQuoteNotes(quote);
          const newNote = ensureNoteHasAuthor({ text: noteText, at: new Date().toISOString() });
          const updatedNotes = [...existingNotes, newNote];
          const updated = { ...quote, qcag_status: 'Hủy', notes: JSON.stringify(updatedNotes) };

          const replaceIn = (arr) => {
            const idx = (arr || []).findIndex(quoteMatchesKey);
            if (idx >= 0) arr.splice(idx, 1, updated);
          };

          let ok = false;
          if (window.dataSdk && typeof window.dataSdk.update === 'function') {
            const result = await window.dataSdk.update(updated);
            ok = !!result?.isOk;
            if (ok) {
              replaceIn(currentQuotes);
              replaceIn(productionModalFilteredQuotes);
            }
          } else {
            replaceIn(currentQuotes);
            replaceIn(productionModalFilteredQuotes);
            ok = true;
          }

          if (ok) {
            // reflect changes in UI
            showToast('Đã báo huỷ');
            pendingJumpToFirstPage = true;
            updateMainList();
            try {
              // Update any copies inside productionOrders so acceptance thumbnails reflect new status immediately
              const qKey = (typeof getQuoteKey === 'function') ? getQuoteKey(quote) : (quote.__backendId || quote.id || quote.quote_code || quote.spo_number || '');
              if (qKey && Array.isArray(productionOrders)) {
                for (let oi = 0; oi < productionOrders.length; oi++) {
                  const order = productionOrders[oi];
                  let quotes = [];
                  try { quotes = JSON.parse(order.items || '[]'); } catch (e) { quotes = []; }
                  if (!Array.isArray(quotes)) continue;
                  let changed = false;
                  for (let qi = 0; qi < quotes.length; qi++) {
                    const k = (typeof getQuoteKey === 'function') ? getQuoteKey(quotes[qi]) : (quotes[qi] && (quotes[qi].__backendId || quotes[qi].id || quotes[qi].quote_code || quotes[qi].spo_number || ''));
                    if (String(k) === String(qKey)) {
                      quotes[qi] = updated;
                      changed = true;
                    }
                  }
                  if (changed) {
                    productionOrders[oi] = { ...order, items: JSON.stringify(quotes) };
                  }
                }
              }
            } catch (e) { /* ignore */ }
            const productionModal = document.getElementById('production-order-modal');
            const isProductionOpen = productionModal && !productionModal.classList.contains('hidden');
            if (isProductionOpen && typeof renderProductionQuotes === 'function') {
              renderProductionQuotes(productionModalFilteredQuotes);
              if (typeof updateSelectedCount === 'function') updateSelectedCount();
              if (typeof updateSelectedSummary === 'function') updateSelectedSummary();
            }
            try { renderAcceptanceImages(); } catch (e) { /* ignore */ }
          } else {
            showToast('Lỗi khi báo huỷ');
          }
        } catch (err) {
          console.error('Report cancel failed', err);
          showToast('Lỗi khi báo huỷ');
        } finally {
          cleanup();
        }
      };

      document.getElementById('confirm-cancel-produced').addEventListener('click', () => finish(true));
      document.getElementById('confirm-cancel-not-produced').addEventListener('click', () => finish(false));
      setTimeout(() => { document.getElementById('cancel-reason-input').focus(); }, 0);
    };

    window.openRedoModal = function(backendId) {
      const keyStr = backendId != null ? String(backendId) : '';
      if (!keyStr) { showToast('Không tìm thấy báo giá'); return; }
      const quoteMatchesKey = (q) => {
        if (!q) return false;
        const candidates = [q.__backendId, q.id, q.quote_code, q.spo_number, getQuoteKey(q)];
        return candidates.some(v => v != null && String(v) === keyStr);
      };
      const quote = currentQuotes.find(quoteMatchesKey);
      if (!quote) { showToast('Không tìm thấy báo giá'); return; }

      // Remove stale overlay
      const stale = document.getElementById('redo-overlay');
      if (stale) stale.remove();

      const overlay = document.createElement('div');
      overlay.id = 'redo-overlay';
      overlay.className = 'fixed inset-0 z-[120] modal-backdrop flex items-center justify-center p-4';
      overlay.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-xl font-bold text-gray-800">Làm lại báo giá</h3>
              <p class="text-sm text-gray-500 mt-1">Bạn có chắc chắn sản xuất lại báo giá này không?<br>Nếu có bạn hãy lựa chọn phương án dưới đây.</p>
            </div>
            <button type="button" class="text-gray-400 hover:text-gray-600 text-2xl leading-none" data-action="cancel-redo" aria-label="Đóng">×</button>
          </div>
          <div class="flex justify-end gap-3">
            <button id="confirm-redo-new-order" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded">Tạo số đơn mới</button>
            <button id="confirm-redo-current-order" class="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded">Số đơn hiện tại</button>
            <button type="button" class="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded" data-action="cancel-redo">Hủy</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      ensureScrollLock();

      const cleanup = () => { document.removeEventListener('keydown', handleKeydown, true); overlay.remove(); ensureScrollLock(); };
      const handleCancel = () => cleanup();
      const handleKeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); handleCancel(); } };
      document.addEventListener('keydown', handleKeydown, true);
      overlay.querySelectorAll('[data-action="cancel-redo"]').forEach(b => b.addEventListener('click', handleCancel));

      const finish = async (newOrder) => {
        const btn = document.getElementById(newOrder ? 'confirm-redo-new-order' : 'confirm-redo-current-order');
        if (!btn) return;
        btn.disabled = true;
        try {
          const oldOrderNumber = getQcagOrderNumber(quote) || '';
          const existingNotes = getQuoteNotes(quote);
          let noteText;
          let updated;
          if (newOrder) {
            // User requests creating a new order: mark as transient 'Chờ tạo đơn'
            noteText = `Yêu cầu tạo số đơn mới; số đơn cũ: ${oldOrderNumber}`;
            updated = { ...quote, qcag_status: 'Chờ tạo đơn', notes: JSON.stringify([...existingNotes, ensureNoteHasAuthor({ text: noteText, at: new Date().toISOString() })]), qcag_order_number: '', order_number: '' };
            // mark transient recreate request so computeQCAGStatus can surface it
            updated.__recreateRequested = true;
          } else {
            noteText = 'Tiếp tục đơn hàng hiện tại, huỷ bỏ lệnh báo huỷ báo giá';
            updated = { ...quote, qcag_status: 'Đã ra đơn', notes: JSON.stringify([...existingNotes, ensureNoteHasAuthor({ text: noteText, at: new Date().toISOString() })]) };
            if (updated.__recreateRequested) delete updated.__recreateRequested;
          }

          const replaceIn = (arr) => {
            const idx = (arr || []).findIndex(quoteMatchesKey);
            if (idx >= 0) arr.splice(idx, 1, updated);
          };

          let ok = false;
          if (window.dataSdk && typeof window.dataSdk.update === 'function') {
            const result = await window.dataSdk.update(updated);
            ok = !!result?.isOk;
            if (ok) {
              replaceIn(currentQuotes);
              replaceIn(productionModalFilteredQuotes);
            }
          } else {
            replaceIn(currentQuotes);
            replaceIn(productionModalFilteredQuotes);
            ok = true;
          }

          if (ok) {
            showToast('Đã làm lại báo giá');
            pendingJumpToFirstPage = true;
            updateMainList();
            try {
              // For "Làm lại" -> "Tạo số đơn mới": do NOT overwrite snapshots inside existing production orders
              // so that cancelled thumbnails and historical data are preserved.
              if (!newOrder) {
                const qKey = (typeof getQuoteKey === 'function') ? getQuoteKey(quote) : (quote.__backendId || quote.id || quote.quote_code || quote.spo_number || '');
                if (qKey && Array.isArray(productionOrders)) {
                  for (let oi = 0; oi < productionOrders.length; oi++) {
                    const order = productionOrders[oi];
                    let quotes = [];
                    try { quotes = JSON.parse(order.items || '[]'); } catch (e) { quotes = []; }
                    if (!Array.isArray(quotes)) continue;
                    let changed = false;
                    for (let qi = 0; qi < quotes.length; qi++) {
                      const k = (typeof getQuoteKey === 'function') ? getQuoteKey(quotes[qi]) : (quotes[qi] && (quotes[qi].__backendId || quotes[qi].id || quotes[qi].quote_code || quotes[qi].spo_number || ''));
                      if (String(k) === String(qKey)) {
                        quotes[qi] = updated;
                        changed = true;
                      }
                    }
                    if (changed) {
                      productionOrders[oi] = { ...order, items: JSON.stringify(quotes) };
                    }
                  }
                }
              }
            } catch (e) { /* ignore */ }
            const productionModal = document.getElementById('production-order-modal');
            const isProductionOpen = productionModal && !productionModal.classList.contains('hidden');
            if (isProductionOpen && typeof renderProductionQuotes === 'function') {
              renderProductionQuotes(productionModalFilteredQuotes);
              if (typeof updateSelectedCount === 'function') updateSelectedCount();
              if (typeof updateSelectedSummary === 'function') updateSelectedSummary();
            }
            try { renderAcceptanceImages(); } catch (e) { /* ignore */ }
          } else {
            showToast('Lỗi khi làm lại báo giá');
          }
        } finally {
          cleanup();
        }
      };

      document.getElementById('confirm-redo-new-order').addEventListener('click', () => finish(true));
      document.getElementById('confirm-redo-current-order').addEventListener('click', () => finish(false));
    };

    function showToast(message) {
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      toast.textContent = message;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 3000);
    }

    // Hàm renderAcceptanceImages cho modal Hình nghiệm thu
    function renderAcceptanceImages() {
      const grid = document.getElementById('acceptance-images-grid');
      if (!grid) return;
      grid.innerHTML = '';
      // Build items from productionOrders (one thumbnail per quote that appears in orders)
      const items = [];
      const seen = new Set(); // now stores composite keys (quoteKey::orderKey)
      var selectedOrderId = window.__acceptanceSelectedOrderId || null;
      var ordersToUse = window.__filteredAcceptanceOrders || productionOrders;
      // Always use latest productionOrders if filter is reset/null
      var useOrders = window.__filteredAcceptanceOrders === null ? productionOrders : ordersToUse;
      if (Array.isArray(useOrders) && useOrders.length) {
        for (const order of ordersToUse) {
          if (selectedOrderId && String(order.__backendId) !== String(selectedOrderId)) continue;
          const orderKey = order.__backendId || order.id || '';
          let quotes = [];
          try { quotes = JSON.parse(order.items || '[]'); } catch (e) { quotes = []; }
          if (!Array.isArray(quotes) || !quotes.length) continue;
          for (const quote of quotes) {
            const quoteKey = resolveQuoteKey(quote);
            const itemKey = `${quoteKey}::${orderKey}`;
            if (!quoteKey || seen.has(itemKey)) continue;
            seen.add(itemKey);
            // Đọc ảnh từ acceptance_images (mới) hoặc quote.images (cũ)
            let images = [];
            let src = '';
            let imagesCount = 0;
            let imagesSource = 'none';
            try {
              // Try new field first
              images = parseImagesField(quote && quote.acceptance_images);
              if (images && images.length > 0) {
                imagesSource = 'acceptance';
              } else {
                // Fallback to legacy
                images = parseImagesField(quote && quote.images) || [];
                if (images && images.length > 0) {
                  imagesSource = 'legacy';
                }
              }
            } catch (e) { images = []; }
            imagesCount = Array.isArray(images) ? images.length : 0;
            src = (images && images.length && images[0].data) ? images[0].data : '';
            // Luôn ưu tiên lấy đúng mã báo giá, không fallback sang outlet_name
            const caption = (typeof formatQuoteCode === 'function' && quote.quote_code) ? formatQuoteCode(quote) : (quote.quote_code || '-');
            // If a search term is active, only include thumbnails that match the search on quote fields
            if (window.__acceptanceSearch) {
              try {
                const s = String(window.__acceptanceSearch || '').toLowerCase();
                let qOutletName = String(quote.outlet_name || '').toLowerCase();
                let qOutletCode = String(quote.outlet_code || '').toLowerCase();
                let qSpo = String(quote.spo_number || '').toLowerCase();
                let qQuoteCode = '';
                try { qQuoteCode = String((typeof formatQuoteCode === 'function' ? formatQuoteCode(quote) : (quote.quote_code || '')) || '').toLowerCase(); } catch (e) { qQuoteCode = String(quote.quote_code || '').toLowerCase(); }
                if (!(qOutletName.includes(s) || qOutletCode.includes(s) || qSpo.includes(s) || qQuoteCode.includes(s) || String(quoteKey || '').toLowerCase().includes(s))) {
                  continue;
                }
              } catch (e) {
                // if any error, fall back to including the item
              }
            }

            items.push({
              src,
              caption,
              // Keep quote's SPO if any; do NOT include outlet code here
              meta: `SPO: ${quote.spo_number || '-'}`,
              // include parent order number for display in the final row
                orderSpo: order && order.spo_number ? order.spo_number : '',
                orderCreated: order && order.created_at ? order.created_at : null,
              quoteRef: quote || null,
              quoteKey: quoteKey,
              orderKey: orderKey,
              // store computed images count from session storage
              imagesCount: imagesCount,
              imagesSource: imagesSource
            });
          }
        }
      }
      // If no items found, show 5 '+' placeholders (to keep grid visual)
      if (!items.length) {
        // Xác định trạng thái filter hiện tại
        let filter = (window.__acceptanceFilter || 'all');
        let msg = 'Hiện không có outlet nào.';
        if (filter === 'overdue') msg = 'Hiện tại không có Outlet nào trễ hạn.';
        else if (filter === 'normal') msg = 'Hiện tại không có Outlet nào đang thi công.';
        else if (filter === 'full') msg = 'Hiện tại không có Outlet nào hoàn thành.';
        // Tạo div căn giữa dọc và ngang
        grid.innerHTML = '';
        grid.style.display = 'flex';
        grid.style.flexDirection = 'column';
        grid.style.justifyContent = 'center';
        grid.style.alignItems = 'center';
        grid.style.height = '100%';
        grid.style.minHeight = '320px';
        const msgDiv = document.createElement('div');
        msgDiv.className = 'italic text-gray-500 text-center';
        msgDiv.textContent = msg;
        grid.appendChild(msgDiv);
        return;
      } else {
        // Reset grid style nếu có items
        grid.style.display = '';
        grid.style.flexDirection = '';
        grid.style.justifyContent = '';
        grid.style.alignItems = '';
        grid.style.height = '';
        grid.style.minHeight = '';
      }
      // If a master quote indicates a recreate/cancel flow (e.g. 'Chờ tạo đơn' or explicit cancel notes),
      // mark older orders (for the same quote key) as cancelled so their thumbnails show the 'Báo huỷ' flag.
      try {
        const byQuote = {};
        items.forEach(it => {
          if (!it.quoteKey) return;
          byQuote[it.quoteKey] = byQuote[it.quoteKey] || [];
          byQuote[it.quoteKey].push(it);
        });
        Object.keys(byQuote).forEach(qk => {
          const group = byQuote[qk];
          if (!group || group.length < 2) return; // only relevant when multiple orders exist
          // Try to find master/live quote info
          let master = null;
          try { master = (typeof findQuoteByKey === 'function') ? findQuoteByKey(qk) : null; } catch (e) { master = null; }
          const notesMatch = (quote) => {
            try {
              const notes = Array.isArray(quote && quote.notes) ? quote.notes : (typeof quote === 'object' && quote && quote.notes ? (typeof quote.notes === 'string' ? JSON.parse(quote.notes||'[]') : []) : []);
              return notes.some(n => (n && n.text && (n.text.includes('Báo giá này chưa sản xuất') || n.text.includes('Yêu cầu tạo số đơn mới'))));
            } catch (e) { return false; }
          };
          const shouldApply = (master && (String(master.qcag_status || '').toLowerCase().includes('chờ tạo đơn') || notesMatch(master)));
          if (shouldApply) {
            // Sort by orderCreated ascending (oldest first) and mark all but the last as force-cancelled
            group.sort((a,b) => new Date(a.orderCreated || 0) - new Date(b.orderCreated || 0));
            for (let i = 0; i < group.length - 1; i++) {
              group[i].__forceCancelled = true;
            }
          }
        });
      } catch (e) { /* ignore */ }

      // --- Pagination support ---
      window.__acceptancePageSize = window.__acceptancePageSize || 10;
      window.__acceptancePage = window.__acceptancePage || 1;
      var pageSize = parseInt(window.__acceptancePageSize, 10) || 10;
      var totalPages = Math.max(1, Math.ceil(items.length / pageSize));
      if (window.__acceptancePage > totalPages) window.__acceptancePage = totalPages;
      if (window.__acceptancePage < 1) window.__acceptancePage = 1;
      var startIdx = (window.__acceptancePage - 1) * pageSize;
      var endIdx = startIdx + pageSize;
      var displayItems = items.slice(startIdx, endIdx);

      // Update paging UI
      try {
        var pageInfoEl = document.getElementById('acceptance-page-info');
        if (pageInfoEl) pageInfoEl.textContent = window.__acceptancePage + ' / ' + totalPages;
        var prevBtn = document.getElementById('acceptance-prev-btn');
        var nextBtn = document.getElementById('acceptance-next-btn');
        if (prevBtn) prevBtn.disabled = window.__acceptancePage <= 1;
        if (nextBtn) nextBtn.disabled = window.__acceptancePage >= totalPages;
        var sizeEl = document.getElementById('acceptance-page-size');
        if (sizeEl && parseInt(sizeEl.value,10) !== pageSize) sizeEl.value = String(pageSize);
      } catch (e) { /* ignore UI update errors */ }

      const frag = document.createDocumentFragment();
      displayItems.forEach(item => {
        const cell = document.createElement('div');
        cell.className = 'flex flex-col items-start';
        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'w-full h-36 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center acceptance-thumb-hover';
        thumbWrap.style.position = 'relative';
        thumbWrap.tabIndex = 0;

        // Hiệu ứng hover viền xanh
        thumbWrap.addEventListener('mouseenter', () => {
          thumbWrap.style.boxShadow = 'inset 0 0 0 3px #2563eb';
          thumbWrap.focus();
        });
        thumbWrap.addEventListener('mouseleave', () => {
          thumbWrap.style.boxShadow = '';
        });

        // Paste ảnh trực tiếp
        thumbWrap.addEventListener('paste', (e) => {
          if (!e.clipboardData) return;
          const items = e.clipboardData.items || [];
          for (const it of items) {
            if (it.type && it.type.indexOf('image') === 0) {
              const blob = it.getAsFile();
              if (!blob) continue;
              // Gọi hàm xử lý thêm ảnh vào quoteRef
              if (item && item.quoteRef) {
                handleImageFile(getQuoteKey(item.quoteRef), blob);
              } else {
                // Trường hợp chưa có quoteRef, có thể xử lý khác nếu muốn
              }
              e.preventDefault();
              return;
            }
          }
        });

        // Drag and drop
        thumbWrap.addEventListener('dragover', (e) => {
          e.preventDefault();
          thumbWrap.style.boxShadow = 'inset 0 0 0 3px #10b981';
        });
        thumbWrap.addEventListener('dragleave', (e) => {
          e.preventDefault();
          thumbWrap.style.boxShadow = 'inset 0 0 0 3px #2563eb';
        });
        thumbWrap.addEventListener('drop', (e) => {
          e.preventDefault();
          thumbWrap.style.boxShadow = '';
          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              if (file.type.startsWith('image/')) {
                if (item && item.quoteRef) {
                  handleImageFile(getQuoteKey(item.quoteRef), file);
                }
              }
            }
          }
        });

        // Click để mở modal chi tiết nghiệm thu
        thumbWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          // Luôn mở modal chi tiết nghiệm thu
          try { openAcceptanceDetailModal(item.quoteRef, item.quoteKey, item.orderKey); } catch (err) { console.warn(err); }
        });

        // Check if cancelled - prefer the snapshot from the order so we preserve per-order history
        const quoteSnapshot = item.quoteRef || {};
        let isCancelled = false;
        try {
          isCancelled = !!(quoteSnapshot && (String(quoteSnapshot.qcag_status) === 'Hủy' || (String(quoteSnapshot.qcag_status) === 'Đã ra đơn' && !(quoteSnapshot.qcag_order_number) && (getQuoteNotes(quoteSnapshot).some(n => n.text.includes('Tạo số đơn hàng mới'))))));
          // Respect forced-cancel flag assigned earlier from master-note heuristic
          if (!isCancelled && item.__forceCancelled) isCancelled = true;
        } catch (e) { isCancelled = false; }
        // Fallback to live currentQuotes if snapshot not available
        if (!isCancelled) {
          try {
            // Find all potential live matches, then prefer the one tied to this order (by qcag_order_number or spo),
            // otherwise prefer a non-cancelled match, otherwise newest.
            const matches = Array.isArray(currentQuotes) ? currentQuotes.filter(q => {
              try { return (typeof getQuoteKey === 'function' ? getQuoteKey(q) === item.quoteKey : false); } catch (e) { return false; }
            }) : [];
            let live = null;
            if (matches.length === 1) live = matches[0];
            else if (matches.length > 1) {
              // Prefer exact order SPO match
              const byOrder = matches.find(m => {
                try {
                  const ord = (item && item.orderSpo) ? String(item.orderSpo).trim() : '';
                  if (!ord) return false;
                  if (m && m.qcag_order_number && String(m.qcag_order_number).trim() === ord) return true;
                  if (m && m.spo_number && String(m.spo_number).trim() === ord) return true;
                } catch (e) {}
                return false;
              });
              if (byOrder) live = byOrder;
              else {
                const nonCancelled = matches.find(m => {
                  try { const st = String((m == null ? void 0 : m.qcag_status) || '').toLowerCase(); return !st.includes('hủy') && !st.includes('huy'); } catch (e) { return true; }
                });
                if (nonCancelled) live = nonCancelled;
                else {
                  matches.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                  live = matches[0];
                }
              }
            }
            if (live) {
              isCancelled = !!(String(live.qcag_status) === 'Hủy' || (String(live.qcag_status) === 'Đã ra đơn' && !live.qcag_order_number && getQuoteNotes(live).some(n => n.text.includes('Tạo số đơn hàng mới'))));
            }
          } catch (e) {}
        }

        if (item && item.src) {
          const img = document.createElement('img');
          img.src = item.src;
          img.alt = item.caption || '';
          img.className = 'w-full h-full object-cover';
          if (isCancelled) {
            img.style.opacity = '0.5';
          }
          thumbWrap.appendChild(img);
          if (isCancelled) {
            const overlay = document.createElement('div');
            overlay.className = 'absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none';
            overlay.innerHTML = '<div class="text-4xl text-red-600 font-bold"><i class="fas fa-times" aria-hidden="true"></i></div><div class="text-xs text-red-600 mt-1 font-semibold">Báo huỷ</div>';
            thumbWrap.appendChild(overlay);
          }
          // Hiển thị số lượng ảnh nghiệm thu ở góc phải thumbnail
          const imgCountBadge = document.createElement('div');
          imgCountBadge.textContent = item.imagesCount > 0 ? `${item.imagesCount}` : '0';
          imgCountBadge.className = 'absolute bottom-1 right-1 bg-blue-600 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow';
          thumbWrap.appendChild(imgCountBadge);
        } else {
          if (isCancelled) {
            const cancelBox = document.createElement('div');
            cancelBox.className = 'flex flex-col items-center justify-center';
            cancelBox.setAttribute('aria-label', 'Đã báo huỷ');
            const icon = document.createElement('div');
            icon.className = 'text-4xl text-red-600 font-bold';
            icon.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
            cancelBox.appendChild(icon);
            const text = document.createElement('div');
            text.className = 'text-xs text-red-600 mt-1 font-semibold';
            text.textContent = 'Báo huỷ';
            cancelBox.appendChild(text);
            thumbWrap.appendChild(cancelBox);
          } else {
            const icon = document.createElement('div');
            icon.className = 'text-3xl text-gray-400';
            icon.textContent = '+';
            thumbWrap.appendChild(icon);
          }
        }
        const info = document.createElement('div');
        info.className = 'mt-2 text-sm text-gray-700 w-full';
        info.style.position = 'relative';

        // Move Báo huỷ button into the info area (bottom-right) - like Project backup 17.0
        try {
          if (item && item.quoteRef) {
            const quoteRef2 = item.quoteRef;
            const isProduced2 = String(quoteRef2.qcag_status || '').includes('Đã ra đơn') || hasEverHadOrder(quoteRef2);
            if (isProduced2 && !isCancelled) {
              const cancelBtn2 = document.createElement('button');
              cancelBtn2.className = 'absolute bottom-0 right-0 px-2 py-0.5 text-xs bg-yellow-400 text-yellow-900 rounded hover:bg-yellow-500 hover:text-yellow-900';
              cancelBtn2.style.zIndex = 5;
              cancelBtn2.style.transform = 'translateY(50%)';
              cancelBtn2.textContent = 'Báo huỷ';
              cancelBtn2.title = 'Báo huỷ';
              cancelBtn2.addEventListener('click', (e) => {
                e.stopPropagation();
                try { openReportCancelModal(resolveQuoteKey(quoteRef2)); } catch (err) { console.warn(err); }
              });
              info.appendChild(cancelBtn2);
            }
          }
        } catch (e) { /* ignore */ }
        if (item && item.quoteRef) {
          const quote = item.quoteRef;
          // Hiển thị Tên Outlet lớn nhất ở trên cùng, sau đó Mã BG và meta (SPO/Outlet)
          const outletText = quote.outlet_name || quote.outlet_code || '-';
          const o = document.createElement('div');
          o.className = 'quote-gallery-outlet font-extrabold truncate';
          o.textContent = outletText;
          info.appendChild(o);

          const codeText = (typeof formatQuoteCode === 'function' && quote.quote_code) ? formatQuoteCode(quote) : (quote.quote_code || quote.quoteCode || quote.spo_number || '-');
          const c = document.createElement('div');
          c.className = 'font-semibold truncate quote-gallery-code';
          c.textContent = codeText;
          info.appendChild(c);

          // Prefer latest master/prod-order data for SPO/Outlet
          let master2 = null;
          try { master2 = (typeof findQuoteByKey === 'function') ? findQuoteByKey(resolveQuoteKey(quote)) : null; } catch (_) { master2 = null; }
          const displaySpoNumber2 = (master2 && master2.spo_number) || quote.spo_number || '-';
          const displayOutletCode2 = (master2 && master2.outlet_code) || quote.outlet_code || '';
          const m = document.createElement('div');
          m.className = 'text-xs text-gray-500 truncate quote-gallery-sub';
          m.textContent = `SPO: ${displaySpoNumber2} • Outlet: ${displayOutletCode2}`;
          info.appendChild(m);

          // Sale name (bottom row)
          const s = document.createElement('div');
          s.className = 'text-xs text-gray-500 truncate quote-gallery-sale';
          s.textContent = `Sale: ${quote.sale_name || quote.saleName || '-'}`;
          info.appendChild(s);
        }
        cell.appendChild(thumbWrap);
        cell.appendChild(info);
        frag.appendChild(cell);
      });
      grid.appendChild(frag);
    }

    // SPO Status Functions
    function getSPOStatusClass(spoStatus) {
      const map = {
        'Area Sales Manager Approved...': 'bg-green-100 text-green-800',
        'Sales Supervisor Checked Variation': 'bg-green-100 text-green-800',
        'Sales Rep Checked Variation': 'bg-green-100 text-green-800',
        // Produced / completed statuses (neutral gray or purple)
        'Sales Rep Accepted': 'bg-purple-100 text-purple-800',
        'Store Keeper Finish': 'bg-purple-100 text-purple-800',
        'Sales Admin Finish': 'bg-purple-100 text-purple-800',
        'Sales Supervisor Finish': 'bg-purple-100 text-purple-800',
        'Sign Maker Installed Signage': 'bg-purple-100 text-purple-800',
        // Negative / rejection / cancellation
        'Sales Rep Rejected': 'bg-red-100 text-red-800',
        'Sign Maker Rejected': 'bg-red-100 text-red-800',
        'Sales Admin Rejected': 'bg-red-100 text-red-800',
        'Sales Admin Cancelled': 'bg-red-100 text-red-800',
        'Sales Supervisor Cancelled': 'bg-red-100 text-red-800',
        'Store Keeper Cancelled': 'bg-red-100 text-red-800',
        // In-process / review
        'Sales Admin Checked Marquette': 'bg-yellow-100 text-yellow-800',
        'Sign Maker Checked Marquette': 'bg-yellow-100 text-yellow-800',
        'Sales Rep SR Revised': 'bg-yellow-100 text-yellow-800',
        'Sales Admin Full Checked': 'bg-yellow-100 text-yellow-800',
        'Sales Supervisor Verified': 'bg-yellow-100 text-yellow-800'
      };
      return map[spoStatus] || 'bg-gray-100 text-gray-600';
    }

    function getSPOStatusText(spoStatus) {
      return spoStatus || 'Chưa có trạng thái';
    }

    // QCAG status helpers
    function getQCAGStatusClass(status) {
      if (!status) return 'bg-gray-100 text-gray-600';
      const s = String(status).toLowerCase();
      if (s.includes('hủy') || s === 'hủy') return 'bg-yellow-400 text-yellow-900';
      if (s.includes('chờ nghiệm thu')) return 'bg-blue-100 text-blue-800';
      if (s.includes('hoàn thành')) return 'bg-green-100 text-green-800';
      if (s.includes('chờ')) return 'bg-yellow-100 text-yellow-800';
      return 'bg-gray-100 text-gray-600';
    }

    function getQCAGStatusIcon(status) {
      if (!status) return '';
      const s = String(status).toLowerCase();
      // For 'Hủy' use an X icon
      if (s.includes('hủy') || s === 'hủy') {
        return `<svg class="w-3 h-3 text-yellow-900 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
      }
      return '';
    }

    function renderQCAGStatusHtml(quote, qcComputed) {
      const qc = qcComputed || computeQCAGStatus(quote) || { status: '', warning: false };
      const status = (quote && quote.qcag_status) ? String(quote.qcag_status) : qc.status;

      // If a clear is in-flight, suppress the override badge to avoid flicker
      if (quote && quote.__overrideClearing) {
        return status ? `<span class="px-1.5 py-0.5 text-xs font-medium rounded ${getQCAGStatusClass(status)} inline-flex items-center">${status}</span>` : '-';
      }

      // Persistent override from SQL (qcag_override_status)
      const overrideStatus = quote && quote.qcag_override_status ? String(quote.qcag_override_status).trim() : '';
      if (overrideStatus === 'Cần chỉnh báo giá') {
        const cls = getQCAGStatusClass('Chờ');
        return `<span class="px-1.5 py-0.5 text-xs font-medium rounded ${cls} inline-flex items-center" title="Cần chỉnh báo giá">Cần chỉnh báo giá<span class="ml-1 text-yellow-800"> ⚠️</span></span>`;
      }
      // If status is 'Hủy', display as plain text without badge or icon
      if (String(status || '').toLowerCase().includes('hủy') || String(status || '').toLowerCase() === 'hủy') {
        return status || '-';
      }

      // If quote has local changes from Acceptance Detail (or other tracked edits), overlay QCAG status
      if (hasQuotePendingUpdate(quote)) {
        const cls = getQCAGStatusClass('Chờ');
        const baseTitle = (status || '-').replace(/"/g, '&quot;');
        return `<span class="px-1.5 py-0.5 text-xs font-medium rounded ${cls} inline-flex items-center" title="${baseTitle}">Cần chỉnh báo giá<span class="ml-1 text-yellow-800"> ⚠️</span></span>`;
      }

      const cls = getQCAGStatusClass(status);
      const icon = getQCAGStatusIcon(status);
      // Show update warning if QC logic indicates or if transient edit flags exist
      const showUpdate = qc.warning;
      const updateHtml = showUpdate ? `<span class="ml-1 text-yellow-800" title="Cập nhật báo giá"> ⚠️</span>` : '';
      return `<span class="px-1.5 py-0.5 text-xs font-medium rounded ${cls} inline-flex items-center">${icon}${status || '-'}${updateHtml}</span>`;
    }

    function normalizeSpoNumber(value) {
      return value ? String(value).trim().toLowerCase() : '';
    }

    function isSPONumberUnique(spoNumber, excludeKey) {
      const normalized = normalizeSpoNumber(spoNumber);
      if (!normalized) return true;
      return !currentQuotes.some(q => {
        if (!q || !q.spo_number) return false;
        if (excludeKey && getQuoteKey(q) === excludeKey) return false;
        return normalizeSpoNumber(q.spo_number) === normalized;
      });
    }

    // Edit SPO Number
    window.editSPONumber = function(backendId) {
      const quote = currentQuotes.find(q => q.__backendId === backendId);
      if (!quote) return;

      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center';
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 w-96">
          <h3 class="text-lg font-semibold mb-4">Nhập Số SPO</h3>
          <input type="text" id="spo-number-input" value="${quote.spo_number || ''}" 
                 class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
                 placeholder="Nhập số SPO...">
          <div class="flex justify-end space-x-3 mt-4">
            <button id="cancel-spo" class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded">Hủy</button>
            <button id="save-spo" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Lưu</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      document.getElementById('spo-number-input').focus();

      document.getElementById('cancel-spo').addEventListener('click', () => modal.remove());
      
      document.getElementById('save-spo').addEventListener('click', async () => {
        const rawValue = document.getElementById('spo-number-input').value.trim();
        const quoteKey = getQuoteKey(quote);
        if (!rawValue) {
          showToast('Số SPO không được để trống');
          return;
        }
        if (!isSPONumberUnique(rawValue, quoteKey)) {
          showToast('Số SPO này đã được gán cho báo giá khác');
          return;
        }
        const previousValue = quote.spo_number || '';
        if (previousValue === rawValue) {
          showToast('Số SPO không có thay đổi');
          modal.remove();
          return;
        }
        const updatedQuote = { ...quote, spo_number: rawValue };
        let ok = false;
        if (window.dataSdk && typeof window.dataSdk.update === 'function') {
          try {
            const result = await window.dataSdk.update(updatedQuote);
            ok = !!(result && result.isOk);
          } catch (err) {
            ok = false;
          }
        } else {
          ok = true;
        }

        if (ok) {
          const idx = currentQuotes.findIndex(q => getQuoteKey(q) === quoteKey);
          if (idx >= 0) {
            const prevStatus = currentQuotes[idx].spo_status || '';
            const newStatus = (!previousValue || !prevStatus || prevStatus === 'Chưa có SPO') ? 'Chưa cập nhật trạng thái' : prevStatus;
            currentQuotes[idx] = { ...currentQuotes[idx], spo_number: rawValue, spo_status: newStatus };
          }
          const message = previousValue
            ? `Cập nhật số SPO từ "${previousValue}" sang "${rawValue}"`
            : `Cập nhật số SPO sang "${rawValue}"`;
          addSystemNoteForQuote(quoteKey, message);
          showToast('Đã cập nhật số SPO');
          modal.remove();
          updateMainList();
        } else {
          showToast('Lỗi khi cập nhật số SPO');
        }
      });
    };

    // Edit SPO Status - DISABLED per requirement
    window.editSPOStatus = function(backendId) {
      // Disabled to prevent spo_status changes outside of allowed cases
      return;
      const quote = currentQuotes.find(q => q.__backendId === backendId);
      if (!quote) return;
      // Allowed statuses per user requirement
      const statuses = [
        'Sales Rep Checked Variation',
        'Sales Rep Rejected',
        'Sign Maker Rejected',
        'Sales Admin Finish',
        'Sales Admin Rejected',
        'Sales Admin Cancelled',
        'Sales Admin Checked Marquette',
        'Sales Supervisor Cancelled',
        'Store Keeper Finish',
        'Store Keeper Cancelled',
        'Sign Maker Checked Marquette',
        'Sales Supervisor Checked Variation',
        'Area Sales Manager Approved...',
        'Sales Rep Accepted',
        'Sales Supervisor Finish',
        'Sign Maker Installed Signage',
        'Sales Rep SR Revised',
        'Sales Admin Full Checked',
        'Sales Supervisor Verified'
      ];
      
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center';
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 w-96">
          <h3 class="text-lg font-semibold mb-4">Cập Nhật Trạng Thái SPO</h3>
          <select id="spo-status-select" class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
            ${statuses.map(status => `
              <option value="${status}" ${quote.spo_status === status ? 'selected' : ''}>${status}</option>
            `).join('')}
          </select>
          <div class="flex justify-end space-x-3 mt-4">
            <button id="cancel-status" class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded">Hủy</button>
            <button id="save-status" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Lưu</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);

      document.getElementById('cancel-status').addEventListener('click', () => modal.remove());
      
      document.getElementById('save-status').addEventListener('click', async () => {
        const spoStatus = document.getElementById('spo-status-select').value;
        const previousStatus = quote.spo_status || '';
        if (previousStatus === spoStatus) {
          showToast('Trạng thái SPO không có thay đổi');
          modal.remove();
          return;
        }
        const updatedQuote = { ...quote, spo_status: spoStatus };
        const quoteKey = getQuoteKey(quote);
        let ok = true;
        if (window.dataSdk && typeof window.dataSdk.update === 'function') {
          try {
            const result = await window.dataSdk.update(updatedQuote);
            ok = !!result?.isOk;
          } catch (err) {
            ok = false;
          }
        }

        if (!ok) {
          showToast('Lỗi khi cập nhật trạng thái SPO');
          return;
        }

        const idx = currentQuotes.findIndex(q => getQuoteKey(q) === quoteKey);
        if (idx >= 0) {
          currentQuotes[idx] = { ...currentQuotes[idx], spo_status: spoStatus };
        }
        const message = previousStatus
          ? `Cập nhật trạng thái SPO từ "${previousStatus}" sang "${spoStatus}"`
          : `Cập nhật trạng thái SPO sang "${spoStatus}"`;
        addSystemNoteForQuote(quoteKey, message);
        showToast('Đã cập nhật trạng thái SPO');
        modal.remove();
        if (typeof updateMainList === 'function') updateMainList();
      });
    };

    // Utility: simple debounce to avoid firing heavy work on every keystroke
    function debounce(fn, wait) {
      let t = null;
      return function() {
        const args = arguments;
        const ctx = this;
        if (t) clearTimeout(t);
        t = setTimeout(function() { fn.apply(ctx, args); t = null; }, wait || 200);
      };
    }

    // Search Functionality
    function setupSearch() {
      const searchInput = document.getElementById('search-input');
      if (!searchInput) return;
      // Trigger search only when user presses Enter to avoid scanning on every keystroke.
      // Also auto-clear when input is empty for 1s.
      let emptyTimer = null;
      const clearEmptyTimer = () => { if (emptyTimer) { clearTimeout(emptyTimer); emptyTimer = null; } };

      searchInput.addEventListener('input', function() {
        const v = (this.value || '').trim();
        if (!v) {
          clearEmptyTimer();
          emptyTimer = setTimeout(() => {
            searchTerm = '';
            listPage = 1; outletPage = 1;
            updateMainList();
            emptyTimer = null;
          }, 1000);
        } else {
          clearEmptyTimer();
        }
      });

      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearEmptyTimer();
          searchTerm = this.value || '';
          listPage = 1; outletPage = 1;
          updateMainList();
        }
      });
    }

  /* ========== ĐÃ VÔ HIỆU HÓA PHẦN TẠO DỮ LIỆU MẪU ==========
    // Tạo 10 báo giá mẫu để test
  // async function createSampleQuotes() {
      const sampleQuotes = [
        {
          id: "sample_001",
          outlet_code: "HCM001",
          outlet_name: "Quán Bia Sài Gòn",
          area: "S4",
          sale_type: "Sale (SR)",
          sale_code: "SR001",
          sale_name: "Nguyễn Văn A",
          ss_name: "Trần Thị B",
          address: "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
          items: JSON.stringify([
            { code: "1.1", content: "Bảng hiệu mica", brand: "Tiger", width: "2", height: "1", quantity: "2", unit: "m²", price: "500000", total: "1,000,000 ₫" },
            { code: "2.1", content: "Bảng hiệu LED", brand: "Heineken", width: "3", height: "1.5", quantity: "4.5", unit: "m²", price: "800000", total: "3,600,000 ₫" }
          ]),
          total_amount: 4600000,
          created_at: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 ngày trước
          spo_number: "SPO2024001",
          spo_status: "ASM Approved"
        },
        {
          id: "sample_002",
          outlet_code: "HCM002",
          outlet_name: "Nhà Hàng Biển Xanh",
          area: "S5",
          sale_type: "TBA",
          sale_code: "TBA001",
          sale_name: "Lê Văn C",
          ss_name: "",
          address: "456 Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM",
          items: JSON.stringify([
            { code: "1.2", content: "Bảng hiệu alu", brand: "Bivina", width: "2.5", height: "1.2", quantity: "3", unit: "m²", price: "600000", total: "1,800,000 ₫" },
            { code: "9.2", content: "Đèn LED trang trí", brand: "Strongbow", width: "", height: "", quantity: "10", unit: "bộ", price: "150000", total: "1,500,000 ₫" }
          ]),
          total_amount: 3300000,
          created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
          spo_number: "SPO2024011",
          spo_status: "Sale Rep Checkvariation"
        },
        {
          id: "sample_003",
          outlet_code: "DN001",
          outlet_name: "Quán Nhậu Miền Trung",
          area: "S16",
          sale_type: "Sale (SR)",
          sale_code: "SR002",
          sale_name: "Phạm Thị D",
          ss_name: "Võ Văn E",
          address: "789 Trần Phú, Phường Thạch Thang, Quận Hải Châu, Đà Nẵng",
          items: JSON.stringify([
            { code: "1.3", content: "Bảng hiệu shopname", brand: "Shopname", width: "4", height: "1", quantity: "4", unit: "m²", price: "450000", total: "1,800,000 ₫" },
            { code: "9.17", content: "Khung sắt", brand: "", width: "", height: "", quantity: "7", unit: "m", price: "80000", total: "560,000 ₫" }
          ]),
          total_amount: 2360000,
          created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
          spo_number: "SPO2024002",
          spo_status: "ASM Approved"
        },
        {
          id: "sample_004",
          outlet_code: "HN001",
          outlet_name: "Beer Club Hà Nội",
          area: "S17",
          sale_type: "Sale (SR)",
          sale_code: "SR003",
          sale_name: "Hoàng Văn F",
          ss_name: "Ngô Thị G",
          address: "321 Hoàng Diệu, Phường Liễu Giai, Quận Ba Đình, Hà Nội",
          items: JSON.stringify([
            { code: "2.2", content: "Bảng hiệu neon", brand: "Larue", width: "3", height: "2", quantity: "6", unit: "m²", price: "900000", total: "5,400,000 ₫" },
            { code: "9.3", content: "Hệ thống âm thanh", brand: "Tiger", width: "", height: "", quantity: "1", unit: "bộ", price: "2000000", total: "2,000,000 ₫" }
          ]),
          total_amount: 7400000,
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          spo_number: "SPO2024012",
          spo_status: "Sale Rep Checkvariation"
        },
        {
          id: "sample_005",
          outlet_code: "CT001",
          outlet_name: "Quán Bia Miền Tây",
          area: "S19",
          sale_type: "TBA",
          sale_code: "TBA002",
          sale_name: "Trương Văn H",
          ss_name: "",
          address: "654 Mậu Thân, Phường An Phú, Quận Ninh Kiều, Cần Thơ",
          items: JSON.stringify([
            { code: "1.4", content: "Bảng hiệu composite", brand: "Shopname", width: "2", height: "1.5", quantity: "3", unit: "m²", price: "550000", total: "1,650,000 ₫" },
            { code: "N6", content: "Vật tư phụ", brand: "", width: "", height: "", quantity: "4", unit: "bộ", price: "100000", total: "400,000 ₫" }
          ]),
          total_amount: 2050000,
          created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
          spo_number: "SPO2024003",
          spo_status: "Từ chối"
        },
        {
          id: "sample_006",
          outlet_code: "HCM003",
          outlet_name: "Nhà Hàng Gia Đình",
          area: "S24",
          sale_type: "Sale (SR)",
          sale_code: "SR004",
          sale_name: "Lý Thị I",
          ss_name: "Đặng Văn J",
          address: "987 Võ Văn Tần, Phường 6, Quận 3, TP.HCM",
          items: JSON.stringify([
            { code: "1.1", content: "Bảng hiệu mica", brand: "Heineken", width: "1.5", height: "1", quantity: "1.5", unit: "m²", price: "500000", total: "750,000 ₫" },
            { code: "1.2", content: "Bảng hiệu alu", brand: "Bia Việt", width: "2", height: "0.8", quantity: "1.6", unit: "m²", price: "600000", total: "960,000 ₫" }
          ]),
          total_amount: 1710000,
          created_at: new Date().toISOString(),
          spo_number: "",
          spo_status: "Chờ duyệt"
        },
        {
          id: "sample_007",
          outlet_code: "BD001",
          outlet_name: "Quán Nhậu Bình Dương",
          area: "S4",
          sale_type: "TBA",
          sale_code: "TBA003",
          sale_name: "Phan Văn K",
          ss_name: "",
          address: "147 Đại lộ Bình Dương, Phường Phú Hòa, TP.Thủ Dầu Một, Bình Dương",
          items: JSON.stringify([
            { code: "2.1", content: "Bảng hiệu LED", brand: "Strongbow", width: "2.5", height: "1.8", quantity: "4.5", unit: "m²", price: "800000", total: "3,600,000 ₫" },
            { code: "9.17", content: "Khung sắt", brand: "", width: "", height: "", quantity: "8", unit: "m", price: "80000", total: "640,000 ₫" },
            { code: "N6", content: "Vật tư phụ", brand: "", width: "", height: "", quantity: "5", unit: "bộ", price: "100000", total: "500,000 ₫" }
          ]),
          total_amount: 4740000,
          created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
          spo_number: "SPO2024004",
          spo_status: "Đã duyệt"
        },
        {
          id: "sample_008",
          outlet_code: "VT001",
          outlet_name: "Beer Garden Vũng Tàu",
          area: "S5",
          sale_type: "Sale (SR)",
          sale_code: "SR005",
          sale_name: "Bùi Thị L",
          ss_name: "Cao Văn M",
          address: "258 Thùy Vân, Phường 2, TP.Vũng Tàu, Bà Rịa - Vũng Tàu",
          items: JSON.stringify([
            { code: "1.3", content: "Bảng hiệu shopname", brand: "Shopname", width: "3.5", height: "1.2", quantity: "4.2", unit: "m²", price: "450000", total: "1,890,000 ₫" },
            { code: "2.2", content: "Bảng hiệu neon", brand: "Tiger", width: "2", height: "1", quantity: "2", unit: "m²", price: "900000", total: "1,800,000 ₫" }
          ]),
          total_amount: 3690000,
          created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
          spo_number: "",
          spo_status: "Đang xử lý"
        },
        {
          id: "sample_009",
          outlet_code: "HP001",
          outlet_name: "Quán Bia Hải Phòng",
          area: "S16",
          sale_type: "Sale (SR)",
          sale_code: "SR006",
          sale_name: "Đinh Văn N",
          ss_name: "Lưu Thị O",
          address: "369 Lạch Tray, Phường Đông Khê, Quận Ngô Quyền, Hải Phòng",
          items: JSON.stringify([
            { code: "1.4", content: "Bảng hiệu composite", brand: "Shopname", width: "2.8", height: "1.5", quantity: "4.2", unit: "m²", price: "550000", total: "2,310,000 ₫" },
            { code: "9.2", content: "Đèn LED trang trí", brand: "Bivina", width: "", height: "", quantity: "15", unit: "bộ", price: "150000", total: "2,250,000 ₫" }
          ]),
          total_amount: 4560000,
          created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
          spo_number: "SPO2024005",
          spo_status: "Đã duyệt"
        },
        {
          id: "sample_010",
          outlet_code: "NB001",
          outlet_name: "Nhà Hàng Ninh Bình",
          area: "S17",
          sale_type: "TBA",
          sale_code: "TBA004",
          sale_name: "Vũ Thị P",
          ss_name: "",
          address: "741 Trần Hưng Đạo, Phường Đông Thành, TP.Ninh Bình, Ninh Bình",
          items: JSON.stringify([
            { code: "1.1", content: "Bảng hiệu mica", brand: "Larue", width: "3", height: "1.8", quantity: "5.4", unit: "m²", price: "500000", total: "2,700,000 ₫" },
            { code: "1.2", content: "Bảng hiệu alu", brand: "Heineken", width: "1.5", height: "1", quantity: "1.5", unit: "m²", price: "600000", total: "900,000 ₫" },
            { code: "9.3", content: "Hệ thống âm thanh", brand: "Bia Việt", width: "", height: "", quantity: "1", unit: "bộ", price: "2000000", total: "2,000,000 ₫" }
          ]),
          total_amount: 5600000,
          created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
          spo_number: "",
          spo_status: "Chờ duyệt"
        }
      ];

      // Tạo từng báo giá mẫu
      for (const quote of sampleQuotes) {
        if (currentQuotes.length >= 999) break; // Kiểm tra giới hạn
        
        const result = await window.dataSdk.create(quote);
        if (!result.isOk) {
          console.error('Lỗi tạo báo giá mẫu:', quote.id);
        }
      }
      
      showToast('Đã tạo 10 báo giá mẫu thành công!');
    }

    // Nút tạo dữ liệu mẫu (ẩn sau khi sử dụng)
  // function addSampleDataButton() {
      const header = document.querySelector('.max-w-7xl > div:first-child .flex');
      const sampleBtn = document.createElement('button');
      sampleBtn.id = 'create-sample-btn';
      sampleBtn.className = 'bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded shadow-md transition duration-200';
      sampleBtn.textContent = '🎯 Tạo Dữ Liệu Mẫu';
      sampleBtn.onclick = async function() {
        this.disabled = true;
        this.innerHTML = '<div class="loading-spinner"></div> Đang tạo...';
        await createSampleQuotes();
        this.style.display = 'none'; // Ẩn nút sau khi tạo
      };
      
      header.insertBefore(sampleBtn, header.lastElementChild);
    }
    // Create sample production orders in modal
  // async function createSampleProductionOrdersInModal() {
      const btn = document.getElementById('create-sample-production-orders');
      const originalText = btn.textContent;
      
      btn.disabled = true;
      btn.innerHTML = '<div class="loading-spinner mr-2"></div> Đang tạo...';
      
      try {
        await createSampleProductionOrders();
        btn.style.display = 'none'; // Ẩn nút sau khi tạo thành công
      } catch (error) {
        console.error('Lỗi tạo đơn hàng mẫu:', error);
        showToast('Lỗi khi tạo đơn hàng mẫu');
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }

    // ========== PHẦN TẠO DỮ LIỆU MẪU ĐỚN HÀNG SẢN XUẤT ==========
  // async function createSampleProductionOrders() {
      const sampleProductionOrders = [
        {
          id: "production_001",
          outlet_code: "PROD_1703001",
          outlet_name: "Đơn hàng sản xuất 17/03/2024",
          address: "Công ty TNHH Quảng Cáo Sài Gòn",
          phone: "3", // Số lượng điểm thi công
          sale_name: "Đơn hàng sản xuất",
          area: "PRODUCTION",
          items: JSON.stringify([
            {
              outlet_code: "HCM001",
              outlet_name: "Quán Bia Sài Gòn",
              area: "S4",
              sale_type: "Sale (SR)",
              sale_name: "Nguyễn Văn A",
              address: "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
              spo_number: "SPO2024001",
              spo_status: "ASM Approved",
              total_amount: 4600000,
              items: JSON.stringify([
                { code: "1.1", content: "Bảng hiệu mica", brand: "Tiger", width: "2", height: "1", quantity: "2", unit: "m²", price: "500000", total: "1,000,000 ₫" },
                { code: "2.1", content: "Bảng hiệu LED", brand: "Heineken", width: "3", height: "1.5", quantity: "4.5", unit: "m²", price: "800000", total: "3,600,000 ₫" }
              ])
            },
            {
              outlet_code: "HCM002",
              outlet_name: "Nhà Hàng Biển Xanh",
              area: "S5",
              sale_type: "TBA",
              sale_name: "Lê Văn C",
              address: "456 Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM",
              spo_number: "SPO2024011",
              spo_status: "Sale Rep Checkvariation",
              total_amount: 3300000,
              items: JSON.stringify([
                { code: "1.2", content: "Bảng hiệu alu", brand: "Bivina", width: "2.5", height: "1.2", quantity: "3", unit: "m²", price: "600000", total: "1,800,000 ₫" },
                { code: "9.2", content: "Đèn LED trang trí", brand: "Strongbow", width: "", height: "", quantity: "10", unit: "bộ", price: "150000", total: "1,500,000 ₫" }
              ])
            },
            {
              outlet_code: "DN001",
              outlet_name: "Quán Nhậu Miền Trung",
              area: "S16",
              sale_type: "Sale (SR)",
              sale_name: "Phạm Thị D",
              address: "789 Trần Phú, Phường Thạch Thang, Quận Hải Châu, Đà Nẵng",
              spo_number: "SPO2024002",
              spo_status: "ASM Approved",
              total_amount: 2360000,
              items: JSON.stringify([
                { code: "1.3", content: "Bảng hiệu shopname", brand: "Shopname", width: "4", height: "1", quantity: "4", unit: "m²", price: "450000", total: "1,800,000 ₫" },
                { code: "9.17", content: "Khung sắt", brand: "", width: "", height: "", quantity: "7", unit: "m", price: "80000", total: "560,000 ₫" }
              ])
            }
          ]),
          total_amount: 10260000,
          created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
          spo_number: "DH-SX-2024-001",
          spo_status: "Đơn hàng sản xuất"
        },
        {
          id: "production_002",
          outlet_code: "PROD_1503002",
          outlet_name: "Đơn hàng sản xuất 15/03/2024",
          address: "Chưa nhập đơn vị thi công",
          phone: "2", // Số lượng điểm thi công
          sale_name: "Đơn hàng sản xuất",
          area: "PRODUCTION",
          items: JSON.stringify([
            {
              outlet_code: "HN001",
              outlet_name: "Beer Club Hà Nội",
              area: "S17",
              sale_type: "Sale (SR)",
              sale_name: "Hoàng Văn F",
              address: "321 Hoàng Diệu, Phường Liễu Giai, Quận Ba Đình, Hà Nội",
              spo_number: "SPO2024012",
              spo_status: "Sale Rep Checkvariation",
              total_amount: 7400000,
              items: JSON.stringify([
                { code: "2.2", content: "Bảng hiệu neon", brand: "Larue", width: "3", height: "2", quantity: "6", unit: "m²", price: "900000", total: "5,400,000 ₫" },
                { code: "9.3", content: "Hệ thống âm thanh", brand: "Tiger", width: "", height: "", quantity: "1", unit: "bộ", price: "2000000", total: "2,000,000 ₫" }
              ])
            },
            {
              outlet_code: "BD001",
              outlet_name: "Quán Nhậu Bình Dương",
              area: "S4",
              sale_type: "TBA",
              sale_name: "Phan Văn K",
              address: "147 Đại lộ Bình Dương, Phường Phú Hòa, TP.Thủ Dầu Một, Bình Dương",
              spo_number: "SPO2024004",
              spo_status: "Đã duyệt",
              total_amount: 4740000,
              items: JSON.stringify([
                { code: "2.1", content: "Bảng hiệu LED", brand: "Strongbow", width: "2.5", height: "1.8", quantity: "4.5", unit: "m²", price: "800000", total: "3,600,000 ₫" },
                { code: "9.17", content: "Khung sắt", brand: "", width: "", height: "", quantity: "8", unit: "m", price: "80000", total: "640,000 ₫" },
                { code: "N6", content: "Vật tư phụ", brand: "", width: "", height: "", quantity: "5", unit: "bộ", price: "100000", total: "500,000 ₫" }
              ])
            }
          ]),
          total_amount: 12140000,
          created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          spo_number: "Chưa nhập số đơn hàng",
          spo_status: "Đơn hàng sản xuất"
        },
        {
          id: "production_003",
          outlet_code: "PROD_1203003",
          outlet_name: "Đơn hàng sản xuất 12/03/2024",
          address: "Xưởng Sản Xuất Miền Nam",
          phone: "4", // Số lượng điểm thi công
          sale_name: "Đơn hàng sản xuất",
          area: "PRODUCTION",
          items: JSON.stringify([
            {
              outlet_code: "VT001",
              outlet_name: "Beer Garden Vũng Tàu",
              area: "S5",
              sale_type: "Sale (SR)",
              sale_name: "Bùi Thị L",
              address: "258 Thùy Vân, Phường 2, TP.Vũng Tàu, Bà Rịa - Vũng Tàu",
              spo_number: "SPO2024013",
              spo_status: "Đang xử lý",
              total_amount: 3690000,
              items: JSON.stringify([
                { code: "1.3", content: "Bảng hiệu shopname", brand: "Shopname", width: "3.5", height: "1.2", quantity: "4.2", unit: "m²", price: "450000", total: "1,890,000 ₫" },
                { code: "2.2", content: "Bảng hiệu neon", brand: "Tiger", width: "2", height: "1", quantity: "2", unit: "m²", price: "900000", total: "1,800,000 ₫" }
              ])
            },
            {
              outlet_code: "HP001",
              outlet_name: "Quán Bia Hải Phòng",
              area: "S16",
              sale_type: "Sale (SR)",
              sale_name: "Đinh Văn N",
              address: "369 Lạch Tray, Phường Đông Khê, Quận Ngô Quyền, Hải Phòng",
              spo_number: "SPO2024005",
              spo_status: "Đã duyệt",
              total_amount: 4560000,
              items: JSON.stringify([
                { code: "1.4", content: "Bảng hiệu composite", brand: "Shopname", width: "2.8", height: "1.5", quantity: "4.2", unit: "m²", price: "550000", total: "2,310,000 ₫" },
                { code: "9.2", content: "Đèn LED trang trí", brand: "Bivina", width: "", height: "", quantity: "15", unit: "bộ", price: "150000", total: "2,250,000 ₫" }
              ])
            },
            {
              outlet_code: "CT001",
              outlet_name: "Quán Bia Miền Tây",
              area: "S19",
              sale_type: "TBA",
              sale_name: "Trương Văn H",
              address: "654 Mậu Thân, Phường An Phú, Quận Ninh Kiều, Cần Thơ",
              spo_number: "SPO2024003",
              spo_status: "Từ chối",
              total_amount: 2050000,
              items: JSON.stringify([
                { code: "1.4", content: "Bảng hiệu composite", brand: "Shopname", width: "2", height: "1.5", quantity: "3", unit: "m²", price: "550000", total: "1,650,000 ₫" },
                { code: "N6", content: "Vật tư phụ", brand: "", width: "", height: "", quantity: "4", unit: "bộ", price: "100000", total: "400,000 ₫" }
              ])
            },
            {
              outlet_code: "NB001",
              outlet_name: "Nhà Hàng Ninh Bình",
              area: "S17",
              sale_type: "TBA",
              sale_name: "Vũ Thị P",
              address: "741 Trần Hưng Đạo, Phường Đông Thành, TP.Ninh Bình, Ninh Bình",
              spo_number: "SPO2024014",
              spo_status: "Chờ duyệt",
              total_amount: 5600000,
              items: JSON.stringify([
                { code: "1.1", content: "Bảng hiệu mica", brand: "Larue", width: "3", height: "1.8", quantity: "5.4", unit: "m²", price: "500000", total: "2,700,000 ₫" },
                { code: "1.2", content: "Bảng hiệu alu", brand: "Heineken", width: "1.5", height: "1", quantity: "1.5", unit: "m²", price: "600000", total: "900,000 ₫" },
                { code: "9.3", content: "Hệ thống âm thanh", brand: "Bia Việt", width: "", height: "", quantity: "1", unit: "bộ", price: "2000000", total: "2,000,000 ₫" }
              ])
            }
          ]),
          total_amount: 15900000,
          created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
          spo_number: "DH-SX-2024-003",
          spo_status: "Đơn hàng sản xuất"
        }
      ];

      // Tạo từng đơn hàng sản xuất mẫu
      for (const order of sampleProductionOrders) {
        if (productionOrders.length >= 999) break; // Kiểm tra giới hạn
        
        const result = await window.dataSdk.create(order);
        if (!result.isOk) {
          console.error('Lỗi tạo đơn hàng sản xuất mẫu:', order.id);
        }
      }
      
      showToast('Đã tạo 3 đơn hàng sản xuất mẫu thành công!');
    }

    // Nút tạo đơn hàng sản xuất mẫu
  // function addSampleProductionButton() {
      const header = document.querySelector('.max-w-7xl > div:first-child .flex');
      const sampleProductionBtn = document.createElement('button');
      sampleProductionBtn.id = 'create-sample-production-btn';
      sampleProductionBtn.className = 'bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded shadow-md transition duration-200';
      sampleProductionBtn.textContent = '🏭 Tạo Đơn Hàng SX Mẫu';
      sampleProductionBtn.onclick = async function() {
        this.disabled = true;
        this.innerHTML = '<div class="loading-spinner"></div> Đang tạo...';
        await createSampleProductionOrders();
        this.style.display = 'none'; // Ẩn nút sau khi tạo
      };
      
      // Thêm vào sau nút tạo báo giá mẫu
      const sampleBtn = document.getElementById('create-sample-btn');
      if (sampleBtn) {
        header.insertBefore(sampleProductionBtn, sampleBtn.nextSibling);
      } else {
        header.insertBefore(sampleProductionBtn, header.lastElementChild);
      }
    }
    // ========== KẾT THÚC PHẦN TẠO DỮ LIỆU MẪU ĐỚN HÀNG SẢN XUẤT ==========

  // ========== KẾT THÚC PHẦN TẠO DỮ LIỆU MẪU ==========
  */

    // ===== QC BẢNG HIỆU =====
    const QC_SIGNAGE_ITEM_CODES = new Set(['2.1', '1.1', '1.2', '9.3', '9.2']);
    const QC_SIGNAGE_LOGO_REGEX = /logo/i;

    const qcSignageUiState = {
      activeTab: 'todo',
      searchTerm: '',
      selection: new Set(),
      itemsByKey: new Map(),
      pageSize: 15,
      pageByTab: { todo: 1, list: 1, waiting: 1, pass: 1 },
      reasonModal: {
        pendingAction: null,
        pendingKey: null
      },
      returnConfirm: {
        pendingKey: null,
        pendingOutlet: ''
      }
    };
    if (typeof window !== 'undefined') window.qcSignageUiState = qcSignageUiState;
    let qcSignageHandlersBound = false;

    function getProductionOrderKey(order) {
      if (!order) return '';
      // Prefer stable backend identifiers when available
      if (order.__backendId) return String(order.__backendId);
      if (order.id) return String(order.id);
      // Prefer SPO / production order number if present and not a transient placeholder
      try {
        const spo = order.spo_number && String(order.spo_number).trim();
        if (spo && !/^production_\d+/i.test(spo) && spo !== 'Chưa nhập số đơn hàng') return String(spo);
      } catch (e) { /* ignore */ }
      if (order.outlet_code) return String(order.outlet_code);
      return '';
    }

    function escapeQcHtml(value) {
      if (value === undefined || value === null) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function ensureQcSignageModalElement() {
      let modal = document.getElementById('qc-signage-modal');
      if (modal) return modal;
      modal = document.createElement('div');
      modal.id = 'qc-signage-modal';
      modal.className = 'hidden fixed inset-0 z-50 modal-backdrop';
      modal.innerHTML = `
        <div class="flex items-center justify-center min-h-full p-4">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-[120rem] modal-content flex flex-col" style="display:flex;flex-direction:column;max-height:90vh;min-width:1200px;">
            <div class="modal-header">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-2xl font-bold text-gray-800">QC Bảng Hiệu</h3>
                <button id="close-qc-signage-modal" class="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <div class="relative flex-1 min-w-[260px]">
                  <input id="qc-search-input" type="text" placeholder="Tìm theo Mã đơn hàng, SPO, Outlet..." class="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                </div>
                <div class="flex items-center bg-gray-100 rounded-lg p-1 text-sm">
                  <button data-qc-tab="todo" class="px-3 py-1 rounded-md bg-white shadow text-gray-800">Chưa QC <span class="qc-tab-count ml-1 text-xs text-gray-500">0</span></button>
                  <button data-qc-tab="waiting" class="px-3 py-1 rounded-md text-gray-600 hover:text-gray-800">Chờ QC <span class="qc-tab-count ml-1 text-xs text-gray-500">0</span></button>
                  <button data-qc-tab="pass" class="px-3 py-1 rounded-md text-gray-600 hover:text-gray-800">Pass QC <span class="qc-tab-count ml-1 text-xs text-gray-500">0</span></button>
                </div>
              </div>
            </div>
            <div class="modal-body flex-1 overflow-y-auto" style="flex:1;overflow-y:auto;">
              <div id="qc-tab-panel-todo" class="space-y-3"></div>
              <div id="qc-tab-panel-waiting" class="space-y-3 hidden"></div>
              <div id="qc-tab-panel-pass" class="space-y-3 hidden"></div>
            </div>
            <div class="qc-modal-footer sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 z-10 flex items-center justify-between gap-4" style="position:sticky;bottom:0;">
              <span id="qc-selection-count" class="text-sm">Chưa chọn hạng mục nào</span>
              <div id="qc-pagination" class="flex items-center gap-2 min-w-[320px] justify-center">
                <button type="button" id="qc-page-prev" class="w-8 h-8 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" aria-label="Trang trước">‹</button>
                <span id="qc-page-info" class="text-xs text-gray-600 whitespace-nowrap">Trang 1 / 1 (0)</span>
                <button type="button" id="qc-page-next" class="w-8 h-8 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" aria-label="Trang sau">›</button>
                <div class="flex items-center gap-2 ml-2">
                  <span class="text-xs text-gray-500">Hiển thị</span>
                  <select id="qc-page-size" class="border border-gray-300 rounded px-2 py-1 text-xs">
                    <option value="10">10</option>
                    <option value="15" selected>15</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
              <div class="flex gap-3">
                <button type="button" id="qc-unselect-btn" class="px-5 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded font-semibold">Bỏ chọn</button>
                <button type="button" id="qc-register-btn" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold">Đăng ký QC</button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
      return modal;
    }

    function ensureQcReasonModalElement() {
      return document.getElementById('qc-reason-modal');
    }

    function parseQcSignageState(order) {
      if (!order) return { items: {} };
      const raw = order.qc_signage_state;
      if (typeof raw === 'string' && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const items = parsed.items && typeof parsed.items === 'object' ? parsed.items : {};
            return { items };
          }
        } catch (_) {}
      }
      return { items: {} };
    }

    async function persistQcSignageState(orderKey, state) {
      if (!orderKey) return null;
      const idx = productionOrders.findIndex(o => getProductionOrderKey(o) === orderKey);
      if (idx < 0) return null;
      const order = productionOrders[idx];
      const prepared = {
        items: state && typeof state === 'object' && state.items && typeof state.items === 'object'
          ? state.items
          : {}
      };
      const updated = { ...order, qc_signage_state: JSON.stringify(prepared) };
      productionOrders[idx] = updated;
      if (window.dataSdk && typeof window.dataSdk.update === 'function') {
        try {
          await window.dataSdk.update(updated);
        } catch (err) {
          console.warn('Không thể lưu trạng thái QC bảng hiệu:', err);
        }
      }
      return updated;
    }

    function buildQcSignageItemKey(orderKey, quote, itemIndex, quoteIndex = 0) {
      const safeOrder = orderKey || 'order';
      const safeOutlet = quote && quote.outlet_code ? String(quote.outlet_code) : '';
      const safeSpo = quote && quote.spo_number ? String(quote.spo_number) : '';
      const safeSale = quote && quote.sale_name ? String(quote.sale_name) : '';
      const mid = safeOutlet || safeSpo || safeSale || (`point_${quoteIndex}`);
      return [
        safeOrder,
        mid,
        itemIndex,
        quoteIndex
      ].join('__').replace(/\s+/g, '_');
    }

    function qualifiesQcSignageItem(item = {}) {
      const brand = String(item.brand || '').trim().toLowerCase();
      const contentText = String(item.content || '').toLowerCase();
      if (brand === 'shopname' || contentText.includes('shopname')) {
        return false;
      }
      const code = String(item.code || '').trim();
      if (QC_SIGNAGE_ITEM_CODES.has(code)) return true;
      return QC_SIGNAGE_LOGO_REGEX.test(contentText);
    }

    function formatQcSignageTypeLabel(code, content) {
      const map = {
        '2.1': 'Bảng hiệu hiflex - 1 mặt',
        '1.1': 'Hộp đèn hiflex - 1 mặt',
        '1.2': 'Hộp đèn hiflex - 2 mặt',
        '9.3': 'Thay bạt hộp đèn hiflex',
        '9.2': 'Thay bạt bảng hiệu hiflex'
      };
      const trimmed = String(code || '').trim();
      if (map[trimmed]) return map[trimmed];
      if (QC_SIGNAGE_LOGO_REGEX.test(String(content || ''))) return 'Logo';
      return trimmed || 'Khác';
    }

    function sanitizeQcSelection(rows) {
      const active = qcSignageUiState.activeTab || 'todo';
      const valid = new Set(rows.filter(row => row.status === active && !row.disabled).map(row => row.key));
      Array.from(qcSignageUiState.selection).forEach(key => {
        if (!valid.has(key)) {
          qcSignageUiState.selection.delete(key);
        }
      });
    }

    function collectQcSignageRows() {
      const rows = [];
      const term = qcSignageUiState.searchTerm.toLowerCase();
      for (const order of productionOrders) {
        const orderKey = getProductionOrderKey(order);
        if (!orderKey) continue;
        const isConfirmedOrder = !!(order && (order.is_confirmed || order.last_confirmed_at));
        if (!isConfirmedOrder) continue;
        // Use SPO number if present; treat transient production IDs as unconfirmed so UI shows a dash until SPO is provided
        let orderNumberRaw = (order && order.spo_number && String(order.spo_number).trim() && String(order.spo_number).trim() !== 'Chưa nhập số đơn hàng') ? String(order.spo_number).trim() : '';
        if (/^production_\d+/.test(orderNumberRaw)) orderNumberRaw = '';
        const contractor = (order?.address && order.address !== 'Chưa nhập đơn vị thi công')
          ? order.address
          : 'Chưa nhập đơn vị thi công';
        const qcState = parseQcSignageState(order);
        let quotes = [];
        try {
          quotes = JSON.parse(order.items || '[]');
        } catch (_) {
          quotes = [];
        }
        quotes.forEach((quote, quoteIndex) => {
          let items = [];
          try {
            items = JSON.parse(quote.items || '[]');
          } catch (_) {
            items = [];
          }
          items.forEach((item, itemIndex) => {
            if (!qualifiesQcSignageItem(item)) return;
            const key = buildQcSignageItemKey(orderKey, quote, itemIndex, quoteIndex);
            const stored = qcState.items[key] || {};
            const status = stored.status || 'todo';
            let quoteCodeForSearch = '';
            try {
              quoteCodeForSearch = String(quote?.quote_code || '').trim();
              if (!quoteCodeForSearch && Array.isArray(currentQuotes)) {
                const match = currentQuotes.find(q => (
                  q && (
                    (quote?.outlet_code && String(q.outlet_code) === String(quote?.outlet_code)) ||
                    (!quote?.outlet_code && quote?.spo_number && String(q.spo_number) === String(quote?.spo_number))
                  )
                ));
                if (match && match.quote_code) quoteCodeForSearch = String(match.quote_code);
              }
              if (!quoteCodeForSearch && typeof formatQuoteCode === 'function') {
                const formatted = formatQuoteCode(quote);
                if (formatted) quoteCodeForSearch = String(formatted);
              }
            } catch (e) {
              quoteCodeForSearch = String(quote?.quote_code || '');
            }

            const section = [
              orderNumberRaw,
              quoteCodeForSearch,
              quote?.spo_number || '',
              quote?.outlet_code || '',
              quote?.outlet_name || ''
            ].join(' ').toLowerCase();
            if (term && !section.includes(term)) return;
            let matchedQuote = null;
            if (Array.isArray(currentQuotes)) {
              const refCode = (quote?.quote_code || '').toString().trim();
              const refSpo = (quote?.spo_number || '').toString().trim();
              const refOutlet = (quote?.outlet_code || '').toString().trim();
              // Collect all possible matches instead of taking the first — then prefer non-cancelled or newest
              const matches = currentQuotes.filter(q => {
                try {
                  const qCode = ((q == null ? void 0 : q.quote_code) || '').toString().trim();
                  if (refCode && qCode && qCode === refCode) return true;
                  const qSpo = ((q == null ? void 0 : q.spo_number) || '').toString().trim();
                  const qOutlet = ((q == null ? void 0 : q.outlet_code) || '').toString().trim();
                  if (refSpo && qSpo && refOutlet && qOutlet) return qSpo === refSpo && qOutlet === refOutlet;
                } catch (e) { /* ignore */ }
                return false;
              });
              if (matches.length === 1) matchedQuote = matches[0];
              else if (matches.length > 1) {
                // Prefer a match that is not marked as canceled
                const nonCancelled = matches.find(m => {
                  try { const st = String((m == null ? void 0 : m.qcag_status) || '').toLowerCase(); return !st.includes('hủy') && !st.includes('huy'); } catch (e) { return true; }
                });
                if (nonCancelled) matchedQuote = nonCancelled;
                else {
                  // Fallback: take the most recently created
                  matches.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                  matchedQuote = matches[0];
                }
              }
            }
            const matchedStatus = matchedQuote ? String((matchedQuote == null ? void 0 : matchedQuote.qcag_status) || '').toLowerCase() : '';
            const quoteOrderNumber = matchedQuote ? String((matchedQuote == null ? void 0 : matchedQuote.qcag_order_number) || '').trim() : '';
            const rowOrderNumber = String(orderNumberRaw || '').trim();
            const isCancelled = matchedStatus.includes('hủy');
            const isAwaitingNewOrder = matchedStatus.includes('chờ tạo đơn');
            const isHistoricalOrder = !!(quoteOrderNumber && rowOrderNumber && quoteOrderNumber !== rowOrderNumber);
            const shouldDisable = isCancelled || isAwaitingNewOrder || isHistoricalOrder;
            // Prefer live brand from `currentQuotes` when available (reflect edits made on main list)
            try {
              if (matchedQuote) {
                try {
                  const mqItems = Array.isArray(matchedQuote.items) ? matchedQuote.items : JSON.parse(matchedQuote.items || '[]');
                  if (Array.isArray(mqItems) && mqItems.length) {
                    const codeToMatch = String(item.code || '').trim();
                    const contentToMatch = String(item.content || '').trim().toLowerCase();
                    const found = mqItems.find(mi => {
                      try {
                        if (mi && mi.code && String(mi.code).trim() && codeToMatch && String(mi.code).trim() === codeToMatch) return true;
                        const mic = String(mi.content || '').trim().toLowerCase();
                        if (mic && contentToMatch && mic === contentToMatch) return true;
                        return false;
                      } catch (e) { return false; }
                    });
                    if (found && found.brand) {
                      item.brand = found.brand;
                    }
                  }
                } catch (e) { /* ignore parse errors */ }
              }
            } catch (e) { /* ignore */ }

            rows.push({
              key,
              orderKey,
              orderNumber: orderNumberRaw,
              contractor,
              status,
              lastResult: stored.lastResult || null,
              lastReason: stored.lastReason || '',
              lastReasonAt: stored.lastReasonAt || null,
              updatedAt: stored.updatedAt || null,
              itemIndex,
              quoteRef: {
                spoNumber: quote?.spo_number || '',
                quoteCode: quoteCodeForSearch || '',
                outletCode: quote?.outlet_code || '',
                outletName: quote?.outlet_name || '',
                saleName: quote?.sale_name || '',
                area: quote?.area || '',
                pointOrderNumber: quote?.point_order_number || '',
                province: quote?.province || '',
                district: quote?.district || '',
                ward: quote?.ward || '',
                street: quote?.street || '',
                house_number: quote?.house_number || ''
              },

              item: {
                code: item?.code || '',
                content: item?.content || '',
                brand: item?.brand || '',
                width: item?.width || '',
                height: item?.height || '',
                unit: item?.unit || '',
                quantity: item?.quantity || ''
              },
              typeLabel: formatQcSignageTypeLabel(item?.code, item?.content),
              disabled: shouldDisable
            });
            // Always sync SPO and address from currentQuotes (main list is authoritative source)
            try {
              const last = rows[rows.length - 1];
              if (last && last.quoteRef && Array.isArray(currentQuotes)) {
                const qRef = last.quoteRef;
                // Try multiple ways to find the matching quote in currentQuotes
                let match = null;
                // 1. Try by quote_code (most reliable)
                if (quoteCodeForSearch) {
                  match = currentQuotes.find(q => q && String(q.quote_code || '').trim() === quoteCodeForSearch);
                }
                // 2. Try by outlet_code
                if (!match && quote?.outlet_code) {
                  match = currentQuotes.find(q => q && String(q.outlet_code || '') === String(quote.outlet_code));
                }
                // 3. Try by spo_number (if not empty)
                if (!match && quote?.spo_number && String(quote.spo_number).trim()) {
                  const quoteSpo = String(quote.spo_number).trim();
                  match = currentQuotes.find(q => q && String(q.spo_number || '').trim() === quoteSpo);
                }
                
                if (match) {
                  // ALWAYS sync SPO from currentQuotes (main list)
                  qRef.spoNumber = String(match.spo_number || '').trim();
                  // Sync outlet name
                  if (match.outlet_name) qRef.outletName = match.outlet_name;
                  // Sync address fields
                  if (match.province) qRef.province = match.province;
                  if (match.district) qRef.district = match.district;
                  if (match.ward) qRef.ward = match.ward;
                  if (match.street) qRef.street = match.street;
                  if (match.house_number) qRef.house_number = match.house_number;
                }
              }
            } catch (e) { /* ignore */ }
          });
        });
      }
      qcSignageUiState.itemsByKey = new Map(rows.map(row => [row.key, row]));
      sanitizeQcSelection(rows);
      return rows;
    }

    function buildQcSignageTabHtml(tab, rows) {
      if (!rows.length) {
        return '<div class="text-gray-500 text-center py-8">Không có hạng mục nào trong danh sách này.</div>';
      }
      const isTodoTab = tab === 'todo';
      const isListTab = tab === 'list';
      const showReason = tab === 'todo';
      const showActions = tab === 'waiting';
      const showResult = tab === 'pass';
      const headers = [];
      headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">STT</th>');
      headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Số đơn hàng</th>');
      headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mã BG</th>');
      headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Số SPO</th>');
      headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Outlet Code</th>');
      headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tên Outlet</th>');
      headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngang</th>');
      headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cao</th>');
      headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand</th>');
      headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Loại bảng</th>');
      headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Đơn vị thi công</th>');
      if (showReason) headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trạng thái QC</th>');
      if (showActions) headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Thao tác</th>');
      if (isListTab) headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Loại</th>');
      if (showResult) {
        headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kết quả</th>');
        headers.push('<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Thao tác</th>');
      }

      const rowsHtml = rows.map((row, index) => {
        const isSelected = qcSignageUiState.selection.has(row.key);
        const isDisabled = !!row.disabled;
        const statusHighlight = isTodoTab && !isSelected
          ? (row.lastResult === 'fail' ? 'bg-red-50' : row.lastResult === 'pending' ? 'bg-amber-50' : '')
          : '';
        const rowClasses = [
          isSelected ? 'bg-green-50' : statusHighlight,
          (isTodoTab || isListTab) ? 'qc-selectable-row' : '',
          isDisabled && isTodoTab ? 'opacity-60 cursor-not-allowed' : ''
        ].filter(Boolean).join(' ');
        // Attempt to locate an authoritative quotation record from currentQuotes
        let authoritativeQuote = null;
        try {
          if (row && row.quoteRef) {
            if (row.quoteRef.quoteCode) authoritativeQuote = findQuoteByIdentifier(row.quoteRef.quoteCode) || authoritativeQuote;
            if (!authoritativeQuote && row.quoteRef.spoNumber) authoritativeQuote = findQuoteByIdentifier(row.quoteRef.spoNumber) || authoritativeQuote;
            if (!authoritativeQuote && row.quoteRef.outletCode && Array.isArray(currentQuotes)) {
              authoritativeQuote = currentQuotes.find(q => String(q.outlet_code) === String(row.quoteRef.outletCode)) || authoritativeQuote;
            }
          }
        } catch (e) { /* ignore lookup errors */ }

        // Ưu tiên Mã BG từ chính quoteRef; fallback tìm trong currentQuotes/productionOrders
        let maBG = '';
        if (authoritativeQuote && authoritativeQuote.quote_code) maBG = String(authoritativeQuote.quote_code);
        else maBG = row.quoteRef && row.quoteRef.quoteCode ? String(row.quoteRef.quoteCode) : '';
        if (!maBG && row.quoteRef && row.quoteRef.outletCode) {
          let found = null;
          if (typeof currentQuotes !== 'undefined' && Array.isArray(currentQuotes)) {
            found = currentQuotes.find(q => String(q.outlet_code) === String(row.quoteRef.outletCode));
          }
          if (!found && typeof productionOrders !== 'undefined' && Array.isArray(productionOrders)) {
            for (const order of productionOrders) {
              let quotes = [];
              try { quotes = JSON.parse(order.items || '[]'); } catch (_) { quotes = []; }
              const match = quotes.find(q => String(q.outlet_code) === String(row.quoteRef.outletCode));
              if (match) { found = match; break; }
            }
          }
          if (found && found.quote_code) maBG = String(found.quote_code);
        }
        if (!maBG) maBG = '—';
        const maBgLabel = isDisabled && isTodoTab ? `${maBG} (Báo huỷ)` : maBG;
        const baseCells = `
          <td class="px-3 py-2 text-sm text-gray-700">${index + 1}</td>
          <td class="px-3 py-2 font-semibold text-gray-900">${row.orderNumber ? escapeQcHtml(row.orderNumber) : '—'}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${escapeQcHtml(maBgLabel)}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${row.quoteRef.spoNumber ? escapeQcHtml(row.quoteRef.spoNumber) : '—'}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${(() => {
              const oc = authoritativeQuote ? (authoritativeQuote.outlet_code || authoritativeQuote.outletCode || '') : (row.quoteRef.outletCode || '');
              return oc ? escapeQcHtml(normalizeOutletCode(oc)) : '—';
            })()}</td>
          <td class="px-3 py-2 text-sm text-gray-900">${(() => {
              const on = authoritativeQuote ? (authoritativeQuote.outlet_name || authoritativeQuote.outletName || '') : (row.quoteRef.outletName || '');
              return on ? escapeQcHtml(on) : '—';
            })()}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${row.item.width ? escapeQcHtml(row.item.width) : '—'}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${row.item.height ? escapeQcHtml(row.item.height) : '—'}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${row.item.brand ? escapeQcHtml(row.item.brand) : '—'}</td>
          <td class="px-3 py-2 text-sm text-gray-900">${escapeQcHtml(row.typeLabel)}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${row.contractor ? escapeQcHtml(row.contractor) : '—'}</td>
        `;
        const reasonCell = showReason
          ? (() => {
              let html = '';
              if (isDisabled) {
                html = '<span class="text-xs text-red-600 font-semibold">Đã báo huỷ - không thể đăng ký</span>';
              } else if (!row.lastResult) {
                html = '<span class="text-xs text-gray-400">Chưa đăng ký QC</span>';
              } else if (row.lastResult === 'pending' || row.lastResult === 'fail') {
                const color = row.lastResult === 'fail' ? 'border border-red-400 text-red-700 bg-red-50' : 'border border-amber-400 text-amber-700 bg-amber-50';
                const text = row.lastResult === 'fail' ? 'Fail' : 'Pending';
                html = `<button type="button" class="px-6 py-1 min-w-[100px] rounded ${color} font-semibold focus:outline-none" data-qc-reason="${escapeQcHtml(row.key)}">${text}</button>`;
              } else {
                html = '<span class="text-xs text-green-600">Pass</span>';
              }
              return `<td class="px-3 py-2 text-sm">${html}</td>`;
            })()
          : '';
        const actionsCell = showActions
          ? `<td class="px-3 py-2"><div class="flex flex-wrap gap-2"><button type="button" class="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded" data-qc-action="pass" data-qc-key="${escapeQcHtml(row.key)}">Pass</button><button type="button" class="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded" data-qc-action="pending" data-qc-key="${escapeQcHtml(row.key)}">Pending</button><button type="button" class="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded" data-qc-action="fail" data-qc-key="${escapeQcHtml(row.key)}">Fail</button></div></td>`
          : '';
        const removeCell = isListTab
          ? `<td class="px-3 py-2"><button type="button" class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded" data-qc-action="remove" data-qc-key="${escapeQcHtml(row.key)}" aria-label="Loại bỏ khỏi danh sách">✕</button></td>`
          : '';
        const resultCell = showResult
          ? `<td class="px-3 py-2 text-sm text-green-600 font-semibold whitespace-nowrap min-w-[220px]">Pass${row.updatedAt ? ` • ${new Date(row.updatedAt).toLocaleString('vi-VN')}` : ''}</td>`
          : '';
        const returnCell = showResult
          ? `<td class="px-3 py-2 text-right"><button type="button" class="px-3 py-1 text-xs rounded text-black border border-gray-300 bg-gray-100" data-qc-action="return" data-qc-key="${escapeQcHtml(row.key)}">Trả về</button></td>`
          : '';
        return `<tr class="${rowClasses}" data-qc-row="true" data-qc-key="${escapeQcHtml(row.key)}" data-qc-disabled="${isDisabled && isTodoTab ? 'true' : 'false'}">${baseCells}${reasonCell}${actionsCell}${removeCell}${resultCell}${returnCell}</tr>`;
      }).join('');

      const table = `
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
              <tr>${headers.join('')}</tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;

      const footer = '';

      return table + footer;
    }

    function updateQcTabButtons(counts) {
      const tabs = document.querySelectorAll('[data-qc-tab]');
      tabs.forEach(btn => {
        const tab = btn.dataset.qcTab;
        const count = counts[tab] || 0;
        const countEl = btn.querySelector('.qc-tab-count');
        if (countEl) countEl.textContent = count;
        if (tab === qcSignageUiState.activeTab) {
          btn.classList.add('bg-white', 'shadow', 'text-gray-800');
          btn.classList.remove('text-gray-600');
          btn.setAttribute('aria-selected', 'true');
        } else {
          btn.classList.remove('bg-white', 'shadow', 'text-gray-800');
          btn.classList.add('text-gray-600');
          btn.setAttribute('aria-selected', 'false');
        }
      });
    }

    function updateQcSelectionSummary() {
      const count = qcSignageUiState.selection.size;
      // Update selection count in footer
      const summary = document.getElementById('qc-selection-count');
      if (summary) {
        summary.textContent = count ? `${count} hạng mục được chọn` : 'Chưa chọn hạng mục nào';
      }
      // Update footer buttons disabled state
      const qcUnselectBtn = document.getElementById('qc-unselect-btn');
      if (qcUnselectBtn) qcUnselectBtn.disabled = count === 0;
      const qcRegisterBtn = document.getElementById('qc-register-btn');
      if (qcRegisterBtn && !qcRegisterBtn.classList.contains('hidden')) qcRegisterBtn.disabled = count === 0;
      const qcListRegisterBtn = document.getElementById('qc-list-register-btn');
      if (qcListRegisterBtn && !qcListRegisterBtn.classList.contains('hidden')) {
        // Enable Đăng ký QC in Danh sách if there are any rows in the list, even when none selected
        const listPanel = document.getElementById('qc-tab-panel-list');
        const listRowsCount = listPanel ? listPanel.querySelectorAll('tr[data-qc-row="true"]').length : 0;
        qcListRegisterBtn.disabled = listRowsCount === 0;
      }
      const qcExportBtn = document.getElementById('qc-export-btn');
      if (qcExportBtn && !qcExportBtn.classList.contains('hidden')) {
        if (qcSignageUiState.activeTab === 'list') {
          const listPanel = document.getElementById('qc-tab-panel-list');
          const listRowsCount = listPanel ? listPanel.querySelectorAll('tr[data-qc-row="true"]').length : 0;
          qcExportBtn.disabled = listRowsCount === 0;
        } else {
          qcExportBtn.disabled = count === 0;
        }
      }
    }

    async function moveSelectedQcItemsToWaiting() {
      // legacy: move selected todo items to waiting (keeps old behavior)
      const keys = Array.from(qcSignageUiState.selection).filter(key => {
        const row = qcSignageUiState.itemsByKey.get(key);
        return row && row.status === 'todo';
      });
      if (!keys.length) {
        if (typeof showToast === 'function') showToast('Vui lòng chọn hạng mục cần chuyển.');
        renderQcSignageModal();
        return;
      }
      for (const key of keys) {
        await setQcSignageItemStatus(key, 'waiting', { lastResult: null, lastReason: '' });
      }
      qcSignageUiState.selection.clear();
      if (typeof showToast === 'function') showToast(`Đã chuyển ${keys.length} hạng mục sang chờ QC.`);
      renderQcSignageModal();
    }

    async function moveSelectedQcItemsToList() {
      try { console.log('DEBUG: moveSelectedQcItemsToList selection ->', Array.from(qcSignageUiState.selection)); } catch(e) {}
      const keys = Array.from(qcSignageUiState.selection).filter(key => {
        const row = qcSignageUiState.itemsByKey.get(key);
        return row && row.status === 'todo';
      });
      if (!keys.length) {
        if (typeof showToast === 'function') showToast('Vui lòng chọn hạng mục cần thêm vào danh sách.');
        renderQcSignageModal();
        return;
      }
      for (const key of keys) {
        await setQcSignageItemStatus(key, 'list', { lastResult: null, lastReason: '' });
      }
      qcSignageUiState.selection.clear();
      if (typeof showToast === 'function') showToast(`Đã thêm ${keys.length} hạng mục vào Danh sách QC.`);
      renderQcSignageModal();
    }

    // Move list-selected items to waiting. If `keys` provided, operate on those keys. If no keys and selection empty, fallback to ALL list items.
    async function moveListSelectedToWaiting(keys) {
      let targetKeys = Array.isArray(keys) ? keys.slice() : Array.from(qcSignageUiState.selection).filter(key => {
        const row = qcSignageUiState.itemsByKey.get(key);
        return row && row.status === 'list';
      });
      if (!targetKeys.length) {
        // Fallback: take all items in list
        targetKeys = [];
        qcSignageUiState.itemsByKey.forEach((row, key) => {
          if (row && row.status === 'list') targetKeys.push(key);
        });
      }
      if (!targetKeys.length) {
        if (typeof showToast === 'function') showToast('Không có hạng mục nào trong Danh sách QC để đăng ký.');
        renderQcSignageModal();
        return;
      }
      for (const key of targetKeys) {
        await setQcSignageItemStatus(key, 'waiting', { lastResult: null, lastReason: '' });
      }
      // Clear selection of those keys
      targetKeys.forEach(k => qcSignageUiState.selection.delete(k));
      if (typeof showToast === 'function') showToast(`Đã đăng ký ${targetKeys.length} hạng mục và chuyển sang Chờ QC.`);
      renderQcSignageModal();
    }

    // Pass all items currently in 'waiting' to 'pass'
    async function performPassAllWaiting() {
      const keys = [];
      qcSignageUiState.itemsByKey.forEach((row, key) => {
        if (row && row.status === 'waiting') keys.push(key);
      });
      if (!keys.length) {
        if (typeof showToast === 'function') showToast('Không có hạng mục nào trong Chờ QC để pass.');
        renderQcSignageModal();
        return;
      }
      for (const key of keys) {
        await setQcSignageItemStatus(key, 'pass', { lastResult: 'pass', lastReason: '' });
      }
      if (typeof showToast === 'function') showToast(`Đã pass ${keys.length} hạng mục.`);
      renderQcSignageModal();
    }

    async function setQcSignageItemStatus(key, status, options = {}) {
      if (!key) return;
      const row = qcSignageUiState.itemsByKey.get(key);
      if (!row) return;
      const idx = productionOrders.findIndex(o => getProductionOrderKey(o) === row.orderKey);
      if (idx < 0) return;
      const order = productionOrders[idx];
      const state = parseQcSignageState(order);
      const existing = state.items[key] || {};
      const now = new Date().toISOString();
      const next = {
        status,
        lastResult: options.lastResult !== undefined
          ? options.lastResult
          : (status === 'pass' ? 'pass' : status === 'waiting' ? null : existing.lastResult || null),
        lastReason: options.lastReason !== undefined
          ? options.lastReason
          : (status === 'pass' || status === 'waiting' ? '' : existing.lastReason || ''),
        lastReasonAt: options.lastReason
          ? now
          : (status === 'pass' || status === 'waiting' ? null : existing.lastReasonAt || null),
        updatedAt: now
      };
      state.items[key] = next;
      await persistQcSignageState(row.orderKey, state);
    }

    async function appendQcSignageNote(orderKey, text) {
      if (!orderKey || !text) return;
      const idx = productionOrders.findIndex(o => getProductionOrderKey(o) === orderKey);
      if (idx < 0) return;
      const order = productionOrders[idx];
      const notes = Array.isArray(order.notes) ? [...order.notes] : [];
      notes.push(ensureNoteHasAuthor({ text, at: new Date().toISOString() }));
      const updated = { ...order, notes };
      productionOrders[idx] = updated;
      if (window.dataSdk && typeof window.dataSdk.update === 'function') {
        try {
          await window.dataSdk.update(updated);
        } catch (err) {
          console.warn('Không thể lưu ghi chú QC:', err);
        }
      }
    }

    async function handleQcSignageAction(action, key) {
      if (!action || !key) return;
      if (action === 'pass') {
        await setQcSignageItemStatus(key, 'pass', { lastResult: 'pass', lastReason: '' });
        if (typeof showToast === 'function') showToast('Hạng mục đã pass QC.');
        renderQcSignageModal();
        return;
      }
      if (action === 'return') {
        openReturnConfirmModal(key);
        return;
      }
      if (action === 'pending' || action === 'fail') {
        openQcReasonModal(action, key);
      }
    }

    function showQcSignageReason(key) {
      if (!key) return;
      const row = qcSignageUiState.itemsByKey.get(key);
      if (!row || !row.lastReason) return;
      const label = row.lastResult === 'fail' ? 'Fail' : 'Pending';
      const modal = ensureQcReasonViewModal();
      const title = document.getElementById('qc-reason-view-title');
      if (title) title.textContent = `Lý do ${label}`;
      const content = document.getElementById('qc-reason-view-content');
      if (content) {
        // Thông tin: Outlet, Đơn Hàng, Loại bảng
        const outlet = row.quoteRef && row.quoteRef.outletName ? row.quoteRef.outletName : '';
        const orderNum = row.orderNumber || '';
        const typeLabel = row.typeLabel || '';
        content.innerHTML = `<div class='mb-4 text-sm text-gray-600'>Outlet: <span class='font-semibold'>${escapeQcHtml(outlet)}</span> - Đơn Hàng: <span class='font-semibold'>${escapeQcHtml(orderNum)}</span> - Loại bảng: <span class='font-semibold'>${escapeQcHtml(typeLabel)}</span></div><div class='border rounded p-3 bg-gray-50'>${escapeQcHtml(row.lastReason)}</div>`;
      }
      modal.classList.remove('hidden');
      ensureScrollLock();
      const closeBtn = document.getElementById('qc-reason-view-close');
      if (closeBtn && !closeBtn._qcBound) {
        closeBtn._qcBound = true;
        closeBtn.addEventListener('click', () => {
          modal.classList.add('hidden');
          ensureScrollLock();
        });
      }
      if (!modal._qcEscBound) {
        modal._qcEscBound = true;
        modal.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            modal.classList.add('hidden');
            ensureScrollLock();
          }
        });
      }
      setTimeout(() => { modal.focus && modal.focus(); }, 0);
    }

    function ensureReturnConfirmModalElement() {
      return document.getElementById('qc-return-confirm-modal');
    }

    function openReturnConfirmModal(key) {
      if (!key) return;
      const row = qcSignageUiState.itemsByKey.get(key);
      const outlet = row && row.quoteRef && row.quoteRef.outletName ? row.quoteRef.outletName : (row && row.quoteRef && row.quoteRef.outletCode ? row.quoteRef.outletCode : '');
      const modal = ensureReturnConfirmModalElement();
      if (!modal) {
        if (typeof showToast === 'function') showToast('Không tìm thấy cửa sổ xác nhận.');
        return;
      }
      qcSignageUiState.returnConfirm.pendingKey = key;
      qcSignageUiState.returnConfirm.pendingOutlet = outlet || '';
      const outletEl = document.getElementById('qc-return-outlet-name');
      if (outletEl) outletEl.textContent = outlet || '-';
      modal.classList.remove('hidden');
      ensureScrollLock();
      // Bind controls once
      if (!modal._qcBound) {
        modal._qcBound = true;
        const closeBtn = document.getElementById('qc-return-confirm-close');
        if (closeBtn) closeBtn.addEventListener('click', () => { modal.classList.add('hidden'); qcSignageUiState.returnConfirm.pendingKey = null; ensureScrollLock(); });
        const cancelBtn = document.getElementById('qc-return-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => { modal.classList.add('hidden'); qcSignageUiState.returnConfirm.pendingKey = null; ensureScrollLock(); });
        const confirmBtn = document.getElementById('qc-return-confirm');
        if (confirmBtn) confirmBtn.addEventListener('click', async () => {
          confirmBtn.disabled = true;
          const k = qcSignageUiState.returnConfirm.pendingKey;
          if (k) {
            await setQcSignageItemStatus(k, 'waiting', { lastResult: null, lastReason: '' });
            if (typeof showToast === 'function') showToast('Đã trả về sang Chờ QC.');
            qcSignageUiState.returnConfirm.pendingKey = null;
            modal.classList.add('hidden');
            renderQcSignageModal();
          }
          confirmBtn.disabled = false;
          ensureScrollLock();
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) { modal.classList.add('hidden'); qcSignageUiState.returnConfirm.pendingKey = null; ensureScrollLock(); } });
        modal.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            modal.classList.add('hidden'); qcSignageUiState.returnConfirm.pendingKey = null; ensureScrollLock();
          } else if (e.key === 'Enter') {
            const btn = document.getElementById('qc-return-confirm'); if (btn) btn.click();
          }
        });
      }
      // Focus for keyboard events
      setTimeout(() => { const b = document.getElementById('qc-return-confirm'); if (b) b.focus(); else modal.focus && modal.focus(); }, 0);
    }

    // Export selected keys (optional). If `keys` provided, use them; otherwise fallback to current selection
    function exportQcSignageToExcel(keys) {
      const selectedKeys = Array.isArray(keys) ? keys : Array.from(qcSignageUiState.selection);
      if (selectedKeys.length === 0) {
        if (typeof showToast === 'function') showToast('Chưa chọn hạng mục nào để xuất.');
        return;
      }
      const rows = collectQcSignageRows();
      const selectedRows = rows.filter(row => selectedKeys.includes(row.key));
      const data = selectedRows.map((row, index) => ({
        STT: index + 1,
        Area: row.quoteRef.area || 'South',
        'Mã SPO': row.quoteRef.spoNumber || '',
        'Mã Outlet': row.quoteRef.outletCode || '',
        'Tên Outlet': row.quoteRef.outletName || '',
        'Tỉnh/thành phố': row.quoteRef.province || '',
        'Xã/phường': row.quoteRef.district || '',
        'Ấp/khóm': row.quoteRef.ward || '',
        'Tên đường': row.quoteRef.street || '',
        'Số nhà': row.quoteRef.house_number || '',
        'Ngang': row.item.width || '',
        'Cao': row.item.height || '',
        'Trụ phi 90': '',
        'Nhãn hàng': row.item.brand || '',
        'Loại bảng': row.typeLabel || ''
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'QC Signage');
      const fileName = `QC_Signage_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      if (typeof showToast === 'function') showToast(`Đã xuất ${selectedKeys.length} hạng mục ra file Excel.`);
    }

    function attachQcSignageDelegates(tab) {
      const panel = document.getElementById(`qc-tab-panel-${tab}`);
      if (!panel) return;
      const qcUnselectBtn = document.getElementById('qc-unselect-btn');
      const qcRegisterBtn = document.getElementById('qc-register-btn'); // todo: Thêm vào danh sách
      const qcListRegisterBtn = document.getElementById('qc-list-register-btn'); // list: Đăng ký QC
      const qcExportBtn = document.getElementById('qc-export-btn');
      const qcPassAllBtn = document.getElementById('qc-pass-all-btn');
      // pass filters container (show only on pass tab)
      const passFilters = document.getElementById('qc-pass-filters');
      if (passFilters) passFilters.classList.add('hidden');

      const bindUnselect = () => {
        if (!qcUnselectBtn) return;
        qcUnselectBtn.disabled = qcSignageUiState.selection.size === 0;
        qcUnselectBtn.onclick = () => {
          const modal = ensureQcUnselectConfirmModal();
          modal.classList.remove('hidden');
          ensureScrollLock();
          if (!modal._qcBound) {
            modal._qcBound = true;
            const cancelBtn = document.getElementById('qc-unselect-cancel');
            if (cancelBtn) cancelBtn.onclick = () => { modal.classList.add('hidden'); ensureScrollLock(); };
            const confirmBtn = document.getElementById('qc-unselect-confirm');
            if (confirmBtn) confirmBtn.onclick = () => {
              qcSignageUiState.selection.clear();
              modal.classList.add('hidden');
              renderQcSignageModal();
              ensureScrollLock();
            };
            modal.addEventListener('click', (event) => { if (event.target === modal) { modal.classList.add('hidden'); ensureScrollLock(); } });
          }
        };
      };

      if (tab === 'todo') {
        if (qcPassAllBtn) qcPassAllBtn.classList.add('hidden');
        panel.querySelectorAll('tr[data-qc-row="true"]').forEach(rowEl => {
          rowEl.onclick = (event) => {
            const interactive = event.target.closest('button, a, input, textarea, select, label');
            if (interactive) return;
            if (rowEl.getAttribute('data-qc-disabled') === 'true') return;
            const key = rowEl.getAttribute('data-qc-key');
            if (!key) return;
            if (qcSignageUiState.selection.has(key)) qcSignageUiState.selection.delete(key);
            else qcSignageUiState.selection.add(key);
            renderQcSignageModal();
          };
        });
        panel.querySelectorAll('[data-qc-reason]').forEach(btn => {
          btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-qc-reason');
            showQcSignageReason(key);
          });
        });
        if (qcRegisterBtn) {
          qcRegisterBtn.disabled = qcSignageUiState.selection.size === 0;
          qcRegisterBtn.textContent = 'Thêm vào Danh sách';
          qcRegisterBtn.setAttribute('aria-label', 'Thêm vào Danh sách QC');
          qcRegisterBtn.onclick = async () => {
            qcRegisterBtn.disabled = true;
            await moveSelectedQcItemsToList();
            qcRegisterBtn.disabled = false;
          };
          qcRegisterBtn.classList.remove('hidden');
        }
        if (qcListRegisterBtn) qcListRegisterBtn.classList.add('hidden');
        if (qcExportBtn) qcExportBtn.classList.add('hidden');
        bindUnselect();
        updateQcSelectionSummary();
        // Select-all button for todo
        const qcSelectAllBtn = document.getElementById('qc-select-all-btn');
        if (qcSelectAllBtn) {
          const rows = Array.from(panel.querySelectorAll('tr[data-qc-row="true"]')).filter(r => r.getAttribute('data-qc-disabled') !== 'true');
          qcSelectAllBtn.disabled = rows.length === 0;
          qcSelectAllBtn.classList.remove('hidden');
          const allSelected = rows.length && Array.from(rows).every(r => qcSignageUiState.selection.has(r.getAttribute('data-qc-key')));
          qcSelectAllBtn.textContent = allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
          qcSelectAllBtn.onclick = () => {
            const keys = Array.from(rows).map(r => r.getAttribute('data-qc-key'));
            const currentlyAll = keys.length && keys.every(k => qcSignageUiState.selection.has(k));
            if (currentlyAll) {
              keys.forEach(k => qcSignageUiState.selection.delete(k));
            } else {
              keys.forEach(k => qcSignageUiState.selection.add(k));
            }
            renderQcSignageModal();
          };
        }
        // Show unselect and count
        const qcUnselectBtn = document.getElementById('qc-unselect-btn');
        if (qcUnselectBtn) qcUnselectBtn.classList.remove('hidden');
        const qcSelectionCount = document.getElementById('qc-selection-count');
        if (qcSelectionCount) qcSelectionCount.classList.remove('hidden');
      } else if (tab === 'waiting') {
        // Ensure select-all hidden in non-todo tabs
        const qcSelectAllBtn = document.getElementById('qc-select-all-btn');
        if (qcSelectAllBtn) qcSelectAllBtn.classList.add('hidden');
        panel.querySelectorAll('[data-qc-action]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const action = btn.getAttribute('data-qc-action');
            const key = btn.getAttribute('data-qc-key');
            if (!action || !key) return;
            btn.disabled = true;
            await handleQcSignageAction(action, key);
            btn.disabled = false;
          });
        });
        if (qcRegisterBtn) qcRegisterBtn.classList.add('hidden');
        if (qcListRegisterBtn) qcListRegisterBtn.classList.add('hidden');
        if (qcExportBtn) qcExportBtn.classList.add('hidden');
        if (qcPassAllBtn) qcPassAllBtn.classList.remove('hidden');
        // Hide unselect and count
        const qcUnselectBtn = document.getElementById('qc-unselect-btn');
        if (qcUnselectBtn) qcUnselectBtn.classList.add('hidden');
        const qcSelectionCount = document.getElementById('qc-selection-count');
        if (qcSelectionCount) qcSelectionCount.classList.add('hidden');
      } else if (tab === 'list') {
        // Ensure select-all hidden in non-todo tabs
        const qcSelectAllBtn2 = document.getElementById('qc-select-all-btn');
        if (qcSelectAllBtn2) qcSelectAllBtn2.classList.add('hidden');
        panel.querySelectorAll('tr[data-qc-row="true"]').forEach(rowEl => {
          rowEl.onclick = (event) => {
            const interactive = event.target.closest('button, a, input, textarea, select, label');
            if (interactive) return;
            const key = rowEl.getAttribute('data-qc-key');
            if (!key) return;
            if (qcSignageUiState.selection.has(key)) qcSignageUiState.selection.delete(key);
            else qcSignageUiState.selection.add(key);
            renderQcSignageModal();
          };
        });
        if (qcListRegisterBtn) {
          qcListRegisterBtn.classList.remove('hidden');
          // enable if there are any rows in list (allow acting on all when none selected)
          const listRows = panel.querySelectorAll('tr[data-qc-row="true"]');
          qcListRegisterBtn.disabled = listRows.length === 0;
          qcListRegisterBtn.onclick = async () => {
            qcListRegisterBtn.disabled = true;
            // use current selection if present, otherwise operate on all list keys
            const keys = Array.from(qcSignageUiState.selection).filter(k => {
              const r = qcSignageUiState.itemsByKey.get(k); return r && r.status === 'list';
            });
            const effectiveKeys = keys.length ? keys : Array.from(qcSignageUiState.itemsByKey).filter(([k,v]) => v && v.status === 'list').map(([k])=>k);
            if (effectiveKeys.length) {
              exportQcSignageToExcel(effectiveKeys);
              await moveListSelectedToWaiting(effectiveKeys);
            } else {
              if (typeof showToast === 'function') showToast('Không có hạng mục nào để đăng ký.');
            }
            qcListRegisterBtn.disabled = false;
          };
        }
        if (qcExportBtn) {
          qcExportBtn.classList.remove('hidden');
          qcExportBtn.onclick = () => {
            const keys = Array.from(qcSignageUiState.selection).filter(k => {
              const r = qcSignageUiState.itemsByKey.get(k);
              return r && r.status === 'list';
            });
            const effectiveKeys = keys.length ? keys : Array.from(qcSignageUiState.itemsByKey).filter(([k,v]) => v && v.status === 'list').map(([k])=>k);
            if (effectiveKeys.length) {
              exportQcSignageToExcel(effectiveKeys);
            } else {
              if (typeof showToast === 'function') showToast('Không có hạng mục nào để xuất.');
            }
          };
        }
        if (qcRegisterBtn) qcRegisterBtn.classList.add('hidden');
        if (qcPassAllBtn) qcPassAllBtn.classList.add('hidden');
        // Attach remove buttons in list
        panel.querySelectorAll('[data-qc-action="remove"]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const key = btn.getAttribute('data-qc-key');
            if (!key) return;
            btn.disabled = true;
            await setQcSignageItemStatus(key, 'todo', { lastResult: null, lastReason: '' });
            if (typeof showToast === 'function') showToast('Đã loại khỏi Danh sách QC.');
            renderQcSignageModal();
          });
        });
        bindUnselect();
        updateQcSelectionSummary();
        // Show unselect and count
        const qcUnselectBtn = document.getElementById('qc-unselect-btn');
        if (qcUnselectBtn) qcUnselectBtn.classList.remove('hidden');
        const qcSelectionCount = document.getElementById('qc-selection-count');
        if (qcSelectionCount) qcSelectionCount.classList.remove('hidden');
      } else if (tab === 'pass') {
          // Hide select-all in pass tab as well
        const qcSelectAllBtn3 = document.getElementById('qc-select-all-btn');
        if (qcSelectAllBtn3) qcSelectAllBtn3.classList.add('hidden');
        // Show pass date filters
        const passFilters = document.getElementById('qc-pass-filters');
        if (passFilters) {
          passFilters.classList.remove('hidden');
          const pf = document.getElementById('qc-pass-from');
          const pt = document.getElementById('qc-pass-to');
          if (pf) {
            pf.value = qcSignageUiState.passFilterFrom || '';
            pf.style.width = '120px'; // Fixed width to prevent jumping
            if (qcSignageUiState.passFilterTo) {
              pf.max = qcSignageUiState.passFilterTo;
            } else {
              pf.removeAttribute('max');
            }
          }
          if (pt) {
            pt.value = qcSignageUiState.passFilterTo || '';
            pt.style.width = '120px'; // Fixed width to prevent jumping
            if (qcSignageUiState.passFilterFrom) {
              pt.min = qcSignageUiState.passFilterFrom;
            } else {
              pt.removeAttribute('min');
            }
          }
        }
        panel.querySelectorAll('[data-qc-action]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const action = btn.getAttribute('data-qc-action');
            const key = btn.getAttribute('data-qc-key');
            if (!action || !key) return;
            btn.disabled = true;
            await handleQcSignageAction(action, key);
            btn.disabled = false;
          });
        });
        // Highlight whole row when hovering the 'Trả về' button
        panel.querySelectorAll('[data-qc-action="return"]').forEach(btn => {
          const tr = btn.closest('tr');
          if (!tr) return;
          btn.addEventListener('mouseenter', () => {
            if (!tr.classList.contains('bg-green-50')) tr.classList.add('bg-gray-100');
          });
          btn.addEventListener('mouseleave', () => {
            if (tr.classList.contains('bg-gray-100')) tr.classList.remove('bg-gray-100');
          });
        });
        if (qcPassAllBtn) qcPassAllBtn.classList.add('hidden');
        if (qcRegisterBtn) qcRegisterBtn.classList.add('hidden');
        if (qcListRegisterBtn) qcListRegisterBtn.classList.add('hidden');
        if (qcExportBtn) qcExportBtn.classList.add('hidden');
        // Hide unselect and count
        const qcUnselectBtn = document.getElementById('qc-unselect-btn');
        if (qcUnselectBtn) qcUnselectBtn.classList.add('hidden');
        const qcSelectionCount = document.getElementById('qc-selection-count');
        if (qcSelectionCount) qcSelectionCount.classList.add('hidden');
      }
    }

    function renderQcSignageModal() {
      const modal = ensureQcSignageModalElement();
      if (!modal || modal.classList.contains('hidden')) return;
      const rows = collectQcSignageRows();
      const grouped = { todo: [], list: [], waiting: [], pass: [] };
      rows.forEach(row => {
        if (row.status === 'waiting') grouped.waiting.push(row);
        else if (row.status === 'pass') grouped.pass.push(row);
        else if (row.status === 'list') grouped.list.push(row);
        else grouped.todo.push(row);
      });
      updateQcTabButtons({
        todo: grouped.todo.length,
        list: grouped.list.length,
        waiting: grouped.waiting.length,
        pass: grouped.pass.length
      });

      // Apply 'pass' date filters (if set) — filter by row.updatedAt
      if (qcSignageUiState.passFilterFrom || qcSignageUiState.passFilterTo) {
        const from = qcSignageUiState.passFilterFrom ? new Date(qcSignageUiState.passFilterFrom) : null;
        const to = qcSignageUiState.passFilterTo ? new Date(qcSignageUiState.passFilterTo) : null;
        if (to) to.setHours(23, 59, 59, 999);
        grouped.pass = grouped.pass.filter(row => {
          if (!row.updatedAt) return false;
          const d = new Date(row.updatedAt);
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        });
      }
      const searchInput = document.getElementById('qc-search-input');
      if (searchInput && searchInput.value !== qcSignageUiState.searchTerm) {
        searchInput.value = qcSignageUiState.searchTerm;
      }
      const activeTab = qcSignageUiState.activeTab || 'todo';
      const pageSize = Math.max(1, parseInt(qcSignageUiState.pageSize || 15, 10) || 15);
      const totalForActive = grouped[activeTab] ? grouped[activeTab].length : 0;
      const totalPages = Math.max(1, Math.ceil(totalForActive / pageSize));
      const pageByTab = qcSignageUiState.pageByTab || (qcSignageUiState.pageByTab = { todo: 1, list: 1, waiting: 1, pass: 1 });
      let activePage = parseInt(pageByTab[activeTab] || 1, 10) || 1;
      if (activePage > totalPages) activePage = totalPages;
      if (activePage < 1) activePage = 1;
      pageByTab[activeTab] = activePage;
      const startIdx = (activePage - 1) * pageSize;
      const endIdx = startIdx + pageSize;
      const pagedRows = grouped[activeTab].slice(startIdx, endIdx);

      // Update pagination UI
      try {
        const info = document.getElementById('qc-page-info');
        const prevBtn = document.getElementById('qc-page-prev');
        const nextBtn = document.getElementById('qc-page-next');
        const sizeSelect = document.getElementById('qc-page-size');
        if (info) info.textContent = `Trang ${activePage} / ${totalPages} (${totalForActive})`;
        if (prevBtn) prevBtn.disabled = activePage <= 1;
        if (nextBtn) nextBtn.disabled = activePage >= totalPages;
        if (sizeSelect) sizeSelect.value = String(pageSize);
      } catch (e) { /* ignore */ }

      ['todo','list','waiting','pass'].forEach(tab => {
        const panel = document.getElementById(`qc-tab-panel-${tab}`);
        if (!panel) return;
        if (qcSignageUiState.activeTab === tab) {
          panel.classList.remove('hidden');
          panel.innerHTML = buildQcSignageTabHtml(tab, pagedRows);
        } else {
          panel.classList.add('hidden');
          panel.innerHTML = '';
        }
      });
      attachQcSignageDelegates(qcSignageUiState.activeTab);
    }

    function handleQcTabSwitch(tab) {
      if (!tab || tab === qcSignageUiState.activeTab) return;
      if (!['todo', 'list', 'waiting', 'pass'].includes(tab)) return;
      qcSignageUiState.activeTab = tab;
      renderQcSignageModal();
    }

    function openQcSignageModal() {
      const modal = ensureQcSignageModalElement();
      if (!modal) {
        if (typeof showToast === 'function') showToast('Không tìm thấy cửa sổ QC.');
        return;
      }
      setupQcSignageModalHandlers();
      modal.classList.remove('hidden');
      ensureScrollLock();
      renderQcSignageModal();
      const searchInput = document.getElementById('qc-search-input');
      if (searchInput) {
        searchInput.value = qcSignageUiState.searchTerm;
        searchInput.focus();
        const len = searchInput.value.length;
        if (typeof searchInput.setSelectionRange === 'function') {
          searchInput.setSelectionRange(len, len);
        }
      }
    }

    function closeQcSignageModal() {
      const modal = document.getElementById('qc-signage-modal');
      if (!modal) return;
      modal.classList.add('hidden');
      qcSignageUiState.selection.clear();
      ensureScrollLock();
    }

    function resetQcReasonModalState() {
      qcSignageUiState.reasonModal.pendingAction = null;
      qcSignageUiState.reasonModal.pendingKey = null;
    }

    function closeQcReasonModal() {
      const modal = document.getElementById('qc-reason-modal');
      if (!modal) return;
      modal.classList.add('hidden');
      const input = document.getElementById('qc-reason-input');
      if (input) {
        input.value = '';
      }
      resetQcReasonModalState();
      ensureScrollLock();
    }

    async function submitQcReasonModal() {
      const { pendingAction, pendingKey } = qcSignageUiState.reasonModal;
      if (!pendingAction || !pendingKey) {
        closeQcReasonModal();
        return;
      }
      const input = document.getElementById('qc-reason-input');
      const reason = input ? input.value.trim() : '';
      if (!reason) {
        if (typeof showToast === 'function') showToast('Vui lòng nhập lý do.');
        if (input) input.focus();
        return;
      }
      const row = qcSignageUiState.itemsByKey.get(pendingKey);
      await setQcSignageItemStatus(pendingKey, 'todo', { lastResult: pendingAction, lastReason: reason });
      if (row) {
        const label = pendingAction === 'fail' ? 'Fail' : 'Pending';
        // Resolve authoritative outlet info from currentQuotes when possible
        let oc = row.quoteRef.outletCode || '';
        let on = row.quoteRef.outletName || '';
        try {
          let aq = null;
          if (row.quoteRef && row.quoteRef.quoteCode) aq = findQuoteByIdentifier(row.quoteRef.quoteCode) || aq;
          if (!aq && row.quoteRef && row.quoteRef.spoNumber) aq = findQuoteByIdentifier(row.quoteRef.spoNumber) || aq;
          if (!aq && row.quoteRef && row.quoteRef.outletCode && Array.isArray(currentQuotes)) aq = currentQuotes.find(q => String(q.outlet_code) === String(row.quoteRef.outletCode)) || aq;
          if (aq) {
            oc = aq.outlet_code || oc;
            on = aq.outlet_name || on;
          }
        } catch (e) { /* ignore */ }
        const message = `QC Bảng hiệu • ${label} • ĐH ${row.orderNumber} • Outlet ${oc || '-'} - ${on || '-'} • Item ${row.item.code || ''} ${row.typeLabel}: ${reason}`;
        await appendQcSignageNote(row.orderKey, message);
      }
      if (typeof showToast === 'function') {
        const label = pendingAction === 'fail' ? 'Fail' : 'Pending';
        showToast(`Đã đánh dấu ${label}.`);
      }
      closeQcReasonModal();
      renderQcSignageModal();
    }

    function ensureQcReasonModalElement() {
      return document.getElementById('qc-reason-modal');
    }

    function ensureQcReasonViewModal() {
      return document.getElementById('qc-reason-view-modal');
    }

    function openQcReasonModal(action, key) {
      const modal = ensureQcReasonModalElement();
      if (!modal) {
        if (typeof showToast === 'function') showToast('Không tìm thấy cửa sổ nhập lý do.');
        return;
      }
      qcSignageUiState.reasonModal.pendingAction = action;
      qcSignageUiState.reasonModal.pendingKey = key;
      const title = document.getElementById('qc-reason-title');
      if (title) {
        title.textContent = action === 'fail' ? 'Lý do Fail' : 'Lý do Pending';
      }
      const input = document.getElementById('qc-reason-input');
      if (input) {
        input.value = '';
        const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
        schedule(() => {
          input.focus();
        });
      }
      modal.classList.remove('hidden');
      ensureScrollLock();
    }

    function setupQcSignageModalHandlers() {
      if (qcSignageHandlersBound) return;
      const modal = ensureQcSignageModalElement();
      if (!modal) return;
      qcSignageHandlersBound = true;
      const closeBtn = document.getElementById('close-qc-signage-modal');
      if (closeBtn) {
        closeBtn.addEventListener('click', closeQcSignageModal);
      }
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          closeQcSignageModal();
        }
      });
      const searchInput = document.getElementById('qc-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (event) => {
          qcSignageUiState.searchTerm = event.target.value || '';
          if (qcSignageUiState.pageByTab) {
            const tab = qcSignageUiState.activeTab || 'todo';
            qcSignageUiState.pageByTab[tab] = 1;
          }
          renderQcSignageModal();
        });
      }

      // Pagination controls
      const qcPrevBtn = document.getElementById('qc-page-prev');
      const qcNextBtn = document.getElementById('qc-page-next');
      const qcPageSize = document.getElementById('qc-page-size');
      if (qcPrevBtn && !qcPrevBtn._qcBound) {
        qcPrevBtn._qcBound = true;
        qcPrevBtn.addEventListener('click', () => {
          const tab = qcSignageUiState.activeTab || 'todo';
          qcSignageUiState.pageByTab = qcSignageUiState.pageByTab || { todo: 1, list: 1, waiting: 1, pass: 1 };
          qcSignageUiState.pageByTab[tab] = Math.max(1, (qcSignageUiState.pageByTab[tab] || 1) - 1);
          renderQcSignageModal();
        });
      }
      if (qcNextBtn && !qcNextBtn._qcBound) {
        qcNextBtn._qcBound = true;
        qcNextBtn.addEventListener('click', () => {
          const tab = qcSignageUiState.activeTab || 'todo';
          qcSignageUiState.pageByTab = qcSignageUiState.pageByTab || { todo: 1, list: 1, waiting: 1, pass: 1 };
          qcSignageUiState.pageByTab[tab] = (qcSignageUiState.pageByTab[tab] || 1) + 1;
          renderQcSignageModal();
        });
      }
      if (qcPageSize && !qcPageSize._qcBound) {
        qcPageSize._qcBound = true;
        qcPageSize.addEventListener('change', (e) => {
          const next = parseInt(e.target.value, 10) || 15;
          qcSignageUiState.pageSize = next;
          if (qcSignageUiState.pageByTab) {
            const tab = qcSignageUiState.activeTab || 'todo';
            qcSignageUiState.pageByTab[tab] = 1;
          }
          renderQcSignageModal();
        });
      }

      // Date filters for 'Đạt QC' tab (auto-apply)
      const passFrom = document.getElementById('qc-pass-from');
      const passTo = document.getElementById('qc-pass-to');
      if (passFrom && !passFrom._qcBound) {
        passFrom._qcBound = true;
        passFrom.addEventListener('change', (e) => {
          const fromValue = e.target.value;
          qcSignageUiState.passFilterFrom = fromValue || '';
          // Set min for 'to' date
          if (passTo && fromValue) {
            passTo.min = fromValue;
            // If current 'to' is before 'from', clear it
            if (passTo.value && passTo.value < fromValue) {
              passTo.value = '';
              qcSignageUiState.passFilterTo = '';
            }
          } else if (passTo) {
            passTo.removeAttribute('min');
          }
          renderQcSignageModal();
        });
      }
      if (passTo && !passTo._qcBound) {
        passTo._qcBound = true;
        passTo.addEventListener('change', (e) => {
          const toValue = e.target.value;
          qcSignageUiState.passFilterTo = toValue || '';
          // Set max for 'from' date
          if (passFrom && toValue) {
            passFrom.max = toValue;
            // If current 'from' is after 'to', clear it
            if (passFrom.value && passFrom.value > toValue) {
              passFrom.value = '';
              qcSignageUiState.passFilterFrom = '';
            }
          } else if (passFrom) {
            passFrom.removeAttribute('max');
          }
          renderQcSignageModal();
        });
      }
      const passClear = document.getElementById('qc-pass-clear');
      if (passClear && !passClear._qcBound) {
        passClear._qcBound = true;
        passClear.addEventListener('click', () => {
          qcSignageUiState.passFilterFrom = qcSignageUiState.passFilterTo = '';
          if (passFrom) {
            passFrom.value = '';
            passFrom.removeAttribute('max');
          }
          if (passTo) {
            passTo.value = '';
            passTo.removeAttribute('min');
          }
          renderQcSignageModal();
        });
      }
      const tabButtons = document.querySelectorAll('[data-qc-tab]');
      tabButtons.forEach(btn => {
        if (btn._qcBound) return;
        btn._qcBound = true;
        btn.addEventListener('click', () => {
          const value = btn.getAttribute('data-qc-tab');
          handleQcTabSwitch(value);
        });
      });
      const reasonModal = ensureQcReasonModalElement();
      if (reasonModal && !reasonModal._qcBound) {
        reasonModal._qcBound = true;
        reasonModal.addEventListener('click', (event) => {
          if (event.target === reasonModal) {
            closeQcReasonModal();
          }
        });
        const closeBtn = document.getElementById('qc-reason-close');
        if (closeBtn) closeBtn.addEventListener('click', closeQcReasonModal);
        const cancelBtn = document.getElementById('qc-reason-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', closeQcReasonModal);
        const submitBtn = document.getElementById('qc-reason-submit');
        if (submitBtn) submitBtn.addEventListener('click', submitQcReasonModal);
        const input = document.getElementById('qc-reason-input');
        if (input) {
          input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submitQcReasonModal();
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              closeQcReasonModal();
            }
          });
        }
      }
      const reasonViewModal = ensureQcReasonViewModal();
      if (reasonViewModal && !reasonViewModal._qcBound) {
        reasonViewModal._qcBound = true;
        reasonViewModal.addEventListener('click', (event) => {
          if (event.target === reasonViewModal) {
            reasonViewModal.classList.add('hidden');
            ensureScrollLock();
          }
        });
        const closeBtn = document.getElementById('qc-reason-view-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
          reasonViewModal.classList.add('hidden');
          ensureScrollLock();
        });
        const okBtn = document.getElementById('qc-reason-view-ok');
        if (okBtn) okBtn.addEventListener('click', () => {
          reasonViewModal.classList.add('hidden');
          ensureScrollLock();
        });
      }
      // Bind Pass All button to confirmation modal
      const qcPassAllBtn = document.getElementById('qc-pass-all-btn');
      if (qcPassAllBtn && !qcPassAllBtn._qcBound) {
        qcPassAllBtn._qcBound = true;
        qcPassAllBtn.addEventListener('click', () => {
          const modal = ensureQcPassAllConfirmModal();
          modal.classList.remove('hidden');
          ensureScrollLock();
          if (!modal._qcBound) {
            modal._qcBound = true;
            const cancelBtn = document.getElementById('qc-pass-all-cancel');
            const confirmBtn = document.getElementById('qc-pass-all-confirm');
            if (cancelBtn) cancelBtn.addEventListener('click', () => { modal.classList.add('hidden'); ensureScrollLock(); });
            if (confirmBtn) confirmBtn.addEventListener('click', async () => {
              confirmBtn.disabled = true;
              await performPassAllWaiting();
              confirmBtn.disabled = false;
              modal.classList.add('hidden');
              ensureScrollLock();
            });
            modal.addEventListener('click', (event) => { if (event.target === modal) { modal.classList.add('hidden'); ensureScrollLock(); } });
          }
        });
      }
    }

    // Initialize
    function bootApp() {
      initializeApp();
      setupSearch();
      setupQcSignageModalHandlers();
      setupExcelImportHandlers();
      setupSidebar();
      setupViewToggle();
    }

    // Restore sidebar event bindings (was removed in corruption)
    function setupSidebar() {
      const createBtn = document.getElementById('create-quote-btn');
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          currentEditingQuoteKey = null;
          setQuoteModalMode('create');
          resetQuoteForm();
          setupQuoteModalHandlersOnce();
          document.getElementById('quote-modal').classList.remove('hidden');
          updateSaleTypeUI();
          ensureScrollLock();
          // Ensure measurements run after modal is visible to avoid
          // measuring before layout; double rAF helps wait for paint.
          if (typeof computeAndLockItemsContainerHeight === 'function') {
            requestAnimationFrame(() => requestAnimationFrame(() => {
              try { computeAndLockItemsContainerHeight(); } catch (e) { /* ignore */ }
            }));
          }
        });
      }
      const prodBtn = document.getElementById('create-production-order');
      if (prodBtn) {
        prodBtn.addEventListener('click', () => openProductionOrderModal());
      }
      const manageBtn = document.getElementById('manage-production-orders');
      if (manageBtn) {
        manageBtn.addEventListener('click', () => openManageProductionOrdersModal());
      }
      const qcBtn = document.getElementById('qc-signage');
      if (qcBtn) {
        qcBtn.addEventListener('click', () => openQcSignageModal());
      }
      const galleryBtn = document.getElementById('quote-gallery-btn');
      if (galleryBtn) {
        galleryBtn.addEventListener('click', () => openQuoteImagesModal());
      }
      const closeGalleryBtn = document.getElementById('close-quote-images-modal');
      if (closeGalleryBtn && !closeGalleryBtn._bound) {
        closeGalleryBtn._bound = true;
        closeGalleryBtn.addEventListener('click', closeQuoteImagesModal);
      }

      // Bind gallery export button to multi-export behavior (like Project Backup 9.0)
      const exportGalleryBtn = document.getElementById('quote-images-export-btn');
      if (exportGalleryBtn && !exportGalleryBtn._bound) {
        exportGalleryBtn._bound = true;
        exportGalleryBtn.addEventListener('click', exportSelectedQuoteImages);
      }
      const exportGalleryPdfBtn = document.getElementById('quote-images-export-pdf-btn');
      if (exportGalleryPdfBtn && !exportGalleryPdfBtn._bound) {
        exportGalleryPdfBtn._bound = true;
        exportGalleryPdfBtn.addEventListener('click', exportSelectedQuoteImagesAsPdf);
      }

      // Bind date filter inputs
      const fromDateEl = document.getElementById('quote-images-from-date');
      if (fromDateEl && !fromDateEl._bound) {
        fromDateEl._bound = true;
        fromDateEl.addEventListener('change', () => {
          const toDateEl = document.getElementById('quote-images-to-date');
          if (toDateEl) {
            toDateEl.min = fromDateEl.value || '';
            if (fromDateEl.value && toDateEl.value && fromDateEl.value > toDateEl.value) {
              toDateEl.value = fromDateEl.value;
            }
          }
          // Reset to first page when date filter changes
          quoteGalleryPage = 1;
          const searchEl = document.getElementById('quote-images-search');
          const term = searchEl ? searchEl.value : '';
          renderQuoteImagesGallery(term);
        });
      }
      const toDateEl = document.getElementById('quote-images-to-date');
      if (toDateEl && !toDateEl._bound) {
        toDateEl._bound = true;
        toDateEl.addEventListener('change', () => {
          const fromDateEl = document.getElementById('quote-images-from-date');
          if (fromDateEl) {
            fromDateEl.max = toDateEl.value || '';
            if (toDateEl.value && fromDateEl.value && fromDateEl.value > toDateEl.value) {
              fromDateEl.value = toDateEl.value;
            }
          }
          // Reset to first page when date filter changes
          quoteGalleryPage = 1;
          const searchEl = document.getElementById('quote-images-search');
          const term = searchEl ? searchEl.value : '';
          renderQuoteImagesGallery(term);
        });
      }
      // Date mode toggle (two-sided control)
      const dateCreatedBtn = document.getElementById('quote-images-date-mode-created');
      const dateUpdatedBtn = document.getElementById('quote-images-date-mode-updated');
      function updateDateModeUI() {
        if (!dateCreatedBtn || !dateUpdatedBtn) return;
        const createdSelected = quoteGalleryDateMode === 'created';
        // Selected style
        if (createdSelected) {
          dateCreatedBtn.classList.remove('text-gray-500','bg-gray-100');
          dateCreatedBtn.classList.add('text-gray-900','bg-white','border','border-blue-500','shadow-sm');
          dateUpdatedBtn.classList.remove('text-gray-900','bg-white','border','border-blue-500','shadow-sm');
          dateUpdatedBtn.classList.add('text-gray-500','bg-gray-100');
          dateCreatedBtn.setAttribute('aria-pressed','true');
          dateUpdatedBtn.setAttribute('aria-pressed','false');
        } else {
          dateUpdatedBtn.classList.remove('text-gray-500','bg-gray-100');
          dateUpdatedBtn.classList.add('text-gray-900','bg-white','border','border-blue-500','shadow-sm');
          dateCreatedBtn.classList.remove('text-gray-900','bg-white','border','border-blue-500','shadow-sm');
          dateCreatedBtn.classList.add('text-gray-500','bg-gray-100');
          dateUpdatedBtn.setAttribute('aria-pressed','true');
          dateCreatedBtn.setAttribute('aria-pressed','false');
        }
      }
      if (dateCreatedBtn && !dateCreatedBtn._bound) {
        dateCreatedBtn._bound = true;
        dateCreatedBtn.addEventListener('click', () => {
          if (quoteGalleryDateMode === 'created') return;
          quoteGalleryDateMode = 'created';
          updateDateModeUI();
          // Reset to first page on mode change
          quoteGalleryPage = 1;
          const searchEl = document.getElementById('quote-images-search');
          const term = searchEl ? searchEl.value : '';
          renderQuoteImagesGallery(term);
        });
      }
      if (dateUpdatedBtn && !dateUpdatedBtn._bound) {
        dateUpdatedBtn._bound = true;
        dateUpdatedBtn.addEventListener('click', () => {
          if (quoteGalleryDateMode === 'updated') return;
          quoteGalleryDateMode = 'updated';
          updateDateModeUI();
          // Reset to first page on mode change
          quoteGalleryPage = 1;
          const searchEl = document.getElementById('quote-images-search');
          const term = searchEl ? searchEl.value : '';
          renderQuoteImagesGallery(term);
        });
      }

      // Update UI helper to mirror Backup 9.0 behavior
      function updateQuoteGallerySelectionUI() {
        const count = getQuoteGallerySelectionCount();
        const btn = document.getElementById('quote-images-export-btn');
        if (btn) {
          btn.textContent = count > 0 ? `Xuất JPG (${count})` : 'Xuất JPG';
          btn.disabled = count === 0;
        }
      }

      async function exportSelectedQuoteImages() {
        const entries = collectQuoteImagesForGallery();
        const entryMap = new Map(entries.map((e) => [e.id, e]));
        const selectedIds = Array.from(selectedQuoteGalleryIds || []);
        const selectedEntries = selectedIds.map((id) => entryMap.get(id)).filter(Boolean);
        if (!selectedEntries.length) {
          showToast('Chọn ít nhất 1 hình để xuất JPG');
          return;
        }
        if (typeof window.html2canvas !== 'function' && typeof html2canvas === 'undefined') {
          showToast('Thiếu thư viện html2canvas để xuất JPG');
          return;
        }

        // helper to convert dataURL -> Blob (with retries/backoff)
        const dataUrlToBlob = async (dataUrl) => {
          const res = await qcagFetchWithRetries(dataUrl);
          return await res.blob();
        };

        // Ask for save location: prefer directory picker for batch export
        let dirHandle = null;
        let useDirectory = false;
        if (window.showDirectoryPicker) {
          try {
            dirHandle = await window.showDirectoryPicker();
            useDirectory = !!dirHandle;
          } catch (e) {
            // user cancelled or not supported / fallback
            dirHandle = null;
            useDirectory = false;
          }
        }

        // If directory picker not available, ask user whether to choose per-file save dialogs (showSaveFilePicker)
        let usePerFilePicker = false;
        if (!useDirectory && window.showSaveFilePicker) {
          // Ask user once whether they want to choose a save location per file.
          try {
            // simple confirm via native confirm (no UI modal available)
            usePerFilePicker = confirm('Trình duyệt của bạn hỗ trợ chọn nơi lưu. Bạn muốn chọn vị trí lưu cho mỗi ảnh không? (OK = có, Cancel = dùng tải xuống mặc định)');
          } catch (e) {
            usePerFilePicker = false;
          }
        }

        let success = 0;
        try {
          // If directory chosen, write files directly into it
          if (useDirectory && dirHandle) {
            for (const entry of selectedEntries) {
              try {
                const quote = entry.quoteKey ? findQuoteByKey(entry.quoteKey) : null;
                const data = quote ? buildQuotePreviewDataFromQuote(quote) : {
                  quoteCode: entry.quoteCode || '---',
                  outletCode: entry.outletCode || '',
                  outletName: entry.outletName || '',
                  area: entry.area || '',
                  saleName: entry.saleName || '',
                  saleCode: '',
                  salePhone: '',
                  saleType: 'Sale (SR)',
                  ssName: entry.ssName || '',
                  address: '',
                  spoName: '',
                  totalAmount: 0,
                  items: [],
                  primaryImage: null,
                  brandFooter: 'Quảng cáo An Giang báo giá',
                  brandApproval: 'Heineken Việt Nam duyệt',
                  createdAt: null,
                  updatedAt: null
                };
                if (!data.primaryImage && entry.hasImage && entry.src) data.primaryImage = { data: entry.src, name: entry.name || 'Hình báo giá' };
                const filenameBase = sanitizeFilenameForDownload(`${data.quoteCode || 'BG'} - ${data.outletName || 'Outlet'}`);
                const filename = `${filenameBase}.jpg`;
                const dataUrl = await renderPreviewToJpegDataUrl(data, { includeQcagSign: false });
                const blob = await dataUrlToBlob(dataUrl);
                const fh = await dirHandle.getFileHandle(filename, { create: true });
                const writable = await fh.createWritable();
                await writable.write(blob);
                await writable.close();
                success += 1;
              } catch (err) {
                console.error('Error exporting to directory', err);
              }
            }
            if (success) showToast(`Đã lưu ${success} ảnh vào thư mục`);
            return;
          }

          // If per-file picker chosen
          if (usePerFilePicker) {
            for (const entry of selectedEntries) {
              try {
                const quote = entry.quoteKey ? findQuoteByKey(entry.quoteKey) : null;
                const data = quote ? buildQuotePreviewDataFromQuote(quote) : {
                  quoteCode: entry.quoteCode || '---',
                  outletCode: entry.outletCode || '',
                  outletName: entry.outletName || '',
                  area: entry.area || '',
                  saleName: entry.saleName || '',
                  saleCode: '',
                  salePhone: '',
                  saleType: 'Sale (SR)',
                  ssName: entry.ssName || '',
                  address: '',
                  spoName: '',
                  totalAmount: 0,
                  items: [],
                  primaryImage: null,
                  brandFooter: 'Quảng cáo An Giang báo giá',
                  brandApproval: 'Heineken Việt Nam duyệt',
                  createdAt: null,
                  updatedAt: null
                };
                if (!data.primaryImage && entry.hasImage && entry.src) data.primaryImage = { data: entry.src, name: entry.name || 'Hình báo giá' };
                const filenameBase = sanitizeFilenameForDownload(`${data.quoteCode || 'BG'} - ${data.outletName || 'Outlet'}`);
                const filename = `${filenameBase}.jpg`;
                const dataUrl = await renderPreviewToJpegDataUrl(data, { includeQcagSign: false });
                const blob = await dataUrlToBlob(dataUrl);

                try {
                  const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'JPEG image', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } }] });
                  const writable = await handle.createWritable();
                  await writable.write(blob);
                  await writable.close();
                  success += 1;
                } catch (e) {
                  // user cancelled this file; continue with next
                  console.warn('User canceled save for', filename);
                }
              } catch (err) {
                console.error('Per-file save error', err);
              }
            }
            if (success) showToast(`Đã lưu ${success} ảnh`);
            return;
          }

          // Fallback: anchor downloads (browser default location) but confirm first
          try {
            const proceed = confirm('Trình duyệt không hỗ trợ chọn thư mục/chọn nơi lưu hàng loạt. Tiếp tục tải xuống (sử dụng thư mục tải xuống của trình duyệt)?');
            if (!proceed) {
              showToast('Hủy xuất ảnh');
              return;
            }
          } catch (e) {}

          for (const entry of selectedEntries) {
            try {
              const quote = entry.quoteKey ? findQuoteByKey(entry.quoteKey) : null;
              const data = quote ? buildQuotePreviewDataFromQuote(quote) : {
                quoteCode: entry.quoteCode || '---',
                outletCode: entry.outletCode || '',
                outletName: entry.outletName || '',
                area: entry.area || '',
                saleName: entry.saleName || '',
                saleCode: '',
                salePhone: '',
                saleType: 'Sale (SR)',
                ssName: entry.ssName || '',
                address: '',
                spoName: '',
                totalAmount: 0,
                items: [],
                primaryImage: null,
                brandFooter: 'Quảng cáo An Giang báo giá',
                brandApproval: 'Heineken Việt Nam duyệt',
                createdAt: null,
                updatedAt: null
              };
              if (!data.primaryImage && entry.hasImage && entry.src) data.primaryImage = { data: entry.src, name: entry.name || 'Hình báo giá' };
              const filenameBase = sanitizeFilenameForDownload(`${data.quoteCode || 'BG'} - ${data.outletName || 'Outlet'}`);
              const filename = `${filenameBase}.jpg`;
              const dataUrl = await renderPreviewToJpegDataUrl(data, { includeQcagSign: false });
              triggerDataUrlDownload(dataUrl, filename);
              success += 1;
            } catch (err) {
              console.error('Fallback anchor download error', err);
            }
          }
          if (success) showToast(`Đã xuất ${success} JPG`);
        } catch (err) {
          console.error('Export selected images error', err);
          showToast('Lỗi khi xuất ảnh');
        } finally {
          // Reset selected gallery images after an export attempt (per user request)
          try {
            selectedQuoteGalleryIds = new Set();
            updateQuoteGallerySelectionUI();
            const searchEl = document.getElementById('quote-images-search');
            const searchTerm = searchEl ? (searchEl.value || '') : '';
            // Re-render gallery to reflect cleared selection
            try { renderQuoteImagesGallery(searchTerm); } catch (e) { /* ignore render errors */ }
          } catch (e) {
            console.warn('Failed to reset gallery selection after export:', e);
          }
        }
      }

      // New: Export selected images as PDF (one PDF per image). Loads jsPDF from CDN if needed.
      async function exportSelectedQuoteImagesAsPdf() {
        const entries = collectQuoteImagesForGallery();
        const entryMap = new Map(entries.map((e) => [e.id, e]));
        const selectedIds = Array.from(selectedQuoteGalleryIds || []);
        const selectedEntries = selectedIds.map((id) => entryMap.get(id)).filter(Boolean);
        if (!selectedEntries.length) {
          showToast('Chọn ít nhất 1 hình để xuất PDF');
          return;
        }

        function ensureJsPdf() {
          if (typeof window.jsPDF === 'function' || (typeof window.jsPDF === 'object' && window.jsPDF)) return Promise.resolve();
          return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/1.5.3/jspdf.min.js';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Không tải được jsPDF'));
            document.head.appendChild(s);
          });
        }

        let success = 0;
        try {
          await ensureJsPdf();
        } catch (err) {
          showToast('Không thể tải thư viện tạo PDF (jsPDF). Vui lòng thử lại.');
          return;
        }

        try {
          for (const entry of selectedEntries) {
            try {
              const quote = entry.quoteKey ? findQuoteByKey(entry.quoteKey) : null;
              const data = quote ? buildQuotePreviewDataFromQuote(quote) : {
                quoteCode: entry.quoteCode || '---',
                outletCode: entry.outletCode || '',
                outletName: entry.outletName || '',
                area: entry.area || '',
                saleName: entry.saleName || '',
                saleCode: '',
                salePhone: '',
                saleType: 'Sale (SR)',
                ssName: entry.ssName || '',
                address: '',
                spoName: '',
                totalAmount: 0,
                items: [],
                primaryImage: null,
                brandFooter: 'Quảng cáo An Giang báo giá',
                brandApproval: 'Heineken Việt Nam duyệt',
                createdAt: null,
                updatedAt: null
              };
              if (!data.primaryImage && entry.hasImage && entry.src) data.primaryImage = { data: entry.src, name: entry.name || 'Hình báo giá' };

              const filenameBase = sanitizeFilenameForDownload(`${data.quoteCode || 'BG'} - ${data.outletName || 'Outlet'}`);
              const filename = `${filenameBase}.pdf`;

              const dataUrl = await renderPreviewToJpegDataUrl(data);

              const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = reject;
                i.src = dataUrl;
              });

              const pdf = new jsPDF('l', 'mm', 'a4');
              const pxToMm = (px) => px * 0.264583;
              const imgWmm = pxToMm(img.naturalWidth || img.width || 1123);
              const imgHmm = pxToMm(img.naturalHeight || img.height || 794);
              const pageW = pdf.internal.pageSize.getWidth();
              const pageH = pdf.internal.pageSize.getHeight();
              const scale = Math.min(pageW / imgWmm, pageH / imgHmm);
              const drawW = imgWmm * scale;
              const drawH = imgHmm * scale;
              const x = (pageW - drawW) / 2;
              const y = (pageH - drawH) / 2;

              pdf.addImage(dataUrl, 'JPEG', x, y, drawW, drawH);
              pdf.save(filename);
              success += 1;
            } catch (err) {
              console.error('PDF export error', err);
            }
          }
          if (success) showToast(`Đã xuất ${success} PDF`);
        } catch (err) {
          console.error('Export selected images (PDF) error', err);
          showToast('Lỗi khi xuất PDF');
        } finally {
          // Reset selection after export attempt (consistent with JPG behavior)
          try {
            selectedQuoteGalleryIds = new Set();
            updateQuoteGallerySelectionUI();
            const searchEl = document.getElementById('quote-images-search');
            const searchTerm = searchEl ? (searchEl.value || '') : '';
            try { renderQuoteImagesGallery(searchTerm); } catch (e) { }
          } catch (e) {
            console.warn('Failed to reset gallery selection after PDF export:', e);
          }
        }
      }

      // Export a single quote as PDF (reuses preview render code)
      async function exportQuoteAsPdf(identifier) {
        const quote = findQuoteByIdentifier(identifier);
        if (!quote) {
          showToast && showToast('Không tìm thấy báo giá để xuất PDF');
          return;
        }
        function ensureJsPdf() {
          if (typeof window.jsPDF === 'function' || (typeof window.jsPDF === 'object' && window.jsPDF)) return Promise.resolve();
          return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/1.5.3/jspdf.min.js';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Không tải được jsPDF'));
            document.head.appendChild(s);
          });
        }

        try {
          await ensureJsPdf();
        } catch (err) {
          showToast && showToast('Không thể tải thư viện tạo PDF (jsPDF). Vui lòng thử lại.');
          return;
        }

        try {
          const data = buildQuotePreviewDataFromQuote(quote);
          const filenameBase = sanitizeFilenameForDownload(`${data.quoteCode || 'BG'} - ${data.outletName || 'Outlet'}`);
          const filename = `${filenameBase}.pdf`;
          const dataUrl = await renderPreviewToJpegDataUrl(data);
          const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = dataUrl;
          });

          const pdf = new jsPDF('l', 'mm', 'a4');
          const pxToMm = (px) => px * 0.264583;
          const imgWmm = pxToMm(img.naturalWidth || img.width || 1123);
          const imgHmm = pxToMm(img.naturalHeight || img.height || 794);
          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();
          const scale = Math.min(pageW / imgWmm, pageH / imgHmm);
          const drawW = imgWmm * scale;
          const drawH = imgHmm * scale;
          const x = (pageW - drawW) / 2;
          const y = (pageH - drawH) / 2;

          pdf.addImage(dataUrl, 'JPEG', x, y, drawW, drawH);
          pdf.save(filename);
          showToast && showToast('Đã xuất PDF');
        } catch (err) {
          console.error('Export single quote PDF error', err);
          showToast && showToast('Lỗi khi xuất PDF');
        }
      }
      window.exportQuoteAsPdf = exportQuoteAsPdf;

      const galleryModal = document.getElementById('quote-images-modal');
      if (galleryModal && !galleryModal._bound) {
        galleryModal._bound = true;
        galleryModal.addEventListener('click', (event) => {
          if (event.target === galleryModal) closeQuoteImagesModal();
        });
      }
    }
    // View mode toggle handlers
    function setupViewToggle() {
      const listBtn = document.getElementById('view-list-btn');
      const outletBtn = document.getElementById('view-outlet-btn');
      if (!listBtn || !outletBtn) return;
      const setActive = () => {
        if (viewMode === 'list') {
          listBtn.classList.add('bg-white','shadow','text-gray-800');
          outletBtn.classList.remove('bg-white','shadow','text-gray-800');
          outletBtn.classList.add('text-gray-600');
        } else {
          outletBtn.classList.add('bg-white','shadow','text-gray-800');
          listBtn.classList.remove('bg-white','shadow','text-gray-800');
          listBtn.classList.add('text-gray-600');
        }
      }
      listBtn.addEventListener('click', () => { if (viewMode !== 'list') { viewMode = 'list'; listPage = 1; setActive(); updateMainList(); } });
      outletBtn.addEventListener('click', () => { if (viewMode !== 'outlet') { viewMode = 'outlet'; outletPage = 1; setActive(); updateMainList(); } });
      setActive();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootApp);
    } else {
      bootApp();
    }
    
    // Test Quote Seeder removed

    // Setup Excel import handler for 'Nhập dữ liệu SPO' button
    function setupExcelImportHandlers() {
      const input = document.getElementById('excel-upload');
      if (!input || input._bound) return;
      input._bound = true;

      input.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const reader = new FileReader();
        reader.onload = function(ev) {
          try {
            let workbook;
            if (ext === 'csv') {
              const text = ev.target.result;
              workbook = XLSX.read(text, { type: 'string' });
            } else {
              const data = ev.target.result;
              workbook = XLSX.read(data, { type: 'array' });
            }

            const sheetName = workbook.SheetNames && workbook.SheetNames[0];
            if (!sheetName) {
              alert('Không tìm thấy sheet trong file.');
              input.value = '';
              return;
            }
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

            // Find SPO and Status columns by scanning rows top-down and taking first match
            let spoCol, statusCol;
            let spoRow = -1, statusRow = -1;
            for (let r = 0; r < rows.length; r++) {
              const row = rows[r] || [];
              for (let c = 0; c < row.length; c++) {
                const cell = String(row[c] || '').trim().toLowerCase();
                if (!spoCol && cell && cell.includes('spo')) { spoCol = c; spoRow = r; }
                if (!statusCol && cell && (cell.includes('status') || cell.includes('trạng') || cell.includes('trang'))) { statusCol = c; statusRow = r; }
                if (typeof spoCol !== 'undefined' && typeof statusCol !== 'undefined') break;
              }
              if (typeof spoCol !== 'undefined' && typeof statusCol !== 'undefined') break;
            }

            if (typeof statusCol === 'undefined') {
              alert('Không tìm thấy cột Status (status/trạng thái) trong file. Import bị hủy.');
              input.value = '';
              return;
            }
            if (typeof spoCol === 'undefined') {
              alert('Không tìm thấy cột SPO trong file. Import bị hủy.');
              input.value = '';
              return;
            }

            const startRow = Math.max(spoRow, statusRow) + 1;
            const updates = new Map(); // spoNumber -> status (last wins)
            let scanned = 0, invalid = 0;

            for (let r = startRow; r < rows.length; r++) {
              const row = rows[r] || [];
              const rawSpo = String(row[spoCol] || '').trim();
              const digitMatch = (rawSpo.match(/\d+/) || [])[0];
              if (!digitMatch || !/^\d{6,7}$/.test(digitMatch)) {
                // not a valid SPO (6 or 7 digits)
                invalid++;
                continue;
              }
              const spoVal = digitMatch;
              const rawStatus = String(row[statusCol] || '').trim();
              // Ignore empty status cells (do not overwrite existing)
              if (!rawStatus) {
                // still count as scanned (we saw SPO) but won't set an update
                scanned++;
                continue;
              }
              // last occurrence wins
              updates.set(spoVal, rawStatus);
              scanned++;
            }

            // Apply updates to currentQuotes (overwrite with latest file value). Do not remove others.
            let updated = 0;
            const notFoundList = [];
            // Work on a copy of keys to iterate remaining not found later
            const updateKeys = new Set(updates.keys());

            for (let i = 0; i < currentQuotes.length; i++) {
              const q = currentQuotes[i];
              const qNum = (String(q.spo_number || '').match(/\d+/) || [''])[0];
              if (qNum && updates.has(qNum)) {
                const newStatus = updates.get(qNum);
                const prevStatus = q.spo_status || '';
                if (prevStatus !== newStatus) {
                  // update and add system note
                  currentQuotes[i] = { ...q, spo_status: newStatus };
                  try { addSystemNoteForQuote(currentQuotes[i], `Cập nhật trạng thái SPO từ "${prevStatus || '-'}" → "${newStatus}" (import)`); } catch (e) { /* ignore */ }
                  updated++;
                }
                updateKeys.delete(qNum);
              }
            }

            updateKeys.forEach(k => notFoundList.push(k));

            // Re-render list
            try { renderQuotesList(currentQuotes); } catch (e) { /* ignore */ }

            alert(`Import hoàn thành.\nDòng hợp lệ (đã đọc): ${scanned}.\nĐã cập nhật: ${updated}.\nBỏ qua (SPO không hợp lệ): ${invalid}.\nSPO trong file không tìm thấy trong hệ thống: ${notFoundList.length}.`);

          } catch (err) {
            console.error('Excel import error:', err);
            alert('Lỗi khi đọc file Excel: ' + (err && err.message ? err.message : 'Không xác định'));
          } finally {
            // reset input so the same file can be re-selected
            input.value = '';
          }
        };
        if (ext === 'csv') reader.readAsText(file, 'utf-8'); else reader.readAsArrayBuffer(file);
      });
    }

    function formatCurrencyExact(amount) {
      if (amount == null) return '0 đ';
      const n = Number(amount);
      if (!Number.isFinite(n)) return '0 đ';
      const sign = n < 0 ? '-' : '';
      const abs = Math.abs(n);
      let s = String(abs);
      if (s.indexOf('e') !== -1) {
        s = abs.toFixed(12).replace(/0+$/, '');
        if (s.indexOf('.') !== -1) s = s.replace(/\.?0+$/, '');
      }
      const parts = s.split('.');
      let intPart = parts[0] || '0';
      const decPart = parts[1] || '';
      intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return decPart ? `${sign}${intPart},${decPart} đ` : `${sign}${intPart} đ`;
