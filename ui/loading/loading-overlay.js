/* QCAG Global Loading Overlay
   - Reference counted (supports multiple parallel operations)
   - Overlays everything (max z-index)
   - Wraps fetch calls to API base + wraps dataSdk CRUD/list
*/

(function() {
    const OVERLAY_ID = 'qc-global-loading';

    const getApiBase = () => {
        try {
            const raw = window && window.API_BASE_URL ? String(window.API_BASE_URL) : '';
            return raw.replace(/\/+$/, '');
        } catch (e) {
            return '';
        }
    };

    // Track recent user interactions to avoid showing overlay for background loads
    const userActionState = {
        active: false,
        timeoutId: null,
        graceMs: 3000
    };
    const markUserAction = () => {
        userActionState.active = true;
        if (userActionState.timeoutId) clearTimeout(userActionState.timeoutId);
        userActionState.timeoutId = setTimeout(() => { userActionState.active = false; userActionState.timeoutId = null; }, userActionState.graceMs);
    };
    // Listen for primary user events
    ['click', 'keydown', 'pointerdown', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, () => markUserAction(), { passive: true });
    });

    const isStaticResource = (urlObj) => {
        try {
            const p = (urlObj.pathname || '').toLowerCase();
            return p.endsWith('.js') || p.endsWith('.css') || p.endsWith('.svg') || p.endsWith('.woff') || p.endsWith('.woff2');
        } catch (e) { return false; }
    };

    const isCdnHost = (urlObj) => {
        try {
            const host = (urlObj.hostname || '').toLowerCase();
            return host.includes('cdnjs.') || host.includes('cdn.jsdelivr.') || host.includes('unpkg.') || host.includes('tailwind') || host.includes('bootstrapcdn');
        } catch (e) { return false; }
    };

    const isSseOrWs = (urlObj) => {
        try {
            const p = (urlObj.pathname || '').toLowerCase();
            return p.startsWith('/events') || p.includes('/events') || p.startsWith('/ws') || p.includes('/ws');
        } catch (e) { return false; }
    };

    const businessApiMatch = (urlObj) => {
        try {
            const p = (urlObj.pathname || '').toLowerCase();
            // Business endpoints that should show overlay
            if (p.includes('/quotations')) return true;
            if (p.includes('/orders')) return true;
            if (p.includes('/export')) return true;
            if (p.includes('/save')) return true;
            return false;
        } catch (e) { return false; }
    };

    const state = {
        counter: 0,
        tokens: new Set(),
        lastMessage: 'Đang xử lý...'
    };

    const ensureOverlay = () => {
        let el = document.getElementById(OVERLAY_ID);
        if (el) return el;

        el = document.createElement('div');
        el.id = OVERLAY_ID;
        el.setAttribute('aria-live', 'polite');
        el.innerHTML = `
      <div class="qc-loading-card">
        <div class="qc-loading-row">
          <div class="qc-spinner" aria-hidden="true">
            <div class="qc-orbit">
              <div class="qc-dot"></div>
              <div class="qc-dot d2"></div>
            </div>
          </div>
          <div>
            <div id="qc-loading-title" class="qc-loading-title">Đang xử lý...</div>
            <div class="qc-loading-sub">Vui lòng đợi trong giây lát</div>
          </div>
        </div>
      </div>
    `;

        // Prevent click-through.
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
        }, true);

        document.body.appendChild(el);
        return el;
    };

    const setMessage = (message) => {
        const msg = String(message || '').trim() || 'Đang xử lý...';
        state.lastMessage = msg;
        const el = document.getElementById('qc-loading-title');
        if (el) el.textContent = msg;
    };

    const show = (message) => {
        try {
            ensureOverlay();
            if (message) setMessage(message);
            const token = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
            state.tokens.add(token);
            state.counter = state.tokens.size;
            const overlay = ensureOverlay();
            overlay.classList.add('qc-show');
            return token;
        } catch (e) {
            return null;
        }
    };

    const hide = (token) => {
        try {
            if (token && state.tokens.has(token)) {
                state.tokens.delete(token);
            } else if (!token) {
                // allow hide() without token as a "pop"
                // (best-effort)
                const first = state.tokens.values().next().value;
                if (first) state.tokens.delete(first);
            }
            state.counter = state.tokens.size;
            const overlay = document.getElementById(OVERLAY_ID);
            if (!overlay) return;
            if (state.counter <= 0) {
                overlay.classList.remove('qc-show');
                setMessage(state.lastMessage);
            }
        } catch (e) {
            // ignore
        }
    };

    const wrapPromise = (promise, message) => {
        const token = show(message);
        return Promise.resolve(promise)
            .then((res) => {
                hide(token);
                return res;
            })
            .catch((err) => {
                hide(token);
                throw err;
            });
    };

    const wrapMethod = (obj, name, label) => {
        try {
            if (!obj || typeof obj[name] !== 'function') return;
            if (obj[name]._qcWrapped) return;
            const original = obj[name];
            const wrapped = function(...args) {
                return wrapPromise(original.apply(this, args), label);
            };
            wrapped._qcWrapped = true;
            obj[name] = wrapped;
        } catch (e) {
            // ignore
        }
    };

    const patchFetch = () => {
        try {
            if (!window.fetch || window.fetch._qcWrapped) return;
            const orig = window.fetch;
            const wrapped = function(input, init) {
                let rawUrl = '';
                try {
                    rawUrl = typeof input === 'string' ? input : (input && input.url ? String(input.url) : '');
                } catch (e) { rawUrl = ''; }

                // Resolve relative URLs
                let urlObj;
                try {
                    urlObj = new URL(rawUrl, window.location.href);
                } catch (e) {
                    urlObj = { href: String(rawUrl || ''), hostname: '', pathname: String(rawUrl || '') };
                }

                // Absolute exclusions: file://, static resources, cdn hosts, SSE/WS endpoints
                if ((urlObj.protocol && urlObj.protocol === 'file:') || isStaticResource(urlObj) || isCdnHost(urlObj) || isSseOrWs(urlObj)) {
                    return orig.apply(this, arguments);
                }

                // Only intercept narrowly-defined business APIs
                const base = getApiBase();
                const isSameBase = base && urlObj.href && String(urlObj.href).startsWith(base);
                // Determine if this is a business API path
                const isBusiness = businessApiMatch(urlObj);

                // Special-case /auth: only show overlay when user initiated action
                const isAuth = (urlObj.pathname || '').toLowerCase().includes('/auth');

                // Only handle known business APIs; skip others
                if (!isBusiness && !isAuth) {
                    return orig.apply(this, arguments);
                }

                // Require recent user interaction for business APIs and auth flows
                if (!userActionState.active) {
                    return orig.apply(this, arguments);
                }

                return wrapPromise(orig.apply(this, arguments), 'Đang tải dữ liệu...');
            };
            wrapped._qcWrapped = true;
            window.fetch = wrapped;
        } catch (e) {
            // ignore
        }
    };

    const patchDataSdk = () => {
        try {
            const sdk = window.dataSdk;
            if (!sdk) return;
            wrapMethod(sdk, 'init', 'Đang khởi tạo...');
            wrapMethod(sdk, 'list', 'Đang tải dữ liệu...');
            wrapMethod(sdk, 'create', 'Đang lưu...');
            wrapMethod(sdk, 'update', 'Đang lưu...');
            wrapMethod(sdk, 'delete', 'Đang xử lý...');
        } catch (e) {
            // ignore
        }
    };

    const install = () => {
        // expose API
        window.QcLoading = window.QcLoading || {};
        window.QcLoading.show = show;
        window.QcLoading.hide = hide;
        window.QcLoading.setMessage = setMessage;
        window.QcLoading.wrap = wrapPromise;

        // Patch mechanisms
        patchFetch();
        patchDataSdk();

        // Re-patch later in case SDK arrives after this script
        document.addEventListener('DOMContentLoaded', () => {
            try { ensureOverlay(); } catch (e) {}
            patchFetch();
            patchDataSdk();
            // if SDK gets replaced later, keep patching on first user interaction
            document.addEventListener('click', () => patchDataSdk(), { once: true });
        });
    };

    install();
})();