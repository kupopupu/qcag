(function loadQcagModules() {
  const modules = [
    'modules/app-core.js',
    'modules/app-pending-orders.js',
    'modules/app-view-mode.js',
    'modules/app-production-modal-core.js',
    'modules/app-production-modal-manage.js',
    'modules/app-production-modal-tabs.js',
    'modules/app-main-core.js',
    'modules/app-main-gallery.js',
    'modules/app-main-utilities.js'
  ];

  const basePath = (() => {
    if (typeof window !== 'undefined' && window.QCAG_SCRIPT_BASE) {
      const customBase = String(window.QCAG_SCRIPT_BASE);
      return customBase.endsWith('/') ? customBase : `${customBase}/`;
    }

    const current = document.currentScript && document.currentScript.src;
    if (current) {
      return current.substring(0, current.lastIndexOf('/') + 1);
    }

    const scripts = Array.from(document.getElementsByTagName('script'));
    const fallbackScript = scripts.reverse().find((script) => {
      const src = script && script.src ? String(script.src) : '';
      return src.includes('/_deploy/js/app.js') || src.includes('_deploy/js/app.js');
    });
    if (fallbackScript && fallbackScript.src) {
      const src = String(fallbackScript.src);
      return src.substring(0, src.lastIndexOf('/') + 1);
    }

    return './_deploy/js/';
  })();

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = basePath + src;
    script.async = false;
    script.defer = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(script);
  });

  const loadSequentially = async () => {
    for (const mod of modules) {
      await loadScript(mod);
    }
  };

  loadSequentially().catch((err) => {
    console.error('[QCAG] Failed to load module scripts:', err);
  });
})();
