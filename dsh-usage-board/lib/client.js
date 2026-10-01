// dsh-usage-board — 设置页「扩展」栏目的用量看板（client 半端）。
// 只读：主数据来自 dsh-wallet 的只读路由 /wallet/api/board，余额/本会话/官方校准各取一条既有路由。
// 本插件不重新聚合、不重新计价——金额口径与左栏钱包面板同源（同一份 perDay 聚合）。
window.__ModuleLoader__.load({
  id: 'dsh-usage-board',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const react = require('react');
    const contract = require('dsh-vk-contract');
    const h = react.createElement;
    const VK = contract.VK;
    const vkCard = contract.vkCard;

    const BOARD_URL = '/wallet/api/board';
    const BALANCE_URL = '/wallet/api/balance';
    const USAGE_URL = '/wallet/api/usage';
    const COST_URL = '/wallet/api/cost';
    const THRESHOLD_URL = '/wallet/api/set-threshold';
    const RECHARGE_URL = 'https://platform.deepseek.com/top_up';
    const KEYS_URL = 'https://platform.deepseek.com/api_keys';
    const DETAIL_URL = 'https://platform.deepseek.com/usage';
    const LS_WIN = 'ub.win';
    const LS_METRIC = 'ub.metric';
    const LS_VIEW = 'ub.view';
    const BOARD_POLL_MS = 60000;
    const COST_POLL_MS = 5000;
    const BALANCE_POLL_MS = 30000;
    const OFFICIAL_POLL_MS = 300000;

    /* ── 图标：内联 SVG，stroke=currentColor ── */
    const ICON = {
      refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
      grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      bars: '<path d="M5 21V10M12 21V4M19 21v-7"/>',
      open: '<path d="M14 4h6v6"/><path d="M20 4 10.5 13.5"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
      key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8 2 2-2 2 2 2-2 2-2-2-1.6 1.6"/>',
      wallet: '<path d="M21 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M3 9h18"/><circle cx="17" cy="13.5" r="1.3"/>',
      warn: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
    };

    function Icon(props) {
      const d = ICON[props.name];
      if (!d) return null;
      return h('svg', {
        viewBox: '0 0 24 24', width: props.size === undefined ? 14 : props.size, height: props.size === undefined ? 14 : props.size,
        fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true', style: { display: 'block', flex: 'none' },
        dangerouslySetInnerHTML: { __html: d }
      });
    }

    function IconBtn(props) {
      return h('button', {
        type: 'button',
        className: 'ub_iconBtn' + (props.open === true ? ' ub_iconBtnOn' : '') + (props.danger === true ? ' ub_iconBtnDanger' : ''),
        title: props.title, 'aria-label': props.title, disabled: props.disabled === true,
        onClick: props.onClick
      }, h(Icon, { name: props.name, size: props.size === undefined ? 14 : props.size }));
    }

    function Seg(props) {
      const items = props.options || [];
      return h('span', { className: 'ub_seg' }, items.map((o) => h('button', {
        key: o.v, type: 'button', title: o.title || o.label,
        className: 'ub_segBtn' + (String(props.value) === String(o.v) ? ' ub_segOn' : ''),
        onClick: () => props.onChange(o.v)
      }, o.icon ? h(Icon, { name: o.icon, size: 13 }) : o.label)));
    }

    const CSS = `
body{--vk-accent:var(--dsw-alias-accent,var(--dsw-alias-state-business-primary));--vk-accent-ring:color-mix(in srgb,var(--vk-accent) 22%,transparent);--vk-accent-soft:color-mix(in srgb,var(--vk-accent) 12%,transparent);--vk-ok:#73c991;--vk-danger:var(--dsw-alias-state-error-primary,#f14c4c);--vk-danger-soft:color-mix(in srgb,var(--vk-danger) 35%,transparent);--vk-fg:var(--dsw-alias-label-primary);--vk-fg2:var(--dsw-alias-label-secondary);--vk-fg3:var(--dsw-alias-label-tertiary);--vk-line:var(--dsw-alias-border-l1);--vk-line2:var(--dsw-alias-border-l2);--vk-bg-hover:var(--dsw-alias-interactive-bg-hover);--vk-r-xs:4px;--vk-r-sm:6px;--vk-r-md:8px;--vk-r-lg:12px;--vk-r-pill:999px;--vk-fs-xs:11px;--vk-fs-sm:12px;--vk-fs-md:13px;--vk-fs-lg:14px;--vk-dur:.12s;--vk-ease:cubic-bezier(.2,.7,.3,1);--vk-fade:background-color var(--vk-dur) var(--vk-ease),color var(--vk-dur) var(--vk-ease),border-color var(--vk-dur) var(--vk-ease),opacity var(--vk-dur) var(--vk-ease);--vk-ring:0 0 0 2px var(--vk-accent-ring);}
.ub_root{box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:14px;padding:16px;color:var(--vk-fg);font-size:var(--vk-fs-md);font-variant-numeric:tabular-nums;}
.ub_tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:8px;}
.ub_tile{border:1px solid var(--vk-line);border-radius:var(--vk-r-md);padding:8px 10px;background:var(--dsw-specific-input-fill,var(--dsw-specific-sidebar-fill));display:flex;flex-direction:column;gap:2px;min-width:0;}
.ub_tileLabel{font-size:var(--vk-fs-xs);color:var(--vk-fg2);display:flex;align-items:center;gap:5px;}
.ub_tileValue{font-size:18px;font-weight:600;color:var(--vk-fg);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ub_tileValueWarn{color:var(--dsw-alias-state-warn-primary);}
.ub_tileSub{font-size:10px;color:var(--vk-fg3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ub_bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ub_gap{flex:1;min-width:0;}
.ub_seg{display:inline-flex;border:1px solid var(--vk-line);border-radius:var(--vk-r-sm);overflow:hidden;flex:none;}
.ub_segBtn{appearance:none;border:none;background:transparent;color:var(--vk-fg2);font-family:inherit;font-size:var(--vk-fs-xs);line-height:16px;padding:2px 8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:var(--vk-fade);}
.ub_segBtn+.ub_segBtn{border-left:1px solid var(--vk-line);}
.ub_segBtn:hover{color:var(--vk-fg);background:var(--vk-bg-hover);}
.ub_segOn{background:var(--vk-accent-soft);color:var(--vk-fg);}
.ub_iconBtn{appearance:none;flex:none;width:26px;height:26px;border:1px solid var(--vk-line);background:transparent;color:var(--vk-fg2);border-radius:var(--vk-r-sm);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:var(--vk-fade);}
.ub_iconBtn:hover{color:var(--vk-fg);border-color:var(--vk-line2);}
.ub_iconBtn:disabled{opacity:.45;cursor:default;}
.ub_iconBtnOn{color:var(--vk-accent);border-color:color-mix(in srgb,var(--vk-accent) 35%,transparent);}
.ub_iconBtnDanger{color:var(--vk-danger);border-color:var(--vk-danger-soft);}
.ub_section{border:1px solid var(--vk-line);border-radius:var(--vk-r-md);padding:10px 12px;background:var(--dsw-specific-input-fill,var(--dsw-specific-sidebar-fill));display:flex;flex-direction:column;gap:9px;min-width:0;}
.ub_head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ub_title{font-size:var(--vk-fs-xs);color:var(--vk-fg2);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ub_heatRow{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;}
.ub_heatWrap{display:flex;gap:8px;align-items:flex-start;flex:none;}
.ub_heatWd{display:grid;grid-template-rows:repeat(7,20px);gap:4px;padding-top:14px;}
.ub_wd{width:12px;font-size:9px;line-height:20px;height:20px;color:var(--vk-fg3);text-align:right;}
.ub_heatBox{display:flex;flex-direction:column;gap:4px;}
.ub_months{display:flex;gap:4px;height:10px;}
.ub_month{width:20px;font-size:9px;line-height:10px;color:var(--vk-fg3);white-space:nowrap;overflow:visible;}
.ub_cols{display:flex;gap:4px;}
.ub_heatCol{display:grid;grid-template-rows:repeat(7,20px);gap:4px;flex:none;}
.ub_cell{width:20px;height:20px;border:none;padding:0;border-radius:4px;cursor:pointer;display:block;transition:box-shadow var(--vk-dur) var(--vk-ease),filter var(--vk-dur) var(--vk-ease);}
.ub_cell:hover{filter:brightness(1.2);}
.ub_cellBlank{width:20px;height:20px;}
.ub_cellOn{box-shadow:0 0 0 2px var(--vk-accent-ring),0 0 0 1px var(--vk-accent);}
.ub_cellToday{box-shadow:inset 0 0 0 1.5px var(--vk-fg2);}
.ub_cellOn.ub_cellToday{box-shadow:inset 0 0 0 1.5px var(--vk-fg2),0 0 0 2px var(--vk-accent-ring),0 0 0 3px var(--vk-accent);}
.ub_dtl{flex:1;min-width:260px;display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:4px 18px;align-content:start;}
.ub_dtlRow{display:flex;align-items:baseline;gap:8px;font-size:var(--vk-fs-xs);}
.ub_dtlKey{color:var(--vk-fg3);flex:none;}
.ub_dtlVal{color:var(--vk-fg);font-weight:600;flex:1;text-align:right;font-variant-numeric:tabular-nums;}
.ub_bars{display:flex;align-items:flex-end;gap:2px;height:84px;flex:1;min-width:240px;}
.ub_barCol{flex:1;min-width:2px;display:flex;flex-direction:column;justify-content:flex-end;height:100%;cursor:pointer;}
.ub_barFill{border-radius:2px 2px 0 0;min-height:1px;transition:opacity var(--vk-dur) var(--vk-ease);}
.ub_barCol:hover .ub_barFill{opacity:.75;}
.ub_detail{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:var(--vk-fs-xs);color:var(--vk-fg2);}
.ub_detail b{font-weight:600;color:var(--vk-fg);}
.ub_hm{display:grid;grid-template-columns:12px repeat(24,minmax(0,1fr));gap:3px;align-items:center;}
.ub_hmLabel{font-size:9px;color:var(--vk-fg3);text-align:right;}
.ub_hmCell{height:20px;border-radius:3px;}
.ub_hmTick{font-size:9px;color:var(--vk-fg3);}
.ub_stack{display:flex;height:10px;border-radius:var(--vk-r-pill);overflow:hidden;background:var(--vk-line);}
.ub_stackSeg{height:100%;min-width:0;}
.ub_legend{display:flex;flex-wrap:wrap;gap:5px 14px;font-size:var(--vk-fs-xs);color:var(--vk-fg2);}
.ub_legendItem{display:inline-flex;align-items:center;gap:5px;}
.ub_sw{width:9px;height:9px;border-radius:2px;flex:none;}
.ub_rows{display:flex;flex-direction:column;gap:6px;}
.ub_row{display:flex;align-items:center;gap:8px;font-size:var(--vk-fs-sm);min-width:0;flex-wrap:wrap;}
.ub_rowIdx{width:14px;color:var(--vk-fg3);font-size:10px;flex:none;}
.ub_rowName{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--vk-fg);}
.ub_rowMeta{flex:none;font-size:var(--vk-fs-xs);color:var(--vk-fg3);}
.ub_rowNum{flex:none;font-weight:600;color:var(--vk-fg);}
.ub_big{flex:none;font-size:16px;font-weight:600;color:var(--vk-fg);}
.ub_empty{font-size:var(--vk-fs-sm);color:var(--vk-fg2);padding:14px 0;text-align:center;}
.ub_err{font-size:var(--vk-fs-xs);color:var(--vk-danger);word-break:break-all;}
.ub_pill{display:inline-flex;align-items:center;gap:4px;padding:0 6px;border-radius:var(--vk-r-pill);font-size:10px;line-height:16px;border:1px solid var(--vk-line);color:var(--vk-fg2);flex:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ub_pillPeak{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 35%,transparent);}
.ub_pillOff{color:var(--vk-ok);border-color:color-mix(in srgb,var(--vk-ok) 35%,transparent);}
.ub_input{width:8ch;background:transparent;border:none;border-bottom:1px solid var(--vk-line2);color:var(--vk-fg);border-radius:0;padding:1px 3px;font-size:var(--vk-fs-sm);font-family:inherit;text-align:center;font-variant-numeric:tabular-nums;box-sizing:border-box;-moz-appearance:textfield;appearance:textfield;}
.ub_input::-webkit-outer-spin-button,.ub_input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.ub_input:focus{outline:none;border-bottom-color:var(--vk-accent);}
.ub_inline{display:inline-flex;align-items:center;gap:6px;font-size:var(--vk-fs-xs);color:var(--vk-fg2);}
.ub_warnRow{display:inline-flex;align-items:center;gap:5px;font-size:var(--vk-fs-xs);color:var(--dsw-alias-state-warn-primary);}
`;

    (function injectCss() {
      if (typeof document === 'undefined') return;
      const plugin = 'dsh-usage-board';
      try {
        for (const old of document.querySelectorAll('style[data-plugin="' + plugin + '"]')) { try { old.remove(); } catch { /* ignore */ } }
        const tag = document.createElement('style');
        tag.dataset.plugin = plugin;
        tag.textContent = CSS;
        document.head.appendChild(tag);
      } catch { /* ignore */ }
    })();

    /* ── 纯函数：格式化 / 分档 / 布局（离线校验直接调用这些）── */
    // 蓝色 5 档（第 0 档 = 无数据）。深色底用半透明蓝叠层，浅色底用不透明蓝阶。
    const RAMP = {
      dark: ['rgba(110,118,129,.16)', 'rgba(56,139,253,.30)', 'rgba(56,139,253,.52)', 'rgba(56,139,253,.74)', 'rgba(88,166,255,.92)', 'rgba(137,203,255,1)'],
      light: ['#ebedf0', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#2563eb']
    };

    const TONE = { input: 'var(--vk-accent)', cacheRead: '#73c991', output: 'var(--dsw-alias-state-warn-primary)', cacheWrite: 'var(--vk-fg3)' };

    function fmtMoney(v) {
      const n = Number(v);
      if (!Number.isFinite(n)) return '--';
      return '¥' + n.toFixed(2);
    }

    function fmtInt(v) {
      const n = Number(v) || 0;
      return n.toLocaleString();
    }

    function fmtTokens(v) {
      const n = Number(v) || 0;
      if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
      if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return String(Math.round(n));
    }

    function totalTokens(row) {
      return (row.uncachedInputTokens || 0) + (row.outputTokens || 0) + (row.cacheReadTokens || 0) + (row.cacheWriteTokens || 0);
    }

    function dayValue(row, metric) {
      if (!row) return 0;
      if (metric === 'token') return totalTokens(row);
      if (metric === 'req') return row.requests || 0;
      return row.cost || 0;
    }

    function fmtBy(v, metric) {
      if (metric === 'token') return fmtTokens(v);
      if (metric === 'req') return fmtInt(v);
      return fmtMoney(v);
    }

    /** 四档分位阈值：保证看板在长尾分布下也有色阶差异（线性分档会让绝大多数格子挤在第 1 档）。 */
    function thresholdsOf(values) {
      const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
      if (v.length === 0) return [];
      const at = (p) => v[Math.min(v.length - 1, Math.max(0, Math.floor(p * (v.length - 1))))];
      return [at(0.2), at(0.4), at(0.6), at(0.85)];
    }

    function levelOf(v, thresholds) {
      if (!(Number(v) > 0)) return 0;
      let lv = 1;
      for (const t of thresholds) if (Number(v) > t) lv += 1;
      return Math.min(5, lv);
    }

    /** 周一为 0 的星期序号（与宿主 hours 槽位口径一致）。 */
    function weekdayMon0(dayKey) {
      const p = String(dayKey).split('-').map(Number);
      if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return 0;
      return (new Date(p[0], p[1] - 1, p[2]).getDay() + 6) % 7;
    }

    const WD = ['一', '二', '三', '四', '五', '六', '日'];

    /** 日序列 → 周列（每列 7 格，周一在顶），GitHub 式纯方格热力图用。 */
    function dayColumns(dayRows) {
      const cols = [];
      let cur = new Array(7).fill(null);
      let idx = dayRows.length > 0 ? weekdayMon0(dayRows[0].date) : 0;
      for (const row of dayRows) {
        cur[idx] = row;
        idx += 1;
        if (idx === 7) { cols.push(cur); cur = new Array(7).fill(null); idx = 0; }
      }
      if (idx !== 0 || cols.length === 0) cols.push(cur);
      return cols;
    }

    /** 每列顶部的月份标签：该列首格换月时给一个标签，其余列为空。 */
    function monthLabels(cols) {
      return cols.map((col, i) => {
        const first = col.find((c) => c !== null);
        if (!first) return '';
        const m = Number(first.date.slice(5, 7));
        if (i === 0) return m + '月';
        const prev = cols[i - 1].find((c) => c !== null);
        return prev && Number(prev.date.slice(5, 7)) !== m ? m + '月' : '';
      });
    }

    function hourLabel(slot) {
      const wd = Math.floor(slot / 24);
      const hour = slot % 24;
      const pad = (n) => String(n).padStart(2, '0');
      return '周' + WD[wd] + ' ' + pad(hour) + ':00-' + pad((hour + 1) % 24) + ':00';
    }

    function themeOf(ctx) {
      try {
        if (ctx && ctx.theme && typeof ctx.theme.getTheme === 'function') {
          const snap = ctx.theme.getTheme();
          const scheme = snap && snap.active && snap.active.colorScheme;
          if (scheme === 'dark' || scheme === 'light') return scheme;
        }
      } catch { /* ignore */ }
      try {
        if (typeof document !== 'undefined' && document.body && document.body.hasAttribute('data-ds-dark-theme')) return 'dark';
      } catch { /* ignore */ }
      return 'dark';
    }

    function readLs(key, fallback) {
      try {
        const v = window.localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch {
        return fallback;
      }
    }

    function writeLs(key, value) {
      try { window.localStorage.setItem(key, String(value)); } catch { /* ignore */ }
    }

    function sumOfficial(official) {
      if (!Array.isArray(official)) return null;
      let sum = 0;
      let n = 0;
      for (const d of official) { sum += Number(d && d.cost) || 0; n += 1; }
      return n === 0 ? null : Math.round(sum * 10000) / 10000;
    }

    /* ── 展示组件（全部纯函数，无 hooks，可离线渲染）── */
    function Tile(props) {
      return h('div', { className: 'ub_tile' },
        h('div', { className: 'ub_tileLabel' }, props.icon ? h(Icon, { name: props.icon, size: 12 }) : null, h('span', null, props.label)),
        h('div', { className: 'ub_tileValue' + (props.warn === true ? ' ub_tileValueWarn' : '') }, props.value),
        h('div', { className: 'ub_tileSub' }, props.sub)
      );
    }

    function DetailStrip(props) {
      const row = props.row;
      if (!row) return h('div', { className: 'ub_dtl' }, h('div', { className: 'ub_dtlRow' }, h('span', { className: 'ub_dtlVal' }, '无数据')));
      const items = [
        ['日期', row.date.slice(5) + ' 周' + WD[weekdayMon0(row.date)]],
        ['合计', fmtMoney(row.cost)],
        ['输入', fmtTokens(row.uncachedInputTokens)],
        ['缓存', fmtTokens(row.cacheReadTokens)],
        ['输出', fmtTokens(row.outputTokens)],
        ['请求', fmtInt(row.requests) + ' 次'],
        ['高峰', fmtMoney(row.peakCost)],
        ['空闲', fmtMoney(row.offPeakCost)]
      ];
      if (Number(row.cacheWriteTokens) > 0) items.splice(5, 0, ['写缓存', fmtTokens(row.cacheWriteTokens)]);
      return h('div', { className: 'ub_dtl' }, items.map((it) => h('div', { key: it[0], className: 'ub_dtlRow' },
        h('span', { className: 'ub_dtlKey' }, it[0]),
        h('span', { className: 'ub_dtlVal' }, it[1])
      )));
    }

    function DayGrid(props) {
      const rows = props.rows || [];
      const ramp = props.ramp;
      const metric = props.metric;
      const thresholds = thresholdsOf(rows.map((r) => dayValue(r, metric)));
      const cols = dayColumns(rows);
      const months = monthLabels(cols);
      const todayKey = rows.length > 0 ? rows[rows.length - 1].date : '';
      return h('div', { className: 'ub_heatWrap' },
        h('div', { className: 'ub_heatWd' }, WD.map((w, i) => h('div', { key: 'w' + i, className: 'ub_wd' }, i % 2 === 0 ? w : ''))),
        h('div', { className: 'ub_heatBox' },
          h('div', { className: 'ub_months' }, cols.map((_, i) => h('div', { key: 'm' + i, className: 'ub_month' }, months[i]))),
          h('div', { className: 'ub_cols' }, cols.map((col, ci) => h('div', { key: 'c' + ci, className: 'ub_heatCol' },
            col.map((row, ri) => {
              if (row === null) return h('div', { key: 'b' + ri, className: 'ub_cellBlank' });
              const lv = levelOf(dayValue(row, metric), thresholds);
              const on = props.picked === row.date;
              return h('button', {
                key: ri, type: 'button',
                className: 'ub_cell' + (on ? ' ub_cellOn' : '') + (row.date === todayKey ? ' ub_cellToday' : ''),
                style: { background: ramp[lv] },
                title: row.date.slice(5) + ' · ' + fmtMoney(row.cost) + ' · ' + fmtTokens(totalTokens(row)) + ' tok · ' + fmtInt(row.requests) + ' 次',
                onMouseEnter: () => props.onHover(row.date),
                onMouseLeave: () => props.onHover(null),
                onClick: () => props.onPick(on ? null : row.date)
              });
            })
          )))
        )
      );
    }

    function DayBars(props) {
      const rows = props.rows || [];
      const ramp = props.ramp;
      const thresholds = thresholdsOf(rows.map((r) => dayValue(r, props.metric)));
      const max = rows.reduce((m, r) => Math.max(m, dayValue(r, props.metric)), 0) || 1;
      return h('div', { className: 'ub_bars' }, rows.map((row) => {
        const v = dayValue(row, props.metric);
        const lv = levelOf(v, thresholds);
        const pct = Math.max(v > 0 ? 2 : 0, Math.round((v / max) * 100));
        const on = props.picked === row.date;
        return h('div', {
          key: row.date, className: 'ub_barCol',
          title: row.date.slice(5) + ' · ' + fmtMoney(row.cost) + ' · ' + fmtInt(row.requests) + ' 次',
          onMouseEnter: () => props.onHover(row.date),
          onMouseLeave: () => props.onHover(null),
          onClick: () => props.onPick(on ? null : row.date)
        }, h('div', {
          className: 'ub_barFill',
          style: { height: pct + '%', background: ramp[lv === 0 ? 1 : lv], opacity: on ? 1 : (props.picked === null ? .92 : .5) }
        }));
      }));
    }

    function HourGrid(props) {
      const hours = props.hours || [];
      const ramp = props.ramp;
      const valueOf = (cell) => (props.metric === 'token' ? (cell.tokens || 0) : props.metric === 'req' ? (cell.requests || 0) : (cell.cost || 0));
      const thresholds = thresholdsOf(hours.map(valueOf));
      const items = [];
      for (let wd = 0; wd < 7; wd += 1) {
        items.push(h('div', { key: 'l' + wd, className: 'ub_hmLabel' }, WD[wd]));
        for (let hr = 0; hr < 24; hr += 1) {
          const slot = wd * 24 + hr;
          const cell = hours[slot] || { cost: 0, tokens: 0, requests: 0 };
          items.push(h('div', {
            key: 'c' + slot, className: 'ub_hmCell', style: { background: ramp[levelOf(valueOf(cell), thresholds)] },
            title: hourLabel(slot) + ' · ' + fmtMoney(cell.cost) + ' · ' + fmtTokens(cell.tokens) + ' tok · ' + fmtInt(cell.requests) + ' 次'
          }));
        }
      }
      items.push(h('div', { key: 'tickPad', className: 'ub_hmTick' }));
      for (const hr of [0, 6, 12, 18]) {
        items.push(h('div', { key: 'tick' + hr, className: 'ub_hmTick', style: { gridColumn: 'span 6' } }, String(hr)));
      }
      return h('div', { className: 'ub_hm' }, items);
    }

    function StackBar(props) {
      const segs = props.segs.filter((s) => s.value > 0);
      const total = segs.reduce((s, x) => s + x.value, 0);
      if (total <= 0) return h('div', { className: 'ub_empty' }, '窗口内无数据');
      return h('div', null,
        h('div', { className: 'ub_stack' }, segs.map((s) => h('div', {
          key: s.key, className: 'ub_stackSeg', style: { width: (s.value / total * 100) + '%', background: s.color },
          title: s.label + ' ' + s.text
        }))),
        h('div', { className: 'ub_legend', style: { marginTop: '7px' } }, props.segs.map((s) => h('span', { key: s.key, className: 'ub_legendItem' },
          h('span', { className: 'ub_sw', style: { background: s.color } }),
          h('span', null, s.label + ' ' + s.text + (total > 0 ? ' · ' + Math.round(s.value / total * 100) + '%' : ''))
        )))
      );
    }

    function SessionRows(props) {
      const rows = props.sessions || [];
      if (rows.length === 0) return h('div', { className: 'ub_empty' }, '窗口内无会话记录');
      return h('div', { className: 'ub_rows' }, rows.slice(0, props.limit || 8).map((s, i) => h('div', { key: s.id, className: 'ub_row' },
        h('span', { className: 'ub_rowIdx' }, String(i + 1)),
        h('span', { className: 'ub_rowName', title: s.id }, props.titleOf(s.id)),
        h('span', { className: 'ub_rowMeta' }, fmtInt(s.requests) + ' 次 · ' + s.days + ' 天'),
        h('span', { className: 'ub_rowNum' }, fmtMoney(s.cost))
      )));
    }

    /* ── 看板正文（纯 props 驱动）── */
    function BoardView(props) {
      const data = props.data;
      const bal = props.bal;
      const metric = props.metric;
      const ramp = RAMP[props.theme === 'light' ? 'light' : 'dark'];
      const win = props.win;
      const rows = data && Array.isArray(data.days) ? data.days : [];
      const totals = (data && data.totals) || {};
      const winTotals = win >= 90 ? totals.d90 : win >= 30 ? totals.d30 : totals.d7;
      const today = (data && data.today) || null;
      const arch = (data && data.archive) || null;
      const officialTotal = sumOfficial(props.official);
      const localD7 = totals.d7 ? totals.d7.cost : null;
      const stale = officialTotal !== null && localD7 !== null && Math.abs(officialTotal - localD7) > 0.01;
      const detailRow = rows.find((r) => r.date === (props.picked || props.hover)) || today || rows[rows.length - 1] || null;

      const balanceView = bal && Array.isArray(bal.balances) ? bal.balances : [];
      const cny = balanceView.find((b) => b.currency === 'CNY') || balanceView[0] || null;
      const low = !!(bal && bal.low && bal.low.length);

      const comp = winTotals || {};
      // 构成条：¥ 口径按宿主给的三类金额，tok 口径按三类 token（"次"没有构成，退回 ¥ 口径）
      const byCost = metric !== 'token';
      const classSegs = [
        { key: 'in', label: '输入', color: TONE.input, cost: comp.inputCost || 0, tokens: comp.uncachedInputTokens || 0 },
        { key: 'cr', label: '缓存命中', color: TONE.cacheRead, cost: comp.cacheReadCost || 0, tokens: comp.cacheReadTokens || 0 },
        { key: 'cw', label: '写缓存', color: TONE.cacheWrite, cost: comp.cacheWriteCost || 0, tokens: comp.cacheWriteTokens || 0 },
        { key: 'out', label: '输出', color: TONE.output, cost: comp.outputCost || 0, tokens: comp.outputTokens || 0 }
      ].map((s) => ({
        key: s.key, label: s.label, color: s.color,
        value: byCost ? s.cost : s.tokens,
        text: byCost ? fmtMoney(s.cost) : fmtTokens(s.tokens)
      }));
      const cacheRate = (() => {
        const read = comp.cacheReadTokens || 0;
        const miss = comp.uncachedInputTokens || 0;
        if (read + miss <= 0) return null;
        return read / (read + miss);
      })();

      const peakVal = metric === 'token' ? (comp.peakTokens || 0) : (comp.peakCost || 0);
      const offVal = metric === 'token' ? (comp.offPeakTokens || 0) : (comp.offPeakCost || 0);
      const bandSegs = [
        { key: 'peak', label: '高峰价', color: 'var(--dsw-alias-state-warn-primary)', value: peakVal, text: metric === 'token' ? fmtTokens(peakVal) : fmtMoney(peakVal) },
        { key: 'off', label: '空闲价', color: '#73c991', value: offVal, text: metric === 'token' ? fmtTokens(offVal) : fmtMoney(offVal) }
      ];

      const costView = props.cost && props.cost.ok === true ? props.cost : null;

      return h('div', { className: 'ub_root' },
        h('div', { className: 'ub_tiles' },
          h(Tile, {
            label: '余额', icon: 'wallet',
            value: bal && bal.total !== undefined ? ('¥' + Number(bal.total).toFixed(2)) : '--',
            sub: cny ? (cny.currency + ' · 赠金 ' + cny.granted_balance + ' · 充值 ' + cny.topped_up_balance) : '未配置 API Key',
            warn: low || (bal && bal.error ? true : false)
          }),
          h(Tile, { label: '今日', value: today ? fmtMoney(today.cost) : '--', sub: today ? (fmtTokens(totalTokens(today)) + ' tok · ' + fmtInt(today.requests) + ' 次') : '' }),
          h(Tile, { label: '近 7 天', value: totals.d7 ? fmtMoney(totals.d7.cost) : '--', sub: totals.d7 ? (fmtTokens(totalTokens(totals.d7)) + ' tok · ' + fmtInt(totals.d7.requests) + ' 次') : '' }),
          h(Tile, { label: '近 30 天', value: totals.d30 ? fmtMoney(totals.d30.cost) : '--', sub: totals.d30 ? (fmtTokens(totalTokens(totals.d30)) + ' tok · ' + fmtInt(totals.d30.requests) + ' 次') : '' })
        ),

        h('div', { className: 'ub_bar' },
          h(Seg, { value: win, onChange: props.onWin, options: [{ v: 30, label: '30天' }, { v: 90, label: '90天' }] }),
          h(Seg, { value: metric, onChange: props.onMetric, options: [{ v: 'cost', label: '¥' }, { v: 'token', label: 'tok' }, { v: 'req', label: '次' }] }),
          h(Seg, { value: props.view, onChange: props.onView, options: [{ v: 'grid', icon: 'grid', title: '方格' }, { v: 'bars', icon: 'bars', title: '柱状' }] }),
          h('span', { className: 'ub_gap' }),
          h(IconBtn, { name: 'refresh', title: '刷新', disabled: props.busy === true, onClick: props.onRefresh }),
          h(IconBtn, { name: 'wallet', title: '充值', onClick: () => props.openUrl(RECHARGE_URL) }),
          h(IconBtn, { name: 'key', title: 'API Key', onClick: () => props.openUrl(KEYS_URL) }),
          h(IconBtn, { name: 'open', title: '官方用量明细', onClick: () => props.openUrl(DETAIL_URL) })
        ),

        props.err ? h('div', { className: 'ub_err' }, String(props.err)) : null,

        h('div', { className: 'ub_section' },
          h('div', { className: 'ub_head' },
            h('span', { className: 'ub_title' }, '近 ' + win + ' 天' + (data && data.ready === false ? ' · 扫描中' : '')),
            h('span', { className: 'ub_gap' }),
            arch && arch.running ? h('span', { className: 'ub_pill' }, '存档补齐 ' + fmtInt(arch.scanned) + '/' + fmtInt(arch.scanned + arch.pending)) : null,
            arch && !arch.running && arch.error ? h('span', { className: 'ub_pill ub_pillPeak' }, '存档读取失败') : null,
            h('span', { className: 'ub_pill' }, winTotals ? fmtMoney(winTotals.cost) : '--')
          ),
          h('div', { className: 'ub_heatRow' },
            props.view === 'grid' ? h(DayGrid, { rows, ramp, metric, picked: props.picked, onPick: props.onPick, onHover: props.onHover })
              : h(DayBars, { rows, ramp, metric, picked: props.picked, onPick: props.onPick, onHover: props.onHover }),
            h(DetailStrip, { row: detailRow })
          )
        ),

        h('div', { className: 'ub_section' },
          h('div', { className: 'ub_head' }, h('span', { className: 'ub_title' }, '时段分布（近 ' + win + ' 天）')),
          h(HourGrid, { hours: (data && data.hours) || [], ramp, metric })
        ),

        h('div', { className: 'ub_section' },
          h('div', { className: 'ub_head' },
            h('span', { className: 'ub_title' }, '构成（近 ' + win + ' 天）'),
            h('span', { className: 'ub_gap' }),
            cacheRate === null ? null : h('span', { className: 'ub_pill' }, '缓存命中率 ' + Math.round(cacheRate * 100) + '%')
          ),
          h(StackBar, { segs: classSegs })
        ),

        h('div', { className: 'ub_section' },
          h('div', { className: 'ub_head' }, h('span', { className: 'ub_title' }, '峰谷分布（近 ' + win + ' 天）')),
          h(StackBar, { segs: bandSegs })
        ),

        h('div', { className: 'ub_section' },
          h('div', { className: 'ub_head' },
            h('span', { className: 'ub_title' }, '会话消耗排行（近 ' + win + ' 天）'),
            h('span', { className: 'ub_gap' }),
            h('span', { className: 'ub_pill' }, fmtInt(data && data.sessionCount) + ' 个会话')
          ),
          h(SessionRows, { sessions: (data && data.sessions) || [], titleOf: props.titleOf })
        ),

        h('div', { className: 'ub_section' },
          h('div', { className: 'ub_head' },
            h('span', { className: 'ub_title' }, '本会话'),
            h('span', { className: 'ub_gap' }),
            costView && costView.band ? h('span', { className: 'ub_pill ' + (costView.band === 'peak' ? 'ub_pillPeak' : 'ub_pillOff') }, costView.band === 'peak' ? '高峰价' : costView.band === 'offPeak' ? '空闲价' : '基础价') : null
          ),
          h('div', { className: 'ub_row' },
            h('span', { className: 'ub_big' }, costView ? fmtMoney(costView.cost) : '--'),
            h('span', { className: 'ub_gap' }),
            h('span', { className: 'ub_rowMeta' }, '阈值 ¥'),
            h('input', {
              className: 'ub_input', type: 'number', min: 0, step: 0.01,
              value: props.thresholdDraft !== null ? props.thresholdDraft : (costView && Number.isFinite(costView.costThreshold) ? Number(costView.costThreshold).toFixed(2) : '5.00'),
              onChange: (e) => props.onThresholdDraft(e.target.value),
              onBlur: (e) => props.onThresholdCommit(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') e.target.blur(); }
            })
          ),
          h('div', { className: 'ub_row' },
            h('span', { className: 'ub_rowMeta' }, costView ? ('输入 ' + fmtTokens(costView.uncachedInputTokens) + ' · 缓存 ' + fmtTokens(costView.cacheReadTokens) + ' · 输出 ' + fmtTokens(costView.outputTokens)) : ''),
            h('span', { className: 'ub_gap' }),
            costView && costView.model ? h('span', { className: 'ub_rowMeta' }, costView.model) : null
          ),
          costView && costView.cost > (Number.isFinite(costView.costThreshold) ? costView.costThreshold : 5)
            ? h('div', { className: 'ub_warnRow' }, h(Icon, { name: 'warn', size: 12 }), h('span', null, '当前窗口上下文过长，建议新建对话'))
            : null
        ),

        officialTotal === null ? null : h('div', { className: 'ub_section' },
          h('div', { className: 'ub_head' },
            h('span', { className: 'ub_title' }, '官方账单校准（近 7 天）'),
            h('span', { className: 'ub_gap' }),
            stale ? h('span', { className: 'ub_warnRow' }, h(Icon, { name: 'warn', size: 12 }), h('span', null, '与本地不一致')) : null
          ),
          h('div', { className: 'ub_detail' },
            h('span', null, '官方 ', h('b', null, fmtMoney(officialTotal)), ' · 本地 ', h('b', null, fmtMoney(localD7)))
          )
        )
      );
    }

    /* ── 看板容器（取数 + 轮询 + 状态）── */
    let CTX = null;

    function UsageBoard() {
      const ctx = CTX;
      const sessions = ctx ? ctx.get('sessions') : undefined;
      const [data, setData] = react.useState(null);
      const [bal, setBal] = react.useState(null);
      const [official, setOfficial] = react.useState(null);
      const [cost, setCost] = react.useState(null);
      const [err, setErr] = react.useState(null);
      const [busy, setBusy] = react.useState(false);
      const [win, setWin] = react.useState(() => { const v = Number(readLs(LS_WIN, '30')); return v === 90 ? 90 : 30; });
      const [metric, setMetric] = react.useState(() => { const v = readLs(LS_METRIC, 'cost'); return v === 'token' || v === 'req' ? v : 'cost'; });
      const [view, setView] = react.useState(() => (readLs(LS_VIEW, 'grid') === 'bars' ? 'bars' : 'grid'));
      const [picked, setPicked] = react.useState(null);
      const [hover, setHover] = react.useState(null);
      const [theme, setTheme] = react.useState(() => themeOf(ctx));
      const [titleTick, setTitleTick] = react.useState(0);
      const [thresholdDraft, setThresholdDraft] = react.useState(null);

      // 当前会话（与左栏钱包面板同款口径：retainedBy.mainView > 0 的那条）
      const currentSessionId = react.useSyncExternalStore(
        sessions && sessions.list ? (cb) => sessions.list.subscribe(cb) : () => () => {},
        sessions && sessions.list ? () => {
          try {
            const snap = sessions.list.getSnapshot();
            const rows = snap && snap.byId ? Object.values(snap.byId) : [];
            for (const row of rows) if (row && row.retainedBy && (row.retainedBy.mainView || 0) > 0) return row.id;
          } catch { /* ignore */ }
          return undefined;
        } : () => undefined,
        () => undefined
      );

      react.useEffect(() => {
        try {
          if (ctx && typeof ctx.on === 'function') {
            const off = ctx.on('theme/change', () => setTheme(themeOf(ctx)));
            return typeof off === 'function' ? off : undefined;
          }
        } catch { /* ignore */ }
        return undefined;
      }, []);

      // 会话标题：会话列表快照变化时重渲染，排行里显示人类可读标题
      react.useEffect(() => {
        try {
          if (sessions && sessions.list && typeof sessions.list.subscribe === 'function') {
            return sessions.list.subscribe(() => setTitleTick((t) => t + 1));
          }
        } catch { /* ignore */ }
        return undefined;
      }, []);

      const pullBoard = react.useCallback((quiet) => {
        if (quiet !== true) setBusy(true);
        fetch(BOARD_URL + '?days=' + win)
          .then((r) => r.json())
          .then((d) => { if (d && d.ok) { setData(d); setErr(null); } else setErr((d && d.error) || '看板数据不可用'); })
          .catch((e) => setErr(String(e && e.message || e)))
          .finally(() => setBusy(false));
      }, [win]);

      react.useEffect(() => {
        pullBoard(true);
        const t = setInterval(() => pullBoard(true), BOARD_POLL_MS);
        const onVis = () => { if (document.visibilityState === 'visible') pullBoard(true); };
        document.addEventListener('visibilitychange', onVis);
        return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
      }, [pullBoard]);

      react.useEffect(() => {
        const pull = () => fetch(BALANCE_URL).then((r) => r.json()).then(setBal).catch(() => { /* ignore */ });
        pull();
        const t = setInterval(pull, BALANCE_POLL_MS);
        return () => clearInterval(t);
      }, []);

      react.useEffect(() => {
        const pull = () => fetch(USAGE_URL).then((r) => r.json()).then((d) => { if (d && d.ok) setOfficial(d.official); }).catch(() => { /* ignore */ });
        pull();
        const t = setInterval(pull, OFFICIAL_POLL_MS);
        return () => clearInterval(t);
      }, []);

      react.useEffect(() => {
        const pull = () => fetch(currentSessionId ? COST_URL + '?session=' + encodeURIComponent(currentSessionId) : COST_URL)
          .then((r) => r.json())
          .then((d) => { if (d && d.ok) setCost(d); })
          .catch(() => { /* ignore */ });
        setCost(null);
        pull();
        const t = setInterval(pull, COST_POLL_MS);
        return () => clearInterval(t);
      }, [currentSessionId]);

      const titleOf = (id) => {
        try {
          const snap = sessions && sessions.list ? sessions.list.getSnapshot() : null;
          const row = snap && snap.byId ? snap.byId[id] : null;
          const t = row && (row.displayTitle || row.title);
          if (typeof t === 'string' && t.length > 0) return t;
        } catch { /* ignore */ }
        return String(id).slice(0, 8);
      };

      const commitThreshold = (val) => {
        setThresholdDraft(null);
        const t = Number(val);
        if (!Number.isFinite(t) || t < 0) return;
        fetch(THRESHOLD_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: currentSessionId, threshold: t }) })
          .then((r) => r.json())
          .then((v) => { if (v && v.ok) setCost((c) => (c ? Object.assign({}, c, { costThreshold: v.costThreshold }) : c)); })
          .catch(() => { /* ignore */ });
      };

      return h(BoardView, {
        data, bal, official, cost, err, busy, theme, win, metric, view, picked, hover, thresholdDraft,
        onWin: (v) => { setWin(v); writeLs(LS_WIN, v); },
        onMetric: (v) => { setMetric(v); writeLs(LS_METRIC, v); },
        onView: (v) => { setView(v); writeLs(LS_VIEW, v); },
        onPick: setPicked,
        onHover: setHover,
        onRefresh: () => pullBoard(false),
        onThresholdDraft: setThresholdDraft,
        onThresholdCommit: commitThreshold,
        openUrl: (url) => { try { window.open(url, '_blank'); } catch { /* ignore */ } },
        titleOf
      });
    }

    /* ── 注册 ── */
    function apply(ctx) {
      CTX = ctx;
      vkCard(ctx, { slot: VK.settings.extra, id: 'usage-board', order: 60, component: UsageBoard });
    }

    exports.apply = apply;
    exports.inject = ['slots', 'sessions'];
    exports.__board = {
      BoardView, UsageBoard, Tile, DetailStrip, DayGrid, DayBars, HourGrid, StackBar, SessionRows,
      dayColumns, monthLabels, weekdayMon0, hourLabel, thresholdsOf, levelOf, RAMP,
      fmtMoney, fmtInt, fmtTokens, totalTokens, dayValue, fmtBy, sumOfficial, themeOf
    };
    return module.exports;
  }
});
