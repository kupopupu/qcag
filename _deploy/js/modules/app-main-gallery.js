    // ==== QUOTE IMAGES GALLERY ====
    function collectQuoteImagesForGallery() {
      const entries = [];
      const parseImages = (imagesField) => {
        try {
          const arr = JSON.parse(imagesField || '[]');
          if (!Array.isArray(arr)) return [];
          return arr.map(img => {
            try {
              if (!img || typeof img !== 'object') return null;
              const normalized = { ...img };
              if (!normalized.data) normalized.data = normalized.url || normalized.src || '';
              return normalized;
            } catch (e) { return null; }
          }).filter(Boolean).filter(img => img.data);
        } catch (_) {
          return [];
        }
      };
      (currentQuotes || []).forEach((quote) => {
        const imgs = parseImages(quote.images);
        const code = formatQuoteCode(quote) || '---';
        const createdAt = quote.created_at || quote.updated_at || null;
        const quoteKey = getQuoteKey(quote);
        const baseId = quoteKey || code || 'Q';

        if (!imgs.length) {
          entries.push({
            id: `${baseId}::noimg`,
            hasImage: false,
            src: '',
            name: 'Non Image',
            quoteCode: code,
            outletName: quote.outlet_name || '',
            outletCode: quote.outlet_code || '',
            saleName: quote.sale_name || '',
            ssName: quote.ss_name || '',
            area: quote.area || '',
            spoNumber: quote.spo_number || '',
            isPrimary: true,
            createdAt,
            quoteKey
          });
          return;
        }

        imgs.forEach((img, idx) => {
          const srcVal = img.data || img.url || img.src || '';
          entries.push({
            id: `${baseId}::${idx}`,
            hasImage: !!srcVal,
            src: srcVal,
            name: img.name || `Hình ${idx + 1}`,
            quoteCode: code,
            outletName: quote.outlet_name || '',
            outletCode: quote.outlet_code || '',
            saleName: quote.sale_name || '',
            ssName: quote.ss_name || '',
            area: quote.area || '',
            spoNumber: quote.spo_number || '',
            isPrimary: idx === 0,
            createdAt,
            quoteKey
          });
        });
      });
      return entries.sort((a, b) => {
        const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bd - ad;
      });
    }

    function renderQuoteImagesGallery(term = '') {
      const grid = document.getElementById('quote-gallery-grid');
      const empty = document.getElementById('quote-gallery-empty');
      const counter = document.getElementById('quote-images-count');
      if (!grid || !empty) return;
      const entries = collectQuoteImagesForGallery();
      const search = term.trim().toLowerCase();
      let filtered = search
        ? entries.filter((e) => {
            const haystack = [
              e.quoteCode,
              e.outletName,
              e.saleName,
              e.ssName,
              e.area,
              e.spoNumber,
              e.outletCode
            ].join(' | ').toLowerCase();
            return haystack.includes(search);
          })
        : entries;

      // Filter by date range
      const fromDateEl = document.getElementById('quote-images-from-date');
      const toDateEl = document.getElementById('quote-images-to-date');
      const fromDate = fromDateEl && fromDateEl.value ? new Date(fromDateEl.value) : null;
      const toDate = toDateEl && toDateEl.value ? new Date(toDateEl.value + 'T23:59:59') : null; // End of day
      if (fromDate || toDate) {
        filtered = filtered.filter((e) => {
          const dateStr = quoteGalleryDateMode === 'updated' ? (e.updatedAt || e.createdAt) : e.createdAt;
          if (!dateStr) return false;
          const entryDate = new Date(dateStr);
          if (fromDate && entryDate < fromDate) return false;
          if (toDate && entryDate > toDate) return false;
          return true;
        });
      }

      // Filter by selected area (single-select). 'all' means no filter
      if (quoteGallerySelectedArea && quoteGallerySelectedArea !== 'all') {
        filtered = filtered.filter(e => (e.area || '') === quoteGallerySelectedArea);
      }

      // Pagination: compute pages and slice entries for current page
      const total = filtered.length;
      const pageSize = Number(quoteGalleryPageSize) || 24;
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      if (quoteGalleryPage > pageCount) quoteGalleryPage = pageCount;
      if (quoteGalleryPage < 1) quoteGalleryPage = 1;
      const startIndex = (quoteGalleryPage - 1) * pageSize;
      const pageItems = filtered.slice(startIndex, startIndex + pageSize);

      if (!filtered.length) {
        grid.classList.add('hidden');
        empty.classList.remove('hidden');
        if (counter) counter.textContent = '0 hình';
        grid.innerHTML = '';
        updateQuoteGallerySelectionUI();
        return;
      }

      // Populate area filters (ensure area buttons reflect available areas)
      try {
        renderAreaFilters();
      } catch (e) { /* ignore area render errors */ }

      empty.classList.add('hidden');
      grid.classList.remove('hidden');
      if (counter) counter.textContent = `${total} hình`;
      // Update page info and prev/next button states
      try {
        const pageInfoEl = document.getElementById('quote-gallery-page-info');
        const prevBtn = document.getElementById('quote-gallery-prev-page');
        const nextBtn = document.getElementById('quote-gallery-next-page');
        if (pageInfoEl) pageInfoEl.textContent = `Trang ${quoteGalleryPage}/${pageCount} • ${total} hình`;
        if (prevBtn) prevBtn.disabled = quoteGalleryPage <= 1;
        if (nextBtn) nextBtn.disabled = quoteGalleryPage >= pageCount;
      } catch (e) { }

      grid.innerHTML = pageItems.map((e) => {
        const selected = selectedQuoteGalleryIds && selectedQuoteGalleryIds.has(e.id);
        return `
          <div class="quote-gallery-card ${selected ? 'selected' : ''}" data-entry-id="${e.id}" data-src="${e.src || ''}" data-name="${e.name || ''}" data-quote-key="${e.quoteKey || ''}" data-has-image="${e.hasImage ? '1' : '0'}" title="${e.quoteCode} - ${e.outletName}">
            <div class="quote-gallery-thumb ${e.hasImage ? '' : 'quote-gallery-thumb--empty'}" data-role="thumb">
              ${e.hasImage ? `<img src="${e.src}" alt="${e.name}">` : '<div class="quote-gallery-placeholder">Non Image</div>'}
            </div>
            <div class="quote-gallery-meta selectable" data-role="info">
              <div class="quote-gallery-code">${e.quoteCode}</div>
              <div class="quote-gallery-sub">Outlet: ${e.outletName || '---'}</div>
              <div class="quote-gallery-sub">Mã Outlet: ${e.outletCode || '---'}</div>
              <div class="quote-gallery-sub">Sale: ${e.saleName || '---'}</div>
              <div class="quote-gallery-sub">SS: ${e.ssName || '---'}</div>
              <div class="quote-gallery-sub">Khu vực: ${e.area || '---'}</div>
              <div class="quote-gallery-sub">SPO: ${e.spoNumber || '---'}</div>
              <div class="quote-gallery-select-badge">${selected ? '✓' : '+'}</div>
            </div>
          </div>
        `;
      }).join('');

      const updateCardSelection = (card, id, selected) => {
        if (!card) return;
        card.classList.toggle('selected', !!selected);
        const badge = card.querySelector('.quote-gallery-select-badge');
        if (badge) badge.textContent = selected ? '✓' : '+';
      };

      grid.querySelectorAll('.quote-gallery-card').forEach((card) => {
        const id = card.dataset.entryId;
        const thumb = card.querySelector('[data-role="thumb"]');
        const info = card.querySelector('[data-role="info"]');
        const hasImage = card.dataset.hasImage === '1';

        if (thumb) {
          thumb.addEventListener('click', () => {
            if (!hasImage) {
              showToast('Báo giá này chưa có hình (Non Image)');
              return;
            }
            const key = card.dataset.quoteKey;
            const quote = key ? findQuoteByKey(key) : null;
            if (quote) {
              // Open preview on top without closing the gallery modal
              openQuotePreviewForQuote(quote);
            } else {
              const src = card.dataset.src;
              const name = card.dataset.name || 'Hình báo giá';
              if (src) openImageViewer(src, name);
            }
          });
        }

        if (info) {
          info.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (!id) return;
            const nowSelected = toggleQuoteGallerySelection(id);
            updateCardSelection(card, id, nowSelected);
            updateQuoteGallerySelectionUI();
          });
        }
      });

      updateQuoteGallerySelectionUI();
    }

    function toggleQuoteGallerySelection(id) {
      if (!id) return false;
      if (!selectedQuoteGalleryIds) selectedQuoteGalleryIds = new Set();
      if (selectedQuoteGalleryIds.has(id)) {
        selectedQuoteGalleryIds.delete(id);
        return false;
      }
      selectedQuoteGalleryIds.add(id);
      return true;
    }

    // Render area filter buttons statically for specific areas
    function renderAreaFilters() {
      const container = document.getElementById('quote-images-area-buttons');
      if (!container) return;
      // Fixed list of areas and 'all'
      const areaList = ['S4', 'S5', 'S16', 'S17', 'S19', 'S24', 'Modern On Trade 8'];
      const allList = [...areaList, 'all'];
      const prevSelected = typeof quoteGallerySelectedArea !== 'undefined' ? quoteGallerySelectedArea : 'all';
      container.innerHTML = allList.map((a) => {
        const label = a === 'all' ? 'Tất cả' : a;
        const isSelected = a === prevSelected;
        const baseCls = 'px-2 py-1 text-sm font-medium rounded-md whitespace-nowrap';
        const selectedCls = isSelected ? 'text-gray-900 bg-white border border-blue-500 shadow-sm' : 'text-gray-500 bg-gray-100';
        // Make 'all' and 'Modern On Trade 8' span full width (3 cols) so they appear as a single horizontal row
        const spanCls = (a === 'all' || a === 'Modern On Trade 8') ? ' col-span-3' : '';
        return `<button type="button" data-area="${a}" class="area-filter-btn ${baseCls} ${selectedCls}${spanCls}">${label}</button>`;
      }).join('');

      // Bind handlers
      container.querySelectorAll('.area-filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const area = btn.getAttribute('data-area');
          if (!area) return;
          // single-select behaviour
          quoteGallerySelectedArea = area;
          updateAreaFilterUI();
          // Reset to page 1 when changing filters
          quoteGalleryPage = 1;
          const searchEl = document.getElementById('quote-images-search');
          const term = searchEl ? searchEl.value : '';
          renderQuoteImagesGallery(term);
        });
      });
    }

    function updateAreaFilterUI() {
      const container = document.getElementById('quote-images-area-buttons');
      if (!container) return;
      container.querySelectorAll('.area-filter-btn').forEach((btn) => {
        const a = btn.getAttribute('data-area');
        const selected = a === (quoteGallerySelectedArea || 'all');
        if (selected) {
          btn.classList.remove('text-gray-500','bg-gray-100');
          btn.classList.add('text-gray-900','bg-white','border','border-blue-500','shadow-sm');
          btn.setAttribute('aria-pressed','true');
        } else {
          btn.classList.remove('text-gray-900','bg-white','border','border-blue-500','shadow-sm');
          btn.classList.add('text-gray-500','bg-gray-100');
          btn.setAttribute('aria-pressed','false');
        }
      });
    }

    function getQuoteGallerySelectionCount() {
      return selectedQuoteGalleryIds ? selectedQuoteGalleryIds.size : 0;
    }

    function updateQuoteGallerySelectionUI() {
      // Keep export buttons in sync with selection count
      const count = getQuoteGallerySelectionCount();
      const jpgBtn = document.getElementById('quote-images-export-btn');
      if (jpgBtn) {
        jpgBtn.textContent = count > 0 ? `Xuất JPG (${count})` : 'Xuất JPG';
        jpgBtn.disabled = count === 0;
      }
      const pdfBtn = document.getElementById('quote-images-export-pdf-btn');
      if (pdfBtn) {
        pdfBtn.textContent = count > 0 ? `Xuất PDF (${count})` : 'Xuất PDF';
        pdfBtn.disabled = count === 0;
      }
    }

    function sanitizeFilenameForDownload(name) {
      const cleaned = String(name || 'Hinh').replace(/[\\/:*?"<>|]+/g, '-').trim();
      return cleaned || 'Hinh';
    }

    function triggerDataUrlDownload(dataUrl, filename) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function loadImageElement(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
      });
    }

    // Lightweight fetch wrapper with retries/backoff for 429s to reduce rate-limit failures
    async function qcagFetchWithRetries(url, opts) {
      const MAX_RETRIES = 4;
      const BASE_DELAY = 400; // ms
      let attempt = 0;
      while (true) {
        try {
          const res = await fetch(url, opts);
          if (res && (res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
            // exponential backoff
            const wait = BASE_DELAY * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, wait));
            attempt++;
            continue;
          }
          return res;
        } catch (e) {
          if (attempt >= MAX_RETRIES) throw e;
          const wait = BASE_DELAY * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, wait));
          attempt++;
        }
      }
    }

    async function loadImageWithFallback(src) {
      try {
        return await loadImageElement(src);
      } catch (_) {
        // For SVGs or file:// contexts, fetch and inline as data URL to avoid CORS/file issues
        try {
          const res = await qcagFetchWithRetries(src);
          const blob = await res.blob();
          const reader = new FileReader();
          const dataUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          return await loadImageElement(dataUrl);
        } catch (err) {
          throw err;
        }
      }
    }

    async function convertSrcToJpegDataUrl(src) {
      const img = await loadImageElement(src);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 1200;
      canvas.height = img.naturalHeight || img.height || 900;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.9);
    }

    async function generatePlaceholderJpeg(code, outlet) {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 900;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(1, '#1e293b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 88px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText('Non Image', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '600 36px Segoe UI';
      const line1 = code ? `Mã: ${code}` : 'Mã: ---';
      const line2 = outlet ? `Outlet: ${outlet}` : 'Outlet: ---';
      ctx.fillText(line1, canvas.width / 2, canvas.height / 2 + 30);
      ctx.fillText(line2, canvas.width / 2, canvas.height / 2 + 90);
      return canvas.toDataURL('image/jpeg', 0.9);
    }

    function getOrCreatePreviewExportSandbox() {
      let host = document.getElementById('quote-preview-export-sandbox');
      if (!host) {
        host = document.createElement('div');
        host.id = 'quote-preview-export-sandbox';
        host.style.position = 'fixed';
        host.style.left = '-99999px';
        host.style.top = '0';
        host.style.width = '1123px';
        host.style.height = '794px';
        host.style.background = '#fff';
        host.style.zIndex = '0';
        document.body.appendChild(host);
      }
      host.innerHTML = '';
      return host;
    }

    function clonePreviewForExport(source) {
      const rect = source.getBoundingClientRect();
      const clone = source.cloneNode(true);
      clone.id = 'quote-preview-export-clone';
      clone.style.position = 'fixed';
      clone.style.left = '-99999px';
      clone.style.top = '0';
      clone.style.width = `${Math.round(rect.width || 1123)}px`;
      clone.style.height = `${Math.round(rect.height || 794)}px`;
      clone.style.overflow = 'hidden';
      clone.style.background = '#ffffff';
      clone.style.margin = '0';
      clone.style.padding = '0';

      document.body.appendChild(clone);

      // Ensure cloned images set CORS so html2canvas can load them without tainting (server must allow CORS)
      const clonedImgs = Array.from(clone.querySelectorAll('img'));
      clonedImgs.forEach((ci) => {
        try {
          // Only set crossorigin for absolute/relative URLs (data: URIs are fine)
          if (ci.src && !ci.src.startsWith('data:') && !ci.src.startsWith('blob:')) {
            ci.crossOrigin = 'anonymous';
            ci.referrerPolicy = 'no-referrer';
          }
        } catch (e) { /* ignore */ }
      });

      const selectors = [
        '.quote-preview-code',
        '.quote-preview-date-row',
        '.quote-preview-head',
        '.quote-preview-row',
        '.quote-preview-head .col',
        '.quote-preview-row .col',
        '.quote-preview-card-row',
        '.quote-preview-tag',
        '.quote-preview-items-title',
        '.quote-preview-title',
        '.quote-preview-meta-row',
        '.quote-preview-total',
        '.quote-preview-card-title'
      ];

      selectors.forEach((selector) => {
        const originals = source.querySelectorAll(selector);
        const clones = clone.querySelectorAll(selector);
        originals.forEach((originalNode, index) => {
          const cloneNode = clones[index];
          if (!cloneNode) return;
          const computed = window.getComputedStyle(originalNode);
          cloneNode.style.fontFamily = computed.fontFamily;
          cloneNode.style.fontSize = computed.fontSize;
          cloneNode.style.fontWeight = computed.fontWeight;
          cloneNode.style.lineHeight = computed.lineHeight;
          cloneNode.style.display = computed.display;
          cloneNode.style.alignItems = computed.alignItems;
          cloneNode.style.justifyContent = computed.justifyContent;
          cloneNode.style.height = computed.height;
          cloneNode.style.paddingTop = computed.paddingTop;
          cloneNode.style.paddingBottom = computed.paddingBottom;
          cloneNode.style.paddingLeft = computed.paddingLeft;
          cloneNode.style.paddingRight = computed.paddingRight;
          cloneNode.style.marginTop = computed.marginTop;
          cloneNode.style.marginBottom = computed.marginBottom;
        });
      });

      return clone;
    }

    async function waitForFontsReady() {
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (_) {
          /* ignore font readiness errors */
        }
      }
    }

    async function waitForImagesToLoad(root) {
      const imgs = Array.from(root.querySelectorAll('img'));
      if (!imgs.length) return;
      await Promise.all(imgs.map((img) => {
        if (img.complete && img.naturalWidth) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      }));
    }

    // --- SVG text overlay helpers for precise export (no layout changes, DOM text preserved) ---
    function _canvasContextForFontStyle(style) {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      // Build a best-effort font shorthand for measurement
      const fontStyle = style.fontStyle || '';
      const fontWeight = style.fontWeight || '';
      const fontSize = style.fontSize || '12px';
      const fontFamily = style.fontFamily || 'sans-serif';
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`.trim();
      return ctx;
    }

    function _wrapTextToLines(text, ctx, maxWidth) {
      const words = text.replace(/\s+/g, ' ').trim().split(' ');
      if (!words.length) return [''];
      const lines = [];
      let line = '';
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const test = line ? line + ' ' + word : word;
        const w = ctx.measureText(test).width;
        if (w <= maxWidth || !line) {
          line = test;
        } else {
          lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    function createSvgTextOverlayForExport(root) {
      // root: element to export (should already be in DOM, positioned and sized)
      const containerRect = root.getBoundingClientRect();
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');

      svg.setAttribute('xmlns', svgNS);
      svg.setAttribute('width', String(Math.round(containerRect.width)));
      svg.setAttribute('height', String(Math.round(containerRect.height)));
      svg.setAttribute('viewBox', `0 0 ${Math.round(containerRect.width)} ${Math.round(containerRect.height)}`);

      // Absolute overlay wrapper
      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.left = '0px';
      wrapper.style.top = '0px';
      wrapper.style.width = `${Math.round(containerRect.width)}px`;
      wrapper.style.height = `${Math.round(containerRect.height)}px`;
      wrapper.style.pointerEvents = 'none';
      wrapper.style.zIndex = '9999';
      wrapper.appendChild(svg);

      // Walk text nodes to capture visual lines
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          // Reject nodes inside script/style
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const pTag = parent.tagName && parent.tagName.toLowerCase();
          if (pTag === 'script' || pTag === 'style') return NodeFilter.FILTER_REJECT;
          const cs = window.getComputedStyle(parent);
          if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }, false);

      const modifiedParents = new Map();
      const ctxCache = new Map();

      while (walker.nextNode()) {
        const tnode = walker.currentNode;
        const range = document.createRange();
        range.selectNodeContents(tnode);
        const clientRects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
        if (!clientRects.length) continue;

        const parent = tnode.parentElement;
        const cs = window.getComputedStyle(parent);
        const textColor = cs.color || '#000';
        const textAlign = cs.textAlign || 'left';
        const fontSize = parseFloat(cs.fontSize) || 12;
        const lineHeight = (() => {
          const lh = cs.lineHeight;
          if (lh === 'normal' || lh === 'initial' || !lh) return Math.round(fontSize * 1.15);
          return parseFloat(lh);
        })();

        // set parent text transparent (keeps layout)
        if (!modifiedParents.has(parent)) {
          modifiedParents.set(parent, parent.style.color || '');
          parent.style.color = 'transparent';
        }

        // prepare canvas context for measurement
        const fontKey = `${cs.fontStyle}|${cs.fontWeight}|${cs.fontSize}|${cs.fontFamily}`;
        if (!ctxCache.has(fontKey)) {
          const cctx = _canvasContextForFontStyle(cs);
          ctxCache.set(fontKey, cctx);
        }
        const measureCtx = ctxCache.get(fontKey);

        // wrap text into lines matching each clientRect width
        // We will approximate wrapping per block by slicing with each rect.width
        const rawText = tnode.nodeValue.replace(/\s+/g, ' ').trim();
        // If the text node maps to multiple rects (wrapped lines), compute lines for full available width
        // We'll produce lines using each rect's width in order. Use a char-fit fallback and ensure last-rect leftover is kept
        let remainingText = rawText;
        for (let i = 0; i < clientRects.length; i++) {
          const r = clientRects[i];
          const maxW = Math.max(1, Math.floor(r.width));
          // compute lines from remainingText that fit into maxW
          const lines = _wrapTextToLines(remainingText, measureCtx, maxW);
          // take the first line for this rect if available
          let line = lines.length ? lines[0] : '';

          // Fallback: if no word-wrapped line, fit by characters so we don't drop small trailing bits
          if (!line && remainingText) {
            line = remainingText;
            while (measureCtx.measureText(line).width > maxW && line.length > 1) {
              line = line.slice(0, -1);
            }
          }

          // If this is the last rect for this text node, include any remaining text to avoid accidental truncation
          if (i === clientRects.length - 1 && remainingText) {
            // prefer to keep full remaining text (safer than dropping chars); if it's too wide it will simply overflow visually
            line = remainingText;
            remainingText = '';
          } else if (line.length > 0) {
            // drop used part from remainingText
            const regex = new RegExp('^' + line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*');
            remainingText = remainingText.replace(regex, '');
          }

          // position
          const x = Math.round(r.left - containerRect.left + (textAlign === 'center' ? 0 : 0));
          // nudge text down ~1px to better vertically center across fonts/browsers
          const y = Math.round(r.top - containerRect.top) + 1;

          // create <text> element
          const textEl = document.createElementNS(svgNS, 'text');
          const tx = textAlign === 'center' ? Math.round(r.left - containerRect.left + r.width / 2) : x;
          textEl.setAttribute('x', String(tx));
          textEl.setAttribute('y', String(y));
          textEl.setAttribute('fill', textColor);
          textEl.setAttribute('font-family', cs.fontFamily || 'sans-serif');
          textEl.setAttribute('font-size', `${fontSize}px`);
          textEl.setAttribute('font-weight', cs.fontWeight || 'normal');
          textEl.setAttribute('dominant-baseline', 'hanging');
          textEl.setAttribute('text-anchor', textAlign === 'center' ? 'middle' : 'start');

          const tspan = document.createElementNS(svgNS, 'tspan');
          tspan.setAttribute('x', textEl.getAttribute('x'));
          tspan.setAttribute('dy', '0');
          tspan.setAttribute('xml:space', 'preserve');
          tspan.textContent = line;
          textEl.appendChild(tspan);

          // If there is additional wrapped content for this node beyond this rect (unlikely), append subsequent tspans
          // (We don't attempt to perfectly match exotic wrapping; this approach reduces line-shift differences.)
          svg.appendChild(textEl);
        }
      }

      // Attach overlay to root without changing layout (ensure root is positioned container)
      const prevPosition = root.style.position || '';
      const computedRootPos = window.getComputedStyle(root).position;
      if (computedRootPos === 'static') {
        root.style.position = 'relative';
      }

      root.appendChild(wrapper);

      return {
        async cleanup() {
          // restore parent colors
          for (const [el, prev] of modifiedParents.entries()) {
            try { el.style.color = prev; } catch (e) { /* ignore */ }
          }
          // remove overlay
          if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
          // restore root position
          if (computedRootPos === 'static') root.style.position = prevPosition || '';
        }
      };
    }

    async function renderPreviewToJpegDataUrl(data, options = {}) {
      // Prefer DOM/html2canvas-based renderer so JPG matches the on-screen preview exactly.
      // Fallback to canvas renderer for environments without html2canvas or if legacy render fails.
      const hasHtml2Canvas = (typeof window !== 'undefined' && typeof window.html2canvas === 'function') || (typeof html2canvas !== 'undefined');
      if (hasHtml2Canvas) {
        try {
          return await renderPreviewToJpegDataUrlLegacy(data, options);
        } catch (err) {
          console.warn('Legacy preview-to-JPG failed, falling back to canvas renderer:', err);
          try { showToast && showToast('Lỗi khi render HTML preview — sử dụng phương án dự phòng.'); } catch (e) {}
        }
      }
      try {
        return await renderPreviewToJpegDataUrlCanvas(data, options);
      } catch (err) {
        console.error('Canvas renderer failed:', err);
        try { showToast && showToast('Lỗi khi xuất ảnh (canvas): ' + (err && err.message ? err.message : String(err))); } catch (e) {}
        throw err;
      }
    }

    async function renderPreviewToJpegDataUrlCanvas(data, options = {}) {
      try {
      const includeQcagSign = options && typeof options === 'object' ? (options.includeQcagSign !== false) : true;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set canvas size (A4-like dimensions at 2x scale for quality)
      const scale = 2;
      const width = 1123;
      const height = 794;
      canvas.width = width * scale;
      canvas.height = height * scale;

      // Scale context for crisp rendering
      ctx.scale(scale, scale);

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Set font family to match CSS
      const fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

      // Helper functions
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

      // Page layout with proper spacing (14px padding, 12px gap)
      const pagePadding = 14;
      const sectionGap = 12;
      const leftWidth = Math.floor(width * 4 / 5) - pagePadding - sectionGap / 2; // flex: 4
      const rightWidth = Math.floor(width * 1 / 5) - pagePadding - sectionGap / 2; // flex: 1
      const leftX = pagePadding;
      const rightX = leftX + leftWidth + sectionGap;

      // Left side layout
      let leftY = pagePadding + sectionGap;

      // Preload small assets used in canvas renderer (logos + QCAG sign)
      let hvnLogoImg = null;
      let qcagLogoImg = null;
      let qcagSignImg = null;
      try { hvnLogoImg = await loadImageWithFallback('assets/hvn-logo.svg'); } catch (e) { hvnLogoImg = null; }
      try { qcagLogoImg = await loadImageWithFallback('assets/qcag-logo.svg'); } catch (e) { qcagLogoImg = null; }
      if (includeQcagSign) {
        try { qcagSignImg = await loadImageWithFallback('assets/qcag-1.0.png'); } catch (e) { qcagSignImg = null; }
      }

      // Title (20px, font-weight: 700, color: #111827)
      ctx.fillStyle = '#111827';
      ctx.font = `700 20px ${fontFamily}`;
      ctx.textAlign = 'left';
      // If HVN logo loaded, draw it above the title and push content down
      if (hvnLogoImg) {
        const logoMaxW = Math.min(272, leftWidth - sectionGap * 2); // reduced from 320 to 272 (~15%)
        const logoAspect = hvnLogoImg.width / (hvnLogoImg.height || 1);
        const logoW = logoMaxW;
        const logoH = Math.round(logoW / logoAspect);
        const logoX = leftX + sectionGap;
        // Align top of logo with top of code block: codeBlockY = pagePadding + sectionGap + 8
        const logoY = pagePadding + sectionGap + 8;
        try { ctx.drawImage(hvnLogoImg, logoX, logoY, logoW, logoH); } catch (e) { /* ignore */ }
        leftY = logoY + logoH + 8; // push content below logo
      }
      ctx.fillText('Báo giá bảng hiệu', leftX + sectionGap, leftY);
      leftY += 30;

      // Meta rows (12px, color: #475569)
      ctx.font = `12px ${fontFamily}`;
      ctx.fillStyle = '#475569';
      const metaY = leftY;
      ctx.fillText(`Mã: ${data.outletCode || '---'}`, leftX + sectionGap, metaY);
      ctx.fillText(`Outlet: ${data.outletName || '---'}`, leftX + sectionGap + 200, metaY);
      ctx.fillText(`Khu vực: ${data.area || '---'}`, leftX + sectionGap + 400, metaY);
      leftY += 20;

      // Address row (12px, color: #475569)
      ctx.fillText(`Địa chỉ: ${data.address || 'Chưa có địa chỉ'}`, leftX + sectionGap, leftY);
      leftY += 25;

      // Quote code block (13px, font-weight: 700, color: #0f172a, width: 240px)
      const codeBlockX = leftX + leftWidth - 240 - sectionGap;
      const codeBlockY = pagePadding + sectionGap + 8;

      // Draw code background
      ctx.fillStyle = '#e7f0ff';
      ctx.fillRect(codeBlockX, codeBlockY, 240, 44);

      // Draw code border
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1;
      ctx.strokeRect(codeBlockX, codeBlockY, 240, 44);

      // Quote code text
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 13px ${fontFamily}`;
      ctx.textAlign = 'center';
      const hasQuoteCode = data.quoteCode && !['Sẽ cấp sau khi lưu', '---'].includes(data.quoteCode);
      const quoteCodeText = hasQuoteCode ? `Mã báo giá: ${data.quoteCode}` : 'Mã Báo Giá: Chưa có Mã';
      ctx.fillText(quoteCodeText, codeBlockX + 120, codeBlockY + 28);

      // Dates block (11px, color: #334155, width: 240px)
      const datesY = codeBlockY + 44 + 6;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(codeBlockX, datesY, 240, 80);

      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(codeBlockX, datesY, 240, 80);

      ctx.fillStyle = '#334155';
      ctx.font = `11px ${fontFamily}`;
      ctx.textAlign = 'center';

      const createdLabel = data.createdAt ? formatDateTime(data.createdAt) : 'Chưa lưu';
      const updatedIsDifferent = (() => {
        if (!data.updatedAt) return false;
        if (!data.createdAt) return true;
        const created = new Date(data.createdAt);
        const updated = new Date(data.updatedAt);
        if (Number.isNaN(created.getTime()) || Number.isNaN(updated.getTime())) return false;
        return Math.abs(updated.getTime() - created.getTime()) > 2000;
      })();
      const updatedLabel = data.updatedAt && updatedIsDifferent ? formatDateTime(data.updatedAt) : 'Chưa có cập nhật mới';

      ctx.fillText(`Ngày tạo: ${createdLabel}`, codeBlockX + 120, datesY + 22);
      ctx.fillText(`Cập nhật gần nhất: ${updatedLabel}`, codeBlockX + 120, datesY + 58);

      // Image section (height: 340px)
      const imageY = Math.max(leftY, datesY + 80 + sectionGap);
      const imageHeight = 340;

      if (data.primaryImage && data.primaryImage.data) {
        try {
          const img = new Image();
          const bustToken = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
          const srcToUse = _appendCacheBust(data.primaryImage.data, bustToken);
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = srcToUse;
          });

          // Draw image frame border
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.strokeRect(leftX + sectionGap, imageY, leftWidth - sectionGap * 2, imageHeight);

          // Calculate image dimensions to fit within frame while preserving aspect ratio
          const frameWidth = leftWidth - sectionGap * 2 - 4; // account for border
          const frameHeight = imageHeight - 4;
          const imgAspect = img.width / img.height;
          const frameAspect = frameWidth / frameHeight;

          let drawWidth, drawHeight, drawX, drawY;
          if (imgAspect > frameAspect) {
            // Image is wider than frame
            drawWidth = frameWidth;
            drawHeight = frameWidth / imgAspect;
            drawX = leftX + sectionGap + 2;
            drawY = imageY + 2 + (frameHeight - drawHeight) / 2;
          } else {
            // Image is taller than frame
            drawHeight = frameHeight;
            drawWidth = frameHeight * imgAspect;
            drawX = leftX + sectionGap + 2 + (frameWidth - drawWidth) / 2;
            drawY = imageY + 2;
          }

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        } catch (e) {
          // Draw placeholder
          ctx.fillStyle = '#e5e7eb';
          ctx.fillRect(leftX + sectionGap, imageY, leftWidth - sectionGap * 2, imageHeight);

          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2;
          ctx.strokeRect(leftX + sectionGap, imageY, leftWidth - sectionGap * 2, imageHeight);

          ctx.fillStyle = '#374151';
          ctx.font = `700 16px ${fontFamily}`;
          ctx.textAlign = 'center';
          ctx.fillText('Non Image', leftX + sectionGap + (leftWidth - sectionGap * 2) / 2, imageY + imageHeight / 2);
        }
      } else {
        // Draw placeholder
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(leftX + sectionGap, imageY, leftWidth - sectionGap * 2, imageHeight);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.strokeRect(leftX + sectionGap, imageY, leftWidth - sectionGap * 2, imageHeight);

        ctx.fillStyle = '#374151';
        ctx.font = `700 16px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText('Non Image', leftX + sectionGap + (leftWidth - sectionGap * 2) / 2, imageY + imageHeight / 2);
      }

      // Items table
      let tableY = imageY + imageHeight + sectionGap;

      // Items title (15px, font-weight: 700, color: #0f172a)
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 15px ${fontFamily}`;
      ctx.textAlign = 'left';
      ctx.fillText('Chi tiết báo giá', leftX + sectionGap + 10, tableY + 20);
      tableY += 30;

      // Table headers (10.3px, font-weight: 800, color: #0f172a)
      ctx.font = `800 10.3px ${fontFamily}`;
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';

      // Column widths from CSS: code 42px, content 130px+, brand 64px, width/height 58px, qty/unit 52px, price 72px, total 90px
      const colWidths = [42, 130, 64, 58, 58, 52, 52, 72, 90];
      const headers = ['Code', 'Nội dung', 'Brand', 'Ngang', 'Cao', 'SL', 'ĐVT', 'Đơn giá', 'Thành tiền'];

      let tableX = leftX + sectionGap + 10;
      headers.forEach((header, i) => {
        ctx.fillText(header, tableX, tableY + 20);
        tableX += colWidths[i];
      });

      // Header separator line
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftX + sectionGap + 10, tableY + 25);
      ctx.lineTo(tableX - colWidths[colWidths.length - 1], tableY + 25);
      ctx.stroke();

      tableY += 35;

      // Table rows (10.5px, color: #0f172a)
      ctx.font = `10.5px ${fontFamily}`;
      ctx.fillStyle = '#0f172a';

      if (data.items && data.items.length) {
        data.items.forEach(item => {
          tableX = leftX + sectionGap + 10;
          const values = [
            item.code || '',
            item.content || '',
            item.brand || '',
            item.width || '-',
            item.height || '-',
            item.quantity || '-',
            item.unit || '-',
            formatCurrency(parseNumber(item.price)),
            formatCurrency(parseNumber(item.quantity) * parseNumber(item.price))
          ];

          values.forEach((value, i) => {
            ctx.fillText(value, tableX, tableY + 20);
            tableX += colWidths[i];
          });

          // Row separator line
          ctx.strokeStyle = '#d1d5db';
          ctx.beginPath();
          ctx.moveTo(leftX + sectionGap + 10, tableY + 25);
          ctx.lineTo(tableX - colWidths[colWidths.length - 1], tableY + 25);
          ctx.stroke();

          tableY += 25;
        });
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = `italic 10.5px ${fontFamily}`;
        ctx.fillText('Chưa có hạng mục nào', leftX + sectionGap + 10, tableY + 20);
        tableY += 25;
      }

      // Total (font-weight: 800, color: #1d4ed8)
      tableY += 10;
      ctx.fillStyle = '#1d4ed8';
      ctx.font = `800 12px ${fontFamily}`;
      ctx.textAlign = 'right';
      ctx.fillText(`Tổng cộng: ${formatCurrency(data.totalAmount)}`, leftX + leftWidth - sectionGap - 10, tableY + 20);

      // Right side layout
      let rightY = pagePadding + sectionGap;

      // Logo card (background: #f8fafc, border: #cbd5e1) with QCAG logo image
      const logoCardHeight = 80;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(rightX, rightY, rightWidth, logoCardHeight);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(rightX, rightY, rightWidth, logoCardHeight);

      if (qcagLogoImg) {
        try {
          const margin = 10;
          const maxW = rightWidth - margin * 2;
          const maxH = logoCardHeight - margin * 2;
          const aspect = qcagLogoImg.width / (qcagLogoImg.height || 1);
          let drawW = maxW;
          let drawH = Math.round(drawW / aspect);
          if (drawH > maxH) {
            drawH = maxH;
            drawW = Math.round(drawH * aspect);
          }
          const drawX = rightX + Math.round((rightWidth - drawW) / 2);
          const drawY = rightY + Math.round((logoCardHeight - drawH) / 2);
          ctx.drawImage(qcagLogoImg, drawX, drawY, drawW, drawH);
        } catch (e) { /* ignore draw errors */ }
      } else {
        ctx.fillStyle = '#111827';
        ctx.font = `800 13px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText('Logo công ty', rightX + rightWidth / 2, rightY + 35);
      }

      rightY += logoCardHeight + 10;

      // Sale info card
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(rightX, rightY, rightWidth, 120);

      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(rightX, rightY, rightWidth, 120);

      // Sale info title (13px, font-weight: 800, color: #0f172a)
      ctx.fillStyle = '#0f172a';
      ctx.font = `800 13px ${fontFamily}`;
      ctx.textAlign = 'left';
      ctx.fillText('Thông tin Sale', rightX + 10, rightY + 20);

      // Sale info rows (12px, color: #1f2937, space-between layout)
      ctx.fillStyle = '#1f2937';
      ctx.font = `12px ${fontFamily}`;

      const saleInfoRows = [
        { label: 'Loại', value: data.saleType || '---' },
        { label: 'Mã', value: data.saleCode || '---' },
        { label: 'Tên', value: data.saleName || '---' },
        { label: 'SĐT', value: data.salePhone || '---' },
        { label: 'Tên SS', value: data.ssName || '---' }
      ];

      saleInfoRows.forEach((row, i) => {
        const rowY = rightY + 40 + (i * 16);
        
        // Draw dashed line (except last row)
        if (i < saleInfoRows.length - 1) {
          ctx.strokeStyle = '#cbd5e1';
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(rightX + 10, rowY + 12);
          ctx.lineTo(rightX + rightWidth - 10, rowY + 12);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Label (left)
        ctx.textAlign = 'left';
        ctx.fillText(row.label, rightX + 10, rowY + 10);

        // Value (right)
        ctx.textAlign = 'right';
        ctx.fillText(row.value, rightX + rightWidth - 10, rowY + 10);
      });

      rightY += 120 + 10;

      // Sign boxes
      const tagHeight = 28;
      const signGap = 6;
      const remainingHeight = height - pagePadding - rightY;

      if (remainingHeight >= (tagHeight + signGap + 160) * 2 + 10) {
        // Brand footer sign
        if (data.brandFooter) {
          // Tag (background: #334155, color: #f8fafc, 10px, weight: 700)
          ctx.fillStyle = '#334155';
          ctx.fillRect(rightX, rightY, rightWidth, tagHeight);

          ctx.strokeStyle = '#cbd5e1';
          ctx.strokeRect(rightX, rightY, rightWidth, tagHeight);

          ctx.fillStyle = '#f8fafc';
          ctx.font = `700 10px ${fontFamily}`;
          ctx.textAlign = 'center';
          ctx.fillText(data.brandFooter, rightX + rightWidth / 2, rightY + 18);

          rightY += tagHeight + signGap;

          // Sign box (height: 160px, border: 1px dashed #94a3b8, background: #f8fafc)
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(rightX, rightY, rightWidth, 160);

          ctx.strokeStyle = '#94a3b8';
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(rightX, rightY, rightWidth, 160);
          ctx.setLineDash([]);

          // If qcag sign image preloaded, draw it centered inside the sign box
          if (typeof qcagSignImg !== 'undefined' && qcagSignImg) {
            try {
              const margin = 8;
              const maxW = rightWidth - margin * 2;
              const maxH = 160 - margin * 2;
              const imgAspect = qcagSignImg.width / (qcagSignImg.height || 1);
              let drawW = maxW;
              let drawH = Math.round(drawW / imgAspect);
              if (drawH > maxH) {
                drawH = maxH;
                drawW = Math.round(drawH * imgAspect);
              }
              const drawX = rightX + Math.round((rightWidth - drawW) / 2);
              const drawY = rightY + Math.round((160 - drawH) / 2);
              ctx.drawImage(qcagSignImg, drawX, drawY, drawW, drawH);
            } catch (e) { /* ignore drawing failure */ }
          }

          rightY += 160 + 10;
        }

        // Brand approval sign
        if (data.brandApproval && remainingHeight >= (tagHeight + signGap + 160)) {
          // Tag
          ctx.fillStyle = '#334155';
          ctx.fillRect(rightX, rightY, rightWidth, tagHeight);

          ctx.strokeStyle = '#cbd5e1';
          ctx.strokeRect(rightX, rightY, rightWidth, tagHeight);

          ctx.fillStyle = '#f8fafc';
          ctx.font = `700 10px ${fontFamily}`;
          ctx.textAlign = 'center';
          ctx.fillText(data.brandApproval, rightX + rightWidth / 2, rightY + 18);

          rightY += tagHeight + signGap;

          // Sign box
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(rightX, rightY, rightWidth, 160);

          ctx.strokeStyle = '#94a3b8';
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(rightX, rightY, rightWidth, 160);
          ctx.setLineDash([]);
        }
      }

      return canvas.toDataURL('image/jpeg', 0.92);
      } catch (err) {
        console.error('renderPreviewToJpegDataUrlCanvas unexpected error:', err);
        throw err;
      }
    }

    // Legacy function kept for compatibility
    async function renderPreviewToJpegDataUrlLegacy(data, options = {}) {
      const includeQcagSign = options && typeof options === 'object' ? (options.includeQcagSign !== false) : true;
      // Always build a fresh sandbox from the provided data to avoid leaking the last viewed preview
      const target = getOrCreatePreviewExportSandbox();
      target.innerHTML = buildQuotePreviewHtml(data, { includeQcagSign });
      const cleanup = false;

      // Remove QCAG signature image for JPG export when requested (does not change UI)
      if (!includeQcagSign && target) {
        try { Array.from(target.querySelectorAll('img.qcag-sign-img')).forEach(n => n.remove()); } catch (e) { /* ignore */ }
      }

      // Ensure images in the target request CORS and inline SVGs as data URIs so html2canvas can capture them.
      try {
        const bustToken = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const imgs = Array.from(target.querySelectorAll('img'));
        const svgPromises = imgs.map((img) => {
          try {
            if (!img) return Promise.resolve();
            const src = img.getAttribute('src') || img.src || '';
            if (!src) return Promise.resolve();
            if (src.startsWith('data:') || src.startsWith('blob:')) return Promise.resolve();
            // Set CORS hints
            try { img.crossOrigin = 'anonymous'; } catch (e) {}
            try { img.referrerPolicy = 'no-referrer'; } catch (e) {}
            // If SVG, fetch and inline it as a data URI to avoid external rendering issues
            const isSvg = /\.svg(\?|$)/i.test(src);
            if (isSvg) {
              return fetch(src).then(r => r.text()).then((text) => {
                try {
                  const data = 'data:image/svg+xml;utf8,' + encodeURIComponent(text);
                  img.src = data;
                } catch (e) { /* ignore */ }
              }).catch(() => {});
            }
            // For non-SVG images, reload to apply crossorigin
            try { img.removeAttribute('src'); } catch (e) {}
            try { img.src = _appendCacheBust(src, bustToken); } catch (e) {}
            return Promise.resolve();
          } catch (e) { return Promise.resolve(); }
        });
        await Promise.all(svgPromises);
      } catch (e) { /* ignore image preparation errors */ }

      await waitForFontsReady();
      await waitForImagesToLoad(target);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = target.getBoundingClientRect();
      const exportWidth = Math.round(rect.width || 1123);
      const exportHeight = Math.round(rect.height || 794);
      // Create SVG overlay that draws text precisely (keeps layout and images intact), then capture
      let svgOverlayHandle = null;
      try {
        svgOverlayHandle = createSvgTextOverlayForExport(target);
      } catch (err) {
        // If overlay creation fails, continue with default capture
        console.warn('SVG text overlay creation failed:', err);
      }

      // Give browser a moment to lay out the overlay
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const canvas = await window.html2canvas(target, {
        backgroundColor: '#ffffff',
        useCORS: true,
        scale: 2,
        width: exportWidth,
        height: exportHeight,
        windowWidth: exportWidth,
        windowHeight: exportHeight,
        scrollX: 0,
        scrollY: 0,
        letterRendering: true
      });

      // Cleanup overlay and restore DOM text
      if (svgOverlayHandle && typeof svgOverlayHandle.cleanup === 'function') {
        try { await svgOverlayHandle.cleanup(); } catch (e) { /* ignore */ }
      }

      if (cleanup && target && target.parentNode) {
        target.parentNode.removeChild(target);
      } else if (target && target.id === 'quote-preview-export-sandbox') {
        target.innerHTML = '';
      }

      return canvas.toDataURL('image/jpeg', 0.92);
    }

    // exportSelectedQuoteImages removed: functionality intentionally cleared.

    function openQuoteImagesModal() {
      const modal = document.getElementById('quote-images-modal');
      const searchInput = document.getElementById('quote-images-search');
      const fromDateEl = document.getElementById('quote-images-from-date');
      const toDateEl = document.getElementById('quote-images-to-date');
      const createdBtn = document.getElementById('quote-images-date-mode-created');
      const updatedBtn = document.getElementById('quote-images-date-mode-updated');
      if (!modal) return;
      renderQuoteImagesGallery('');
      updateQuoteGallerySelectionUI();
      if (fromDateEl) {
        fromDateEl.value = '';
        fromDateEl.min = '';
        fromDateEl.max = '';
      }
      if (toDateEl) {
        toDateEl.value = '';
        toDateEl.min = '';
        toDateEl.max = '';
      }
      // reflect current mode visually
      if (typeof quoteGalleryDateMode !== 'undefined') {
        try { if (typeof updateDateModeUI === 'function') updateDateModeUI(); } catch (e) { /* ignore */ }
      }
      if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = (e) => { quoteGalleryPage = 1; renderQuoteImagesGallery(e.target.value || ''); };
        setTimeout(() => searchInput.focus(), 50);
      }
      // Reset to first page on open and bind pagination controls
      quoteGalleryPage = 1;
      const prevBtn = document.getElementById('quote-gallery-prev-page');
      const nextBtn = document.getElementById('quote-gallery-next-page');
      if (prevBtn) prevBtn.onclick = () => { quoteGalleryPage = Math.max(1, quoteGalleryPage - 1); const term = searchInput ? (searchInput.value || '') : ''; renderQuoteImagesGallery(term); };
      if (nextBtn) nextBtn.onclick = () => { quoteGalleryPage = quoteGalleryPage + 1; const term = searchInput ? (searchInput.value || '') : ''; renderQuoteImagesGallery(term); };
      const pageSizeEl = document.getElementById('quote-gallery-page-size');
      if (pageSizeEl) {
        pageSizeEl.value = String(quoteGalleryPageSize || 24);
        pageSizeEl.onchange = (e) => { quoteGalleryPageSize = Number(e.target.value) || 24; quoteGalleryPage = 1; const term = searchInput ? (searchInput.value || '') : ''; renderQuoteImagesGallery(term); };
      }
      // Bind select all button
      const selectAllBtn = document.getElementById('quote-images-select-all-btn');
      if (selectAllBtn) {
        selectAllBtn.onclick = () => {
          const grid = document.getElementById('quote-gallery-grid');
          if (!grid) return;
          const cards = grid.querySelectorAll('.quote-gallery-card');
          cards.forEach(card => {
            const id = card.dataset.entryId;
            if (id) selectedQuoteGalleryIds.add(id);
          });
          // Update UI
          updateQuoteGallerySelectionUI();
          // Update card badges
          cards.forEach(card => {
            const badge = card.querySelector('.quote-gallery-select-badge');
            if (badge) badge.textContent = '✓';
            card.classList.add('selected');
          });
        };
      }
      // Bind deselect button (clear all selections)
      const deselectBtn = document.getElementById('quote-images-deselect-btn');
      if (deselectBtn) {
        deselectBtn.addEventListener('click', (ev) => {
          ev && ev.stopPropagation();
          try {
            console.log('quote-images-deselect-btn clicked');
            if (selectedQuoteGalleryIds) selectedQuoteGalleryIds.clear();
            // Update UI: badges, selected class, export buttons
            const grid = document.getElementById('quote-gallery-grid');
            if (grid) {
              const cards = grid.querySelectorAll('.quote-gallery-card');
              cards.forEach(card => {
                card.classList.remove('selected');
                const badge = card.querySelector('.quote-gallery-select-badge');
                if (badge) badge.textContent = '+';
              });
            }
            updateQuoteGallerySelectionUI();
          } catch (e) { console.warn('Failed to clear gallery selection', e); }
        });
      }
      modal.classList.remove('hidden');
      ensureScrollLock();
    }

    function closeQuoteImagesModal() {
      const modal = document.getElementById('quote-images-modal');
      if (!modal) return;
      modal.classList.add('hidden');
      ensureScrollLock();
    }

    function openQuotePreviewModal() {
      renderQuotePreviewPage(buildQuotePreviewData());
      const modal = document.getElementById('quote-preview-modal');
      if (modal) {
        modal.classList.remove('hidden');
        try { modal.style.zIndex = '99999'; } catch (e) {}
        ensureScrollLock();
      }
    }

    function closeQuotePreviewModal() {
      const modal = document.getElementById('quote-preview-modal');
      if (modal) {
        modal.classList.add('hidden');
        try { modal.style.zIndex = ''; } catch (e) {}
        ensureScrollLock();
      }
    }

    // ==== IMAGE VIEWER FUNCTIONS ====
    const IMAGE_VIEWER_MAX_SCALE = 3;

    const imageViewerState = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      minScale: 0.5,
      maxScale: IMAGE_VIEWER_MAX_SCALE,
      isDragging: false,
      initialTranslateX: 0,
      initialTranslateY: 0,
      dragStartX: 0,
      dragStartY: 0
    };

    function isImageViewerActive() {
      const overlay = document.getElementById('image-viewer');
      return !!(overlay && !overlay.classList.contains('hidden'));
    }

    function updateImageViewerTransform() {
      const imgEl = document.getElementById('image-viewer-img');
      if (!imgEl) return;
      imgEl.style.transform = `translate(${imageViewerState.translateX}px, ${imageViewerState.translateY}px) scale(${imageViewerState.scale})`;
    }

    function updateImageViewerButtonsState() {
      const zoomOutBtn = document.getElementById('image-viewer-zoom-out');
      const zoomInBtn = document.getElementById('image-viewer-zoom-in');
      const zoomResetBtn = document.getElementById('image-viewer-zoom-reset');
      const stageEl = document.getElementById('image-viewer-stage');
      const percentLabel = Math.round(imageViewerState.scale * 100);
      if (zoomResetBtn) {
        zoomResetBtn.textContent = `${percentLabel}%`;
        const nearOriginal = Math.abs(imageViewerState.scale - 1) < 0.01 && Math.abs(imageViewerState.translateX) < 1 && Math.abs(imageViewerState.translateY) < 1;
        zoomResetBtn.disabled = nearOriginal;
      }
      if (zoomOutBtn) {
        zoomOutBtn.disabled = imageViewerState.scale <= imageViewerState.minScale + 0.01;
      }
      if (zoomInBtn) {
        zoomInBtn.disabled = imageViewerState.scale >= imageViewerState.maxScale - 0.01;
      }
      if (stageEl) {
        stageEl.classList.toggle('zoomed', imageViewerState.scale > 1.02);
      }
    }

    function updateImageViewerScaleBounds() {
      const overlay = document.getElementById('image-viewer');
      const imgEl = document.getElementById('image-viewer-img');
      const stageEl = document.getElementById('image-viewer-stage');
      if (!imgEl || !stageEl) return;
      if (overlay && overlay.classList.contains('hidden')) return;
      if (!imgEl.complete || !imgEl.naturalWidth || !imgEl.naturalHeight) return;

      const stageRect = stageEl.getBoundingClientRect();
      if (!stageRect.width || !stageRect.height) return;

      const currentScale = imageViewerState.scale || 1;
      const baseWidth = imgEl.getBoundingClientRect().width / currentScale;
      const baseHeight = imgEl.getBoundingClientRect().height / currentScale;
      if (!baseWidth || !baseHeight) return;

      const widthRatio = stageRect.width / baseWidth;
      const heightRatio = stageRect.height / baseHeight;
      const fitScale = Math.max(1, Math.min(widthRatio, heightRatio));
      const targetMax = Math.max(fitScale, IMAGE_VIEWER_MAX_SCALE);

      imageViewerState.maxScale = Math.min(Math.max(imageViewerState.minScale, targetMax), IMAGE_VIEWER_MAX_SCALE);

      if (imageViewerState.scale > imageViewerState.maxScale) {
        setImageViewerScale(imageViewerState.maxScale);
      } else {
        updateImageViewerButtonsState();
      }
    }

    function resetImageViewerTransform() {
      imageViewerState.scale = 1;
      imageViewerState.translateX = 0;
      imageViewerState.translateY = 0;
      imageViewerState.isDragging = false;
      imageViewerState.initialTranslateX = 0;
      imageViewerState.initialTranslateY = 0;
      imageViewerState.dragStartX = 0;
      imageViewerState.dragStartY = 0;
      const stageEl = document.getElementById('image-viewer-stage');
      if (stageEl) {
        stageEl.classList.remove('dragging');
      }
      updateImageViewerTransform();
      updateImageViewerButtonsState();
    }

    function setImageViewerScale(nextScale) {
      const clamped = Math.min(imageViewerState.maxScale, Math.max(imageViewerState.minScale, nextScale));
      if (clamped === imageViewerState.scale) {
        updateImageViewerButtonsState();
        return;
      }
      imageViewerState.scale = clamped;
      if (imageViewerState.scale <= 1) {
        imageViewerState.translateX = 0;
        imageViewerState.translateY = 0;
      }
      updateImageViewerTransform();
      updateImageViewerButtonsState();
    }

    function adjustImageViewerScale(multiplier) {
      if (!isImageViewerActive()) return;
      setImageViewerScale(imageViewerState.scale * multiplier);
    }

    function openImageViewer(src, name) {
      const overlay = document.getElementById('image-viewer');
      const imgEl = document.getElementById('image-viewer-img');
      const nameEl = document.getElementById('image-viewer-filename');
      if (!overlay || !imgEl) return;
      resetImageViewerTransform();
      imgEl.src = src;
      if (nameEl) nameEl.textContent = name || '';
      updateFullscreenButtonLabel();
      overlay.classList.remove('hidden');
      document.documentElement.classList.add('no-scroll');
      document.body.classList.add('no-scroll');
      requestAnimationFrame(() => updateImageViewerScaleBounds());
      updateImageViewerButtonsState();
    }

    function closeImageViewer() {
      const overlay = document.getElementById('image-viewer');
      if (!overlay) return;
      const isFullscreen = document.fullscreenElement === overlay;
      if (isFullscreen && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      overlay.classList.add('hidden');
      document.documentElement.classList.remove('no-scroll');
      document.body.classList.remove('no-scroll');
      resetImageViewerTransform();
      updateFullscreenButtonLabel();
    }

    function handleImageViewerPointerDown(event) {
      const stageEl = document.getElementById('image-viewer-stage');
      if (!stageEl) return;
      if (typeof event.button === 'number' && event.button !== 0) return;
      event.preventDefault();
      if (imageViewerState.scale <= 1) {
        imageViewerState.translateX = 0;
        imageViewerState.translateY = 0;
        updateImageViewerTransform();
        updateImageViewerButtonsState();
        return;
      }
      imageViewerState.isDragging = true;
      imageViewerState.initialTranslateX = imageViewerState.translateX;
      imageViewerState.initialTranslateY = imageViewerState.translateY;
      imageViewerState.dragStartX = event.clientX;
      imageViewerState.dragStartY = event.clientY;
      stageEl.classList.add('dragging');
      try {
        stageEl.setPointerCapture(event.pointerId);
      } catch (err) {
        // Ignore pointer capture errors
      }
    }

    function handleImageViewerPointerMove(event) {
      if (!imageViewerState.isDragging) return;
      event.preventDefault();
      const deltaX = event.clientX - imageViewerState.dragStartX;
      const deltaY = event.clientY - imageViewerState.dragStartY;
      imageViewerState.translateX = imageViewerState.initialTranslateX + deltaX;
      imageViewerState.translateY = imageViewerState.initialTranslateY + deltaY;
      updateImageViewerTransform();
    }

    function handleImageViewerPointerUp(event) {
      if (!imageViewerState.isDragging) return;
      imageViewerState.isDragging = false;
      const stageEl = document.getElementById('image-viewer-stage');
      if (stageEl) {
        stageEl.classList.remove('dragging');
        try {
          stageEl.releasePointerCapture(event.pointerId);
        } catch (err) {
          // Ignore pointer release errors
        }
      }
      updateImageViewerButtonsState();
    }

    function handleImageViewerWheel(event) {
      event.preventDefault();
      if (!isImageViewerActive()) return;
      const direction = event.deltaY > 0 ? -1 : 1;
      const multiplier = direction > 0 ? 1.15 : 0.85;
      setImageViewerScale(imageViewerState.scale * multiplier);
    }

    function toggleImageViewerFullscreen() {
      const overlay = document.getElementById('image-viewer');
      if (!overlay) return;
      const isFullscreen = document.fullscreenElement === overlay;
      if (!isFullscreen && overlay.requestFullscreen) {
        overlay.requestFullscreen().catch(() => {});
      } else if (isFullscreen && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }

    function updateFullscreenButtonLabel() {
      const overlay = document.getElementById('image-viewer');
      const fullscreenBtn = document.getElementById('image-viewer-fullscreen');
      if (!fullscreenBtn) return;
      const isFullscreen = document.fullscreenElement === overlay;
      fullscreenBtn.textContent = isFullscreen ? 'Exit' : 'Full';
      fullscreenBtn.title = isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình';
    }

    document.addEventListener('keydown', (e) => {
      const viewerActive = isImageViewerActive();
      if (!viewerActive) return;
      if (e.key === 'Escape') {
        // Keep Escape scoped to the image viewer so stacked modals (e.g. library) stay open
        e.preventDefault();
        e.stopImmediatePropagation();
        closeImageViewer();
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        adjustImageViewerScale(1.15);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        adjustImageViewerScale(0.85);
      } else if (e.key === '0') {
        e.preventDefault();
        resetImageViewerTransform();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      updateFullscreenButtonLabel();
      if (isImageViewerActive()) {
        requestAnimationFrame(() => updateImageViewerScaleBounds());
      }
    });

    // Ensure every modal has a top-right "X" close button
    document.addEventListener('DOMContentLoaded', () => {
      try { installModalCloseXObserverOnce(); } catch (e) {}
      try { ensureAllModalsHaveCloseX(); } catch (e) {}
    });

    document.addEventListener('DOMContentLoaded', () => {
      const overlay = document.getElementById('image-viewer');
      const closeBtn = document.getElementById('image-viewer-close');
      const zoomInBtn = document.getElementById('image-viewer-zoom-in');
      const zoomOutBtn = document.getElementById('image-viewer-zoom-out');
      const zoomResetBtn = document.getElementById('image-viewer-zoom-reset');
      const fullscreenBtn = document.getElementById('image-viewer-fullscreen');
      const stageEl = document.getElementById('image-viewer-stage');
      const imgEl = document.getElementById('image-viewer-img');
      if (overlay) {
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) closeImageViewer();
        });
      }
      if (closeBtn) closeBtn.addEventListener('click', closeImageViewer);
      if (zoomInBtn) zoomInBtn.addEventListener('click', () => setImageViewerScale(imageViewerState.scale * 1.2));
      if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => setImageViewerScale(imageViewerState.scale * 0.8));
      if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetImageViewerTransform);
      if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleImageViewerFullscreen);
      if (stageEl) {
        stageEl.addEventListener('pointerdown', handleImageViewerPointerDown);
        stageEl.addEventListener('pointermove', handleImageViewerPointerMove);
        stageEl.addEventListener('pointerup', handleImageViewerPointerUp);
        stageEl.addEventListener('pointercancel', handleImageViewerPointerUp);
        stageEl.addEventListener('pointerleave', handleImageViewerPointerUp);
        stageEl.addEventListener('wheel', handleImageViewerWheel, { passive: false });
      }
      if (imgEl) {
        imgEl.addEventListener('load', () => {
          requestAnimationFrame(() => updateImageViewerScaleBounds());
        });
      }
      window.addEventListener('resize', () => {
        if (isImageViewerActive()) {
          requestAnimationFrame(() => updateImageViewerScaleBounds());
        }
      });
      updateImageViewerButtonsState();
      updateFullscreenButtonLabel();
    });

    document.addEventListener('DOMContentLoaded', () => {
      const noCodeBtn = document.getElementById('outlet-code-no-code-btn');
      if (noCodeBtn) {
        noCodeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          setOutletCodePlaceholder();
        });
      }
    });
    // ==== END IMAGE VIEWER FUNCTIONS ====
