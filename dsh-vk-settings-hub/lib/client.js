// dsh-vk-settings-hub — 设置页导航中枢。
// 接管官方设置面板左栏（隐藏官方 navList，按契约表重绘我们自己的条目），
// 正文仍由官方 shell 按 activeId 渲染；导航点击走官方按钮，不复制官方任何代码。
window.__ModuleLoader__.load({
	id: 'dsh-vk-settings-hub',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

		const react = require('react');
		const h = react.createElement;

		const HUB_ID = 'hub';
		const HUB_ORDER = -10;
		const HUB_PRIORITY = -1;
		const DEFAULT_ID = 'general';
		const RESERVED = ['pocket', 'skill-sets'];

		/* ── 图标：内联 SVG，stroke=currentColor（唯一例外见官方齿轮克隆） ── */
		const GLYPH = {
			models: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
			plugins: '<path d="M9 2v6M15 2v6"/><path d="M6 8h12v4a6 6 0 0 1-12 0z"/><path d="M12 18v4"/>',
			skills: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
			mnemon: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6"/><path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3"/>',
			archived: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>',
			mcp: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M8 6h8M7.4 7.7 10.8 16M16.6 7.7 13.2 16"/>',
			pocket: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
			skillSets: '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
			/* 预留位里「由别的插件提供的设置页」统一用这个图标（区别于通用设置的官方齿轮） */
			extra: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M17.5 14v7M14 17.5h7"/>',
			gear: '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
		};

		/* ── 导航模型：id 对齐官方 settings.section 的 id；subs 是同一导航项内的子页 ── */
		const NAV_MODEL = [
			{ id: 'general', label: '通用设置', glyph: 'gear', official: true, subs: [{ id: 'general', label: '通用' }, { id: 'agent-presets', label: 'Agent 预设' }] },
			{ id: 'models', label: '模型', glyph: 'models' },
			{ id: 'plugins', label: '插件', glyph: 'plugins' },
			{ id: 'skills', label: 'Skill 管理', glyph: 'skills' },
			{ id: 'mnemon', label: '记忆系统', glyph: 'mnemon' },
			{ id: 'archived-sessions', label: '已归档会话', glyph: 'archived', subs: [{ id: 'archived-sessions', label: '软归档' }, { id: 'archive-zip', label: 'ZIP 归档' }] },
			{ id: 'mcp', label: 'MCP 管理', glyph: 'mcp' },
			{ id: 'pocket', label: '移动端访问', glyph: 'pocket', reserved: true },
			{ id: 'skill-sets', label: '技能档', glyph: 'skillSets', reserved: true },
			/* 契约里的预留座：谁往 vk.settings.extra 投内容，这里就出现「扩展」 */
			{ id: 'extra', label: '扩展', glyph: 'extra', reserved: true }
		];

		/** 注册方给的标签可能是字符串、也可能是个取值函数（官方那套就是函数）。 */
		function labelOf(raw, fallback) {
			if (typeof raw === 'function') {
				try {
					const value = raw();
					if (typeof value === 'string' && value.length > 0) return value;
				} catch { /* 本地化面未就绪时标签函数会抛：退回注册 id */ }
			}
			if (typeof raw === 'string' && raw.length > 0) return raw;
			return fallback;
		}

		const CSS = `
.vkHubNav{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:2px;overflow-y:auto;margin:0 -12px;padding:0 12px 12px;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2)}
.vkHubItem{box-sizing:border-box;flex:none;width:100%;height:40px;cursor:pointer;color:var(--dsw-alias-label-primary);text-align:left;background:0 0;border:none;border-radius:12px;align-items:center;gap:8px;padding:9px 16px 9px 12px;font-family:inherit;font-size:14px;line-height:22px;display:flex}
.vkHubItem:hover{background:var(--dsw-alias-interactive-bg-hover)}
.vkHubItemOn{background:var(--dsw-specific-sidebar-nav-item-active)}
.vkHubGlyph{flex:none;width:16px;height:16px;display:flex;align-items:center;justify-content:center}
.vkHubText{flex:1;min-width:0;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
.vkHubSub{box-sizing:border-box;flex:none;width:100%;height:32px;cursor:pointer;color:var(--dsw-alias-label-secondary);text-align:left;background:0 0;border:none;border-radius:10px;align-items:center;padding:0 16px 0 36px;font-family:inherit;font-size:13px;line-height:20px;display:flex}
.vkHubSub:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.vkHubSubOn{color:var(--dsw-alias-label-primary);background:var(--dsw-specific-sidebar-nav-item-active)}
.vkHubSep{flex:none;height:1px;background:var(--dsw-alias-border-l1);margin:8px 12px}
.vkHubPane{display:flex;flex-direction:column;gap:10px;padding:16px;width:100%;box-sizing:border-box}
.vkHubBar{display:flex;align-items:center;gap:8px}
.vkHubInput{flex:1;min-width:0;height:32px;background:var(--dsw-specific-input-fill,var(--dsw-specific-sidebar-fill));color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:0 10px;font-family:inherit;font-size:12.5px}
.vkHubInput:focus{outline:none;border-color:var(--vk-accent,var(--dsw-alias-accent))}
.vkHubBtn{appearance:none;flex:none;width:26px;height:26px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.vkHubBtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.vkHubBtn:disabled{opacity:.45;cursor:default}
.vkHubBtnAccent{color:var(--dsw-alias-state-business-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 35%,transparent)}
.vkHubBtnDanger{color:#f14c4c;border-color:rgba(241,76,76,.35)}
.vkHubList{display:flex;flex-direction:column;gap:8px}
.vkHubRow{display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 12px;background:var(--dsw-specific-input-fill,var(--dsw-specific-sidebar-fill))}
.vkHubRowMain{flex:1;min-width:0}
.vkHubRowName{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vkHubRowMeta{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.vkHubEmpty{font-size:12px;color:var(--dsw-alias-label-secondary);padding:18px 0;text-align:center}
.vkHubMsg{font-size:12px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vkHubMsgOk{color:#73c991}
.vkHubMsgErr{color:#f14c4c}
.vkHubDot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-tertiary)}
.vkHubDotOn{background:#73c991}
`;
		(function injectCss() {
			if (typeof document === 'undefined') return;
			const plugin = 'dsh-vk-settings-hub';
			for (const old of document.querySelectorAll('style[data-plugin="' + plugin + '"]')) { try { old.remove(); } catch { /* ignore */ } }
			const tag = document.createElement('style');
			tag.dataset.plugin = plugin;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		})();

		/* ── 模块级把手：导航是命令式 DOM，生命周期不跟 React 组件（组件会随切页卸载） ── */
		const ctxRef = { current: null };
		const dom = { nav: null, box: null, list: null, listDisplay: '', want: null, frame: null, pending: null, tries: 0 };

		function ledgerRows() {
			const ctx = ctxRef.current;
			if (ctx === null || ctx === undefined) return [];
			let entries = [];
			try { entries = ctx.slots.entries('settings.section'); } catch { return []; }
			if (!Array.isArray(entries)) return [];
			/* 与官方 shell 同源同序（含 id 缺失行），索引才对得上 navList 的按钮 */
			return entries
				.map((e) => {
					const id = typeof e.options.id === 'string' ? e.options.id : '';
					return { id, label: labelOf(e.options.label, id), order: e.options.order === undefined ? 0 : e.options.order };
				})
				.sort((a, b) => a.order - b.order);
		}

		function svgOf(doc, path, size) {
			const wrap = doc.createElement('span');
			wrap.innerHTML = '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor"'
				+ ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block">' + path + '</svg>';
			return wrap.firstChild;
		}

		/* 官方 navList：nav 里除我们自己那个盒子外、含 button 的那一层（不认类名哈希） */
		function officialList(nav) {
			for (const child of Array.from(nav.children)) {
				if (dom.box !== null && child === dom.box) continue;
				if (typeof child.querySelector === 'function' && child.querySelector('button') !== null) return child;
			}
			return null;
		}

		function findNav(node) {
			let el = node;
			while (el !== null && el !== undefined && el.parentElement) {
				const found = Array.from(el.parentElement.children).find((c) => c.tagName === 'NAV');
				if (found) return found;
				el = el.parentElement;
			}
			return null;
		}

		/* 设置面板自身的 nav：按钮数与契约表行数一致才算（避免认到别的弹层的 nav） */
		function panelNav() {
			const doc = document;
			for (const dialog of Array.from(doc.querySelectorAll('[role="dialog"]'))) {
				for (const nav of Array.from(dialog.querySelectorAll('nav'))) {
					const list = officialList(nav);
					if (list === null) continue;
					if (list.children.length === ledgerRows().length && list.children.length > 0) return nav;
				}
			}
			return null;
		}

		function activeId() {
			const list = dom.list;
			if (list === null || !list.isConnected) return null;
			for (const btn of Array.from(list.children)) {
				if (btn.getAttribute('aria-current') !== 'true') continue;
				const stamped = btn.getAttribute('data-vk-row');
				if (stamped !== null) return stamped;
				break;
			}
			/* 没盖戳（官方刚重渲染过）才退回位置映射，且只在两边行数对得上时敢用 */
			const rows = ledgerRows();
			if (rows.length !== list.children.length) return null;
			for (let i = 0; i < rows.length; i += 1) {
				const btn = list.children[i];
				if (btn && btn.getAttribute('aria-current') === 'true') return rows[i].id;
			}
			return null;
		}

		/**
		 * 给官方 navList 的每个按钮盖一个 `data-vk-row=<分区 id>` 的戳，之后按 id 点，不再靠位置。
		 * 只有「按钮数 === 契约表行数」时才盖：两边的行都按 order 排，数量对上就说明官方已经渲染到
		 * 同一版 ledger（数量对不上时按位置盖会把新插入那一页的戳盖到旧按钮上，点错页）。
		 * @returns 戳齐了 true；官方还没渲染完 false（调用方等下一帧）
		 */
		function stampButtons() {
			const list = dom.list;
			if (list === null || !list.isConnected) return false;
			const rows = ledgerRows();
			if (rows.length === 0 || list.children.length !== rows.length) return false;
			for (let i = 0; i < rows.length; i += 1) {
				const btn = list.children[i];
				if (!btn || rows[i].id.length === 0) continue;
				btn.setAttribute('data-vk-row', rows[i].id);
			}
			return true;
		}

		/* 点官方按钮切页：React 18 把事件挂在根容器上，程序化 click 一样能触发（元素即便 display:none）。
		   官方 aria-current 要等 React 提交后才更新，所以先记下乐观值立即重绘，下一帧再按真值对齐。 */
		function select(id) {
			const list = dom.list;
			if (list === null || !list.isConnected) return false;
			if (!stampButtons()) { dom.pending = id; scheduleFrame(); return false; }
			let found = null;
			for (const btn of Array.from(list.children)) {
				if (btn.getAttribute('data-vk-row') === id) { found = btn; break; }
			}
			if (found === null) { dom.pending = id; scheduleFrame(); return false; }
			dom.want = id;
			found.click();
			paint();
			scheduleFrame();
			return true;
		}

		function scheduleFrame() {
			if (dom.frame !== null) return;
			const run = () => {
				dom.frame = null;
				dom.want = null;
				/* 上一帧没点成（官方 navList 还没渲染到新版 ledger）就在这一帧补一次，最多等 40 帧 */
				const pending = dom.pending;
				if (pending !== null) {
					dom.pending = null;
					dom.tries += 1;
					if (select(pending)) dom.tries = 0;
					else if (dom.tries <= 40) dom.pending = pending;
					else dom.tries = 0;
				}
				try { paint(); } catch { /* ignore */ }
			};
			try {
				dom.frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : setTimeout(run, 16);
			} catch {
				dom.frame = null;
			}
		}

		function paint() {
			const nav = dom.nav;
			const box = dom.box;
			if (nav === null || box === null || !nav.isConnected || !box.isConnected) return;
			const doc = document;
			const rows = ledgerRows();
			stampButtons();
			const present = new Set(rows.map((r) => r.id).filter((id) => id.length > 0));
			const active = dom.want !== null ? dom.want : activeId();
			box.textContent = '';

			const model = NAV_MODEL.filter((item) => present.has(item.id) || (item.subs !== undefined && item.subs.some((s) => present.has(s.id))));
			const known = new Set();
			for (const item of model) {
				known.add(item.id);
				if (item.subs !== undefined) for (const sub of item.subs) known.add(sub.id);
			}
			/* 契约表之外、由其它插件注册的分区自动落到预留分组（不写死名单，用注册方自己的标签） */
			const extra = rows.filter((r) => r.id !== HUB_ID && !known.has(r.id) && !RESERVED.includes(r.id)).map((r) => ({ id: r.id, label: r.label || r.id, glyph: 'extra', reserved: true }));
			const items = model.concat(extra);

			/* 官方齿轮：直接克隆官方「通用设置」那行里的图标，保证和官方是同一颗 */
			const gearIndex = rows.findIndex((r) => r.id === 'general');
			const gearSource = dom.list !== null && dom.list.isConnected && gearIndex >= 0 ? dom.list.children[gearIndex] : null;
			const gearNode = gearSource ? gearSource.querySelector('svg') : null;

			let reservedDrawn = false;
			for (const item of items) {
				if (item.reserved === true && !reservedDrawn) {
					reservedDrawn = true;
					box.appendChild(doc.createElement('div')).className = 'vkHubSep';
				}
				const on = active === item.id || (item.subs !== undefined && item.subs.some((s) => s.id === active));
				const btn = doc.createElement('button');
				btn.type = 'button';
				btn.className = 'vkHubItem' + (on ? ' vkHubItemOn' : '');
				btn.title = item.label;
				btn.setAttribute('data-vk-hub-item', item.id);
				const glyph = doc.createElement('span');
				glyph.className = 'vkHubGlyph';
				glyph.appendChild(item.official === true && gearNode ? gearNode.cloneNode(true) : svgOf(doc, GLYPH[item.glyph] || GLYPH.gear, 16));
				const text = doc.createElement('span');
				text.className = 'vkHubText';
				text.textContent = item.label;
				btn.appendChild(glyph);
				btn.appendChild(text);
				btn.addEventListener('click', () => { select(item.id); });
				box.appendChild(btn);
				if (item.subs !== undefined && on) {
					for (const sub of item.subs) {
						if (!present.has(sub.id)) continue;
						const sbtn = doc.createElement('button');
						sbtn.type = 'button';
						sbtn.className = 'vkHubSub' + (active === sub.id ? ' vkHubSubOn' : '');
						sbtn.title = sub.label;
						sbtn.textContent = sub.label;
						sbtn.setAttribute('data-vk-hub-sub', sub.id);
						sbtn.addEventListener('click', () => { select(sub.id); });
						box.appendChild(sbtn);
					}
				}
			}
		}

		/* 把官方 navList 藏起来，换成我们的盒子；面板重开是新的 nav 节点，重绘即可 */
		function attach(marker) {
			if (typeof document === 'undefined') return;
			const nav = marker === undefined || marker === null ? panelNav() : findNav(marker);
			if (nav === null) return;
			if (dom.nav !== nav) { dom.nav = nav; dom.box = null; }
			const list = officialList(nav);
			if (list !== null && list !== dom.list) {
				restoreList();
				dom.list = list;
				dom.listDisplay = list.style.display;
				list.style.display = 'none';
			}
			if (dom.box === null || !dom.box.isConnected || dom.box.parentElement !== nav) {
				const box = document.createElement('div');
				box.className = 'vkHubNav';
				box.setAttribute('data-vk-hub-nav', '1');
				nav.appendChild(box);
				dom.box = box;
			}
			paint();
		}

		function restoreList() {
			if (dom.list !== null && dom.list.isConnected) { try { dom.list.style.display = dom.listDisplay; } catch { /* ignore */ } }
			dom.list = null;
		}

		function teardown() {
			if (dom.frame !== null) { try { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(dom.frame); else clearTimeout(dom.frame); } catch { /* ignore */ } dom.frame = null; }
			dom.want = null;
			restoreList();
			if (dom.box !== null && dom.box.isConnected) { try { dom.box.remove(); } catch { /* ignore */ } }
			dom.box = null;
			dom.nav = null;
		}

		/* ── 设置页正文：插件市场 / 启停管理 / ZIP 归档 ── */
		const UI = {
			refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
			search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
			install: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
			power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
			restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'
		};
		function HubIcon({ name, size }) {
			const d = UI[name];
			if (!d) return null;
			return h('svg', {
				viewBox: '0 0 24 24', width: size === undefined ? 14 : size, height: size === undefined ? 14 : size,
				fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
				'aria-hidden': 'true', style: { flex: 'none', display: 'block' }, dangerouslySetInnerHTML: { __html: d }
			});
		}
		function HubBtn({ name, title, onClick, disabled, tone, size }) {
			const cls = 'vkHubBtn' + (tone === 'accent' ? ' vkHubBtnAccent' : '') + (tone === 'danger' ? ' vkHubBtnDanger' : '');
			return h('button', { type: 'button', className: cls, title, 'aria-label': title, disabled: disabled === true, onClick }, h(HubIcon, { name, size: size === undefined ? 14 : size }));
		}
		function HubMsg({ msg }) {
			if (msg === null) return h('div', { className: 'vkHubMsg' });
			return h('div', { className: 'vkHubMsg' + (msg.ok ? ' vkHubMsgOk' : ' vkHubMsgErr') }, msg.text);
		}
		function hubPost(path, payload) {
			return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => r.json());
		}

		/** 插件市场：清单来自 host 侧转发（外网），装走 dsh plugin add。 */
		function VKMarketTab() {
			const [state, setState] = react.useState({ phase: 'loading', plugins: [], error: null, fetchedAt: null, cached: false, refreshing: false });
			const [query, setQuery] = react.useState('');
			const [busy, setBusy] = react.useState('');
			const [msg, setMsg] = react.useState(null);
			const load = react.useCallback(() => {
				/* 加载时不丢已有清单：host 侧有缓存时是秒回，出错也还能看旧的 */
				setState((prev) => Object.assign({}, prev, { phase: 'loading', error: null }));
				fetch('/dsh-hub/market').then((r) => r.json())
					.then((d) => {
						if (d && d.ok === true) {
							setState({ phase: 'ready', plugins: d.plugins, error: d.error || null, fetchedAt: d.fetchedAt || null, cached: d.cached === true, refreshing: d.refreshing === true });
						} else {
							setState((prev) => Object.assign({}, prev, { phase: 'error', error: (d && d.error) || '市场清单读不到' }));
						}
					})
					.catch((e) => setState((prev) => Object.assign({}, prev, { phase: 'error', error: String(e) })));
			}, []);
			react.useEffect(load, [load]);
			/* 清单 4000+ 条、5MB：把「多少条 / 什么时候拿的 / 是否在后台刷新」摆在标题行上，
			   免得用户以为页面坏了（首拉要几十秒是清单体积决定的，不是网络挂了） */
			const metaText = () => {
				if (state.phase === 'loading' && state.plugins.length === 0) return '拉取中（首次要几十秒）';
				const parts = [state.plugins.length + ' 条'];
				if (state.fetchedAt !== null) {
					const t = new Date(state.fetchedAt);
					parts.push((state.cached ? '缓存 ' : '更新 ') + (Number.isNaN(t.getTime()) ? state.fetchedAt : String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0')));
				}
				if (state.refreshing) parts.push('后台刷新中');
				return parts.join(' · ');
			};
			/* 清单条目的字段实测是 {name, owner, url, page, category, description, npm, version, stars, downloads}——
			   没有 spec。安装源优先取 npm 包名（注册表装法），没有 npm 才退回仓库 URL。 */
			const specOf = (p) => String(p.npm || p.spec || p.install || p.source || p.repo || p.repository || p.url || '');
			const nameOf = (p) => String(p.name || p.title || p.id || p.package || '');
			const descOf = (p) => String(p.description || p.desc || p.summary || '');
			const install = (spec) => {
				setBusy(spec);
				setMsg(null);
				hubPost('/dsh-hub/market/install', { spec })
					.then((d) => {
						setBusy('');
						if (d && d.ok === true) setMsg({ ok: true, text: '已安装，重启后生效' });
						else setMsg({ ok: false, text: (d && d.error) || ('安装失败（exit ' + (d && d.exitCode) + '）') });
					})
					.catch((e) => { setBusy(''); setMsg({ ok: false, text: String(e) }); });
			};
			const q = query.trim().toLowerCase();
			const list = state.plugins.filter((p) => q.length === 0 || nameOf(p).toLowerCase().includes(q) || descOf(p).toLowerCase().includes(q));
			return h('div', { className: 'vkHubPane' },
				h('div', { className: 'vkHubBar' },
					h('input', { className: 'vkHubInput', value: query, placeholder: '搜索', onChange: (e) => setQuery(e.target.value), spellCheck: false }),
					h('div', { className: 'vkHubRowMeta', style: { flex: 'none' } }, metaText()),
					h(HubBtn, { name: 'refresh', title: '重新拉取清单', onClick: load, disabled: state.phase === 'loading' })
				),
				h(HubMsg, { msg: state.phase === 'error' ? { ok: false, text: state.error } : msg }),
				state.phase === 'loading' && state.plugins.length === 0 ? h('div', { className: 'vkHubEmpty' }, '加载中…')
					: list.length === 0 ? h('div', { className: 'vkHubEmpty' }, state.phase === 'error' ? '拉取失败（原因见上）' : '没有匹配的插件')
						: h('div', { className: 'vkHubList' }, list.map((p, i) => {
							const spec = specOf(p);
							return h('div', { key: nameOf(p) + '#' + i, className: 'vkHubRow' },
								h('div', { className: 'vkHubRowMain' },
									h('div', { className: 'vkHubRowName' }, nameOf(p)),
									h('div', { className: 'vkHubRowMeta' }, descOf(p) || spec || '—')
								),
								spec.length === 0 ? null : h(HubBtn, { name: 'install', title: '安装 ' + spec, disabled: busy !== '', onClick: () => install(spec) })
							);
						}))
			);
		}

		/** 启停管理：读写 profile 的 cordis.patch.yml，官方基础插件不可关。 */
		function VKToggleTab() {
			const [rows, setRows] = react.useState(null);
			const [busy, setBusy] = react.useState('');
			const [msg, setMsg] = react.useState(null);
			const load = react.useCallback(() => {
				fetch('/dsh-hub/plugins').then((r) => r.json())
					.then((d) => { if (d && d.ok === true) setRows(d.plugins); else setMsg({ ok: false, text: (d && d.error) || '读不到插件清单' }); })
					.catch((e) => setMsg({ ok: false, text: String(e) }));
			}, []);
			react.useEffect(load, [load]);
			const flip = (row) => {
				setBusy(row.id);
				setMsg(null);
				hubPost('/dsh-hub/plugins/toggle', { id: row.id, disabled: row.disabled !== true })
					.then((d) => {
						setBusy('');
						if (d && d.ok === true) { setMsg(d.changed === true ? { ok: true, text: '已改，重启后生效' } : null); load(); }
						else setMsg({ ok: false, text: (d && d.error) || '写入失败' });
					})
					.catch((e) => { setBusy(''); setMsg({ ok: false, text: String(e) }); });
			};
			return h('div', { className: 'vkHubPane' },
				h('div', { className: 'vkHubBar' },
					h('div', { style: { flex: 1 } }),
					h(HubBtn, { name: 'refresh', title: '刷新', onClick: load, disabled: busy !== '' })
				),
				h(HubMsg, { msg }),
				rows === null ? h('div', { className: 'vkHubEmpty' }, '加载中…')
					: rows.length === 0 ? h('div', { className: 'vkHubEmpty' }, '没有可管理的插件')
						: h('div', { className: 'vkHubList' }, rows.map((row) => h('div', { key: row.id, className: 'vkHubRow' },
							h('span', { className: 'vkHubDot' + (row.disabled === true ? '' : ' vkHubDotOn'), title: row.disabled === true ? '已停用' : '运行中' }),
							h('div', { className: 'vkHubRowMain' },
								h('div', { className: 'vkHubRowName' }, row.id),
								h('div', { className: 'vkHubRowMeta' }, row.base === true ? '基础插件（不可关）' : (row.disabled === true ? '已停用' : '运行中'))
							),
							h(HubBtn, {
								name: 'power',
								title: row.base === true ? '基础插件不可关闭' : (row.disabled === true ? '启用' : '停用'),
								tone: row.disabled === true ? 'accent' : undefined,
								disabled: row.base === true || busy === row.id,
								onClick: () => flip(row)
							})
						)))
			);
		}

		/** 已归档会话 · ZIP 归档：读 /dsh-archive/list，恢复走 restore-dsh-session.ps1。 */
		function VKArchiveZipPane() {
			const [state, setState] = react.useState({ phase: 'loading', entries: [], error: null });
			const [busy, setBusy] = react.useState('');
			const [msg, setMsg] = react.useState(null);
			const load = react.useCallback(() => {
				setState({ phase: 'loading', entries: [], error: null });
				fetch('/dsh-archive/list').then((r) => r.json())
					.then((d) => {
						if (d && d.ok === true) setState({ phase: 'ready', entries: d.entries, error: null });
						else setState({ phase: 'error', entries: [], error: (d && d.error) || '归档清单读不到' });
					})
					.catch((e) => setState({ phase: 'error', entries: [], error: String(e) }));
			}, []);
			react.useEffect(load, [load]);
			const restore = (entry) => {
				setBusy(entry.path);
				setMsg(null);
				hubPost('/dsh-archive/restore', { id: entry.id })
					.then((d) => {
						setBusy('');
						if (d && d.ok === true) { setMsg({ ok: true, text: '已恢复 ' + entry.id }); load(); }
						else setMsg({ ok: false, text: (d && d.error) || ('恢复失败（exit ' + (d && d.exitCode) + '）') });
					})
					.catch((e) => { setBusy(''); setMsg({ ok: false, text: String(e) }); });
			};
			const sizeOf = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
			return h('div', { className: 'vkHubPane' },
				h('div', { className: 'vkHubBar' },
					h('div', { style: { flex: 1 } }),
					h(HubBtn, { name: 'refresh', title: '刷新', onClick: load, disabled: state.phase === 'loading' })
				),
				h(HubMsg, { msg: state.phase === 'error' ? { ok: false, text: state.error } : msg }),
				state.phase === 'loading' ? h('div', { className: 'vkHubEmpty' }, '加载中…')
					: state.entries.length === 0 ? h('div', { className: 'vkHubEmpty' }, '归档目录里没有 zip')
						: h('div', { className: 'vkHubList' }, state.entries.map((e) => h('div', { key: e.path, className: 'vkHubRow' },
							h('span', { className: 'vkHubDot' + (e.restored === true ? ' vkHubDotOn' : ''), title: e.restored === true ? '已在会话目录里' : '未恢复' }),
							h('div', { className: 'vkHubRowMain' },
								h('div', { className: 'vkHubRowName' }, e.id),
								h('div', { className: 'vkHubRowMeta' }, e.workspace + ' · ' + e.month + ' · ' + sizeOf(e.size))
							),
							h(HubBtn, { name: 'restore', title: '恢复到会话', disabled: busy !== '' || e.restored === true, onClick: () => restore(e) })
						)))
			);
		}

		/* ── 组件：只做挂载时的接管与默认落点，正文交还官方 shell ── */
		function VKSettingsHub() {
			const ref = react.useRef(null);
			react.useEffect(() => {
				const marker = ref.current;
				if (!marker) return undefined;
				attach(marker);
				/* 面板默认落在本中枢这一页（order 最小）：立刻交还给「通用设置」 */
				const active = activeId();
				if (active === HUB_ID || active === null) select(DEFAULT_ID);
				return undefined;
			}, []);
			return h('div', { ref, style: { display: 'none' }, 'data-vk-hub': 'anchor' });
		}

		function apply(ctx) {
			ctxRef.current = ctx;
			/* 非默认落点打开的设置面板（官方 onboarding 的 openSection）也要接管左栏 */
			if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
				const observer = new MutationObserver(() => {
					if (dom.box !== null && dom.box.isConnected) return;
					try { attach(null); } catch { /* 面板结构未就绪时下一批再来 */ }
				});
				observer.observe(document.body, { childList: true, subtree: true });
				ctx.effect(() => () => { try { observer.disconnect(); } catch { /* ignore */ } }, 'dsh-vk-settings-hub: nav observer');
			}
			ctx.effect(() => () => teardown(), 'dsh-vk-settings-hub: nav teardown');
			ctx.slots.inject('settings.section', () => {
				const off = ctx.slots.subscribe('settings.section', () => { try { paint(); } catch { /* ignore */ } });
				return () => { try { off(); } catch { /* ignore */ } };
			});
			ctx.slots.inject('settings.section', () => ctx.slots.register({
				name: 'settings.section',
				id: HUB_ID,
				order: HUB_ORDER,
				priority: HUB_PRIORITY,
				label: '设置'
			}, VKSettingsHub));
			/* 插件页：官方 plugins 分区照旧，我们额外挂两个 tab */
			ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
				name: 'settings.plugins.tab',
				id: 'market',
				order: 20,
				label: '插件市场'
			}, VKMarketTab));
			ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
				name: 'settings.plugins.tab',
				id: 'toggle',
				order: 30,
				label: '启停管理'
			}, VKToggleTab));
			/* 已归档会话 · ZIP 归档（软归档仍是官方那页，两页同挂一个导航项） */
			ctx.slots.inject('settings.section', () => ctx.slots.register({
				name: 'settings.section',
				id: 'archive-zip',
				order: 26,
				label: 'ZIP 归档'
			}, VKArchiveZipPane));
		}

		exports.apply = apply;
		exports.inject = ['slots'];
		return module.exports;
	}
});
