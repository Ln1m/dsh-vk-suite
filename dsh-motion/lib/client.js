window.__ModuleLoader__.load({
  id: 'dsh-motion',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const EASE = 'cubic-bezier(.4,0,.2,1)';
    const EXIT_MS = 180;

    const FRAME = 'body div:has(> [class$="_sidebarCol"]):has(> [class$="_centerCol"])';
    const PANEL = 'body [data-shortcut-modal="settings"]';
    const OVERLAY = 'body > div:has(> [data-shortcut-modal="settings"])';

    const CSS = `
html:not([data-dsh-motion-resizing]) ${FRAME}{
  transition:grid-template-columns var(--ds-transition-duration-slow,.3s) var(--ds-ease-in-out,${EASE});
}
${FRAME}[data-dragging]{transition:none!important}
${OVERLAY}{transition:opacity .18s var(--ds-ease-in-out,${EASE})}
${PANEL}{transition:opacity .18s var(--ds-ease-in-out,${EASE}),transform .18s var(--ds-ease-in-out,${EASE})}
@starting-style{
  ${OVERLAY}{opacity:0}
  ${PANEL}{opacity:0;transform:scale(.97)}
}
body > div.dsh-motion-leaving{opacity:0}
${PANEL}.dsh-motion-leaving{opacity:0;transform:scale(.97)}
@media (prefers-reduced-motion:reduce){
  html ${FRAME},${OVERLAY},${PANEL}{transition:none!important}
}
`;

    function insertStyles(css) {
      try {
        const style = document.createElement('style');
        style.textContent = css;
        style.dataset.dshMotion = '1';
        document.head.appendChild(style);
        return () => { try { style.remove(); } catch { /* ignore */ } };
      } catch {
        return () => {};
      }
    }

    function installResizeGuard() {
      let timer = null;
      const root = document.documentElement;
      window.addEventListener('resize', () => {
        root.setAttribute('data-dsh-motion-resizing', '');
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => root.removeAttribute('data-dsh-motion-resizing'), 220);
      }, true);
    }

    function installSettingsExit() {
      let bypass = false;
      let busy = false;
      const panel = () => document.querySelector('[data-shortcut-modal="settings"]');

      const closeTarget = (node) => {
        if (!(node instanceof Element)) return null;
        const p = panel();
        if (p === null) return null;
        if (!p.contains(node)) return node;
        const button = node.closest('button');
        if (button === null || !p.contains(button)) return null;
        const label = (button.textContent || '').trim();
        const aria = button.getAttribute('aria-label');
        return label === '关闭' || label === 'Close' || aria === '关闭' || aria === 'Close' ? button : null;
      };

      const forceClose = (overlay) => {
        if (panel() === null || overlay === null) return;
        const mask = overlay.firstElementChild;
        if (mask === null) return;
        bypass = true;
        try { mask.click(); } catch { /* ignore */ }
        setTimeout(() => { bypass = false; }, 0);
      };

      const playExit = (replay) => {
        const p = panel();
        if (p === null) { replay(); return; }
        const overlay = p.parentElement;
        busy = true;
        p.classList.add('dsh-motion-leaving');
        if (overlay !== null) overlay.classList.add('dsh-motion-leaving');
        setTimeout(() => {
          try { p.classList.remove('dsh-motion-leaving'); } catch { /* ignore */ }
          if (overlay !== null) { try { overlay.classList.remove('dsh-motion-leaving'); } catch { /* ignore */ } }
          busy = false;
          bypass = true;
          try { replay(); } catch { /* ignore */ }
          setTimeout(() => { bypass = false; }, 0);
          setTimeout(() => { forceClose(overlay); }, 420);
        }, EXIT_MS);
      };

      document.addEventListener('click', (event) => {
        if (bypass || busy) return;
        const action = closeTarget(event.target);
        if (action === null) return;
        event.stopPropagation();
        event.preventDefault();
        playExit(() => {
          try { action.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); } catch { /* ignore */ }
        });
      }, true);

      document.addEventListener('keydown', (event) => {
        if (bypass || busy || event.key !== 'Escape') return;
        if (panel() === null) return;
        event.stopPropagation();
        event.preventDefault();
        playExit(() => {
          try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch { /* ignore */ }
        });
      }, true);
    }

    function apply() {
      insertStyles(CSS);
      installResizeGuard();
      installSettingsExit();
    }

    const inject = [];

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
