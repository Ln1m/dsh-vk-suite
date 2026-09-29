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
			/* 已归档会话：1.7 没有官方软归档分区，只剩我们的 ZIP 页 → 不再分「软归档 / ZIP归档」两级 */
			{ id: 'archive-zip', label: '已归档会话', glyph: 'archived' },
			{ id: 'mcp', label: 'MCP 管理', glyph: 'mcp' },
			/* 记忆系统不进设置页（用户口径 2026-09-29）：mnemon 自己没有设置分区，
			   以前这里那一条点了只会把它的面板开到中栏，不如不放。 */
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
.vkHubDotErr{background:#f14c4c}
.vkHubChips{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.vkHubChip{flex:none;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;line-height:16px;padding:0 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
.vkHubChipDanger{color:#f14c4c;border-color:rgba(241,76,76,.35)}
.vkHubChipAccent{color:var(--dsw-alias-state-business-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 35%,transparent)}
.vkHubSort{flex:none;display:flex;align-items:center;gap:4px}
.vkHubMore{font-size:11.5px;color:var(--dsw-alias-label-tertiary);padding:2px 0;text-align:center}
.vkHubRowOpen{cursor:pointer}
.vkHubDetail{border:1px solid var(--dsw-alias-border-l1);border-top:none;border-radius:0 0 8px 8px;padding:10px 12px;background:var(--dsw-specific-sidebar-fill);display:flex;flex-direction:column;gap:8px}
.vkHubDetailRow{display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-secondary);align-items:baseline}
.vkHubDetailKey{color:var(--dsw-alias-label-tertiary)}
.vkHubDesc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary)}
.vkHubDescEn{font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.vkHubRed{font-size:11.5px;line-height:17px;color:#f14c4c}
.vkHubShots{display:flex;gap:8px;flex-wrap:wrap}
.vkHubShot{height:96px;max-width:220px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);cursor:pointer;object-fit:cover}
.vkHubGroup{display:flex;align-items:center;gap:8px;padding:2px 2px;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:12px}
.vkHubGroup:hover{color:var(--dsw-alias-label-primary)}
.vkHubGroupN{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}
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
			if (found === null) {
				// 官方没有这一页（例如 1.7 里连「已归档会话」的软归档分区都不在了）：
				// 落到它存在的子页（ZIP 归档）。不这么做就只会空转重试，用户看到的是「打不开还卡」。
				const model = NAV_MODEL.find((item) => item.id === id);
				if (model !== undefined && Array.isArray(model.subs)) {
					for (const sub of model.subs) {
						if (sub.id === id) continue;
						const subBtn = Array.from(list.children).find((b) => b.getAttribute('data-vk-row') === sub.id);
						if (subBtn !== undefined) {
							dom.want = sub.id;
							subBtn.click();
							paint();
							scheduleFrame();
							return true;
						}
					}
				}
				dom.pending = id; scheduleFrame(); return false;
			}
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
					else if (dom.tries <= 8) dom.pending = pending;
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

			const model = NAV_MODEL.filter((item) => present.has(item.id) || item.reserved === true || (item.subs !== undefined && item.subs.some((s) => present.has(s.id))));
			const known = new Set();
			for (const item of model) {
				known.add(item.id);
				if (item.subs !== undefined) for (const sub of item.subs) known.add(sub.id);
			}
			// 1.7 已经没有官方的「软归档」分区（只剩我们的 ZIP 页）：万一还有残留行，
			// 折进「已归档会话」这一项里，不要在左栏多出一行裸 id。
			known.add('archived-sessions');
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
				btn.addEventListener('click', () => {
					select(item.id);
				});
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

		/* ── 设置页正文：插件市场 / 全局启停 / ZIP 归档 ── */
		const UI = {
			refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
			search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
			install: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
			power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
			restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
			star: '<path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z"/>',
			clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
			asc: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
			desc: '<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
			copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
			repo: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
			warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>'
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
		function HubChip({ text, tone, title }) {
			const cls = 'vkHubChip' + (tone === 'danger' ? ' vkHubChipDanger' : tone === 'accent' ? ' vkHubChipAccent' : '');
			return h('span', { className: cls, title: title === undefined ? text : title }, text);
		}
		function copyText(text) {
			const clip = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
			if (clip === undefined || clip === null || typeof clip.writeText !== 'function') return Promise.reject(new Error('剪贴板不可用'));
			return clip.writeText(text);
		}
		/** 官方 moduleShortName 的同一条规则（@scope/ 与 cordis-plugin- / dsh- 前缀都剥掉）。 */
		function moduleShortName(moduleName) {
			const name = String(moduleName || '');
			const base = name.indexOf('@') === 0 ? name.slice(name.indexOf('/') + 1) : name;
			return base.replace(/^cordis:/, '').replace(/^cordis-plugin-/, '').replace(/^dsh-(?:host-|client-)?/, '') || name;
		}
		function hubPost(path, payload) {
			return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => r.json());
		}

		/* 外链的去处按可用性排，一律不弹外壳悬浮窗：
		   ① 我们那只右栏浏览器（dsh-embedded-browser）——面板挂载期间留了全局把手，拿到就直接导航
		      （它是外壳的原生 WebView2 子控件，github 这类 X-Frame-Options 禁 iframe 的站也只有它能开）；
		   ② 面板没挂着就请右栏把那一页打开，再多等几帧（面板是异步挂载的）；
		   ③ 我们的包不在（openTab 会抛「没有类型认领」）→ 走官方「浏览器」页
		      ——@deepseek-ai/dsh-client-ui-sidebar-browser，kind=browser，初始地址从 tab.navigation.params.url 进；
		   ④ 三条都不通才什么都不开，调用方把地址留在详情里让人自己复制。 */
		const EMBED_KIND = 'dsh-embedded-browser';
		const OFFICIAL_BROWSER_KIND = 'browser';
		const EMBED_WAIT_FRAMES = 20;
		function paneOpener() {
			const w = typeof window === 'undefined' ? undefined : window;
			const hook = w === undefined ? undefined : w.__DSH_EMBED_OPEN__;
			return typeof hook === 'function' ? hook : null;
		}
		function sidebarRight() {
			try {
				const ctx = ctxRef.current;
				const right = ctx === null || ctx === undefined ? null : ctx.get('sidebarRight');
				return right !== null && right !== undefined && typeof right.openTab === 'function' ? right : null;
			} catch { return null; }
		}
		/** openTab 对没注册的类型是抛错，不是返回失败：用它当「这个包在不在」的探针。 */
		function openTabSafely(right, kind, options) {
			if (right === null) return false;
			try { right.openTab(kind, options); return true; } catch { return false; }
		}
		function openInPane(url) {
			const hook = paneOpener();
			if (hook !== null) {
				try { hook(url); return Promise.resolve(true); } catch { /* 落到下面的等待 */ }
			}
			const right = sidebarRight();
			if (!openTabSafely(right, EMBED_KIND)) {
				return Promise.resolve(openTabSafely(right, OFFICIAL_BROWSER_KIND, { params: { url } }));
			}
			return new Promise((resolve) => {
				let left = EMBED_WAIT_FRAMES;
				const tick = () => {
					const fn = paneOpener();
					if (fn !== null) {
						try { fn(url); resolve(true); } catch { resolve(false); }
						return;
					}
					left -= 1;
					if (left > 0) { setTimeout(tick, 150); return; }
					resolve(openTabSafely(right, OFFICIAL_BROWSER_KIND, { params: { url } }));
				};
				setTimeout(tick, 150);
			});
		}

		/* 清单实测字段（2026-09-29，4382 条）：{name, owner, url, page, category, description:{en,zh}, npm, version,
		   stars, downloads, added, capabilities, capabilityRedLines, install, tarball}——没有 spec，没有更新时间戳
		   （只有收录日期 added），description 是对象。 */
		const MARKET_SORTS = [
			{ key: 'stars', glyph: 'star', label: '星标' },
			{ key: 'downloads', glyph: 'install', label: '下载' },
			{ key: 'installs', glyph: 'boost', label: '安装数' },
			{ key: 'updated', glyph: 'clock', label: '更新' }
		];
		/* 4382 行一次性铺进 DOM 会把设置面板拖住：只画前 200 行，其余靠搜索缩。 */
		const MARKET_MAX_ROWS = 200;

		/** 插件市场：清单来自 host 侧转发（外网），装走 dsh plugin add。 */
		function VKMarketTab() {
			const [state, setState] = react.useState({ phase: 'loading', plugins: [], error: null, fetchedAt: null, cached: false, refreshing: false, sources: [], categories: {} });
			const [query, setQuery] = react.useState('');
			const [busy, setBusy] = react.useState('');
			const [msg, setMsg] = react.useState(null);
			const [sort, setSort] = react.useState({ key: null, dir: 'desc' });
			const [openKey, setOpenKey] = react.useState('');
			const load = react.useCallback(() => {
				/* 加载时不丢已有清单：host 侧有缓存时是秒回，出错也还能看旧的 */
				setState((prev) => Object.assign({}, prev, { phase: 'loading', error: null }));
				fetch('/dsh-hub/market').then((r) => r.json())
					.then((d) => {
						if (d && d.ok === true) {
							setState({ phase: 'ready', plugins: d.plugins, error: d.error || null, fetchedAt: d.fetchedAt || null, cached: d.cached === true, refreshing: d.refreshing === true, sources: Array.isArray(d.sources) ? d.sources : [], categories: d.categories === undefined || d.categories === null ? {} : d.categories });
						} else {
							setState((prev) => Object.assign({}, prev, { phase: 'error', error: (d && d.error) || '市场清单读不到' }));
						}
					})
					.catch((e) => setState((prev) => Object.assign({}, prev, { phase: 'error', error: String(e) })));
			}, []);
			react.useEffect(load, [load]);
			/* 清单 4000+ 条、5MB：把「多少条 / 什么时候拿的 / 是否在后台刷新」摆在标题行上，
			   免得用户以为页面坏了（首拉要几十秒是清单体积决定的，不是网络挂了） */
			const metaText = (matched) => {
				if (state.phase === 'loading' && state.plugins.length === 0) return '拉取中（首次要几十秒）';
				const parts = [matched === state.plugins.length ? state.plugins.length + ' 条' : '匹配 ' + matched + ' / ' + state.plugins.length];
				if (state.fetchedAt !== null) {
					const t = new Date(state.fetchedAt);
					parts.push((state.cached ? '缓存 ' : '更新 ') + (Number.isNaN(t.getTime()) ? state.fetchedAt : String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0')));
				}
				if (state.refreshing) parts.push('后台刷新中');
				return parts.join(' · ');
			};
			/* 安装源取清单自己那条 install 命令的末段（4382/4382 都有，是站点维护的规范写法）：
			   `dsh plugin --profile web add <spec>`，其中 228 条的 URL 带一层引号要剥掉。
			   npm 只在 install 缺失时兜底。 */
			const unquote = (t) => {
				const a = t.charAt(0);
				return t.length >= 2 && (a === '"' || a === "'") && t.charAt(t.length - 1) === a ? t.slice(1, -1) : t;
			};
			const specOf = (p) => {
				if (typeof p.install === 'string' && p.install.trim().length > 0) {
					const m = /\s(\S+)\s*$/.exec(p.install.trim());
					if (m !== null) return unquote(m[1]);
				}
				if (typeof p.npm === 'string' && p.npm.length > 0) return p.npm;
				if (typeof p.tarball === 'string' && p.tarball.length > 0) return p.tarball;
				for (const key of ['spec', 'source', 'repo', 'repository']) {
					if (typeof p[key] === 'string' && p[key].length > 0) return p[key];
				}
				const url = String(p.url || '');
				if (url.length === 0) return '';
				if ((url.indexOf('github.com/') >= 0 || url.indexOf('gitlab.com/') >= 0) && url.indexOf('git+') !== 0) return 'git+' + url;
				return url;
			};
			const commandOf = (p) => {
				if (typeof p.install === 'string' && p.install.trim().length > 0) return p.install.trim();
				const spec = specOf(p);
				return spec.length === 0 ? '' : 'dsh plugin --profile web add ' + spec;
			};
			const nameOf = (p) => String(p.name || p.title || p.id || p.package || '');
			const descOf = (p) => {
				const d = p.description ?? p.desc ?? p.summary ?? '';
				if (typeof d === 'string') return d;
				if (d !== null && typeof d === 'object') return String(d.zh || d.en || '');
				return '';
			};
			const metaOf = (p) => {
				const parts = [];
				if (typeof p.category === 'string' && p.category.length > 0) parts.push(p.category);
				if (typeof p.version === 'string' && p.version.length > 0) parts.push('v' + p.version);
				if (typeof p.stars === 'number') parts.push('★' + p.stars);
				if (typeof p.downloads === 'number' && p.downloads > 0) parts.push('↓' + p.downloads);
				if (typeof p.added === 'string' && p.added.length > 0) parts.push('收录 ' + p.added);
				const d = descOf(p);
				if (d.length > 0) parts.push(d);
				return parts.join(' · ');
			};
			const capsOf = (p) => (Array.isArray(p.capabilities) ? p.capabilities.filter((c) => typeof c === 'string' && c.length > 0) : []);
			const redsOf = (p) => (Array.isArray(p.capabilityRedLines) ? p.capabilityRedLines.filter((c) => typeof c === 'string' && c.length > 0) : []);
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
			const hayOf = (p) => (nameOf(p) + ' ' + descOf(p) + ' ' + String(p.owner || '') + ' ' + String(p.category || '')).toLowerCase();
			const matched = state.plugins.filter((p) => q.length === 0 || hayOf(p).includes(q));
			const metricOf = (p, key) => (p.metrics === undefined || p.metrics === null ? null : p.metrics[key]);
			const sortValueOf = (p, key) => {
				if (key === 'installs') { const v = metricOf(p, 'installs'); return typeof v === 'number' ? v : -1; }
				if (key === 'updated') { const v = metricOf(p, 'updatedAt'); return v === null || v === undefined ? String(p.added || '') : String(v); }
				const v = p[key];
				return typeof v === 'number' ? v : -1;
			};
			const sorted = sort.key === null ? matched : matched.slice().sort((a, b) => {
				const x = sortValueOf(a, sort.key);
				const y = sortValueOf(b, sort.key);
				const c = typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y)) : x - y;
				return c * (sort.dir === 'desc' ? -1 : 1);
			});
			const shown = sorted.slice(0, MARKET_MAX_ROWS);
			const cycleSort = (key) => setSort((s) => (s.key !== key ? { key, dir: 'desc' } : s.dir === 'desc' ? { key, dir: 'asc' } : { key: null, dir: 'desc' }));
			const copyCmd = (text) => {
				setMsg(null);
				copyText(text).then(
					() => setMsg({ ok: true, text: '命令已复制' }),
					(e) => setMsg({ ok: false, text: String((e && e.message) || e) })
				);
			};
			const openRepo = (url) => {
				setMsg(null);
				openInPane(url).then((done) => {
					if (done !== true) setMsg({ ok: false, text: '右栏浏览器没开，地址留在详情里' });
				});
			};
			const categoryLabel = (id) => {
				const found = state.categories[String(id || '')];
				return found === undefined ? String(id || '') : found.zh;
			};
			const sourcesText = () => state.sources.map((s) => s.id + ' ' + (s.ok === true ? s.count + ' 条' : '不可达')).join(' · ');
			/** 展开后的详情：长描述、双语、全部能力与红线、真实度量、截图、动作全在这里。 */
			const detailOf = (p, spec, link, command) => {
				const m = p.metrics === undefined || p.metrics === null ? {} : p.metrics;
				const facts = [];
				const fact = (k, v) => { if (v !== null && v !== undefined && String(v).length > 0) facts.push([k, String(v)]); };
				fact('owner', p.owner);
				fact('分类', categoryLabel(p.category));
				fact('版本', p.version);
				fact('收录', p.added);
				fact('最近推送', m.updatedAt);
				fact('来源', (Array.isArray(p.src) ? p.src : []).join(' + '));
				const numbers = [];
				const n = (k, v) => { if (typeof v === 'number') numbers.push(k + ' ' + v); };
				n('★', typeof p.stars === 'number' ? p.stars : m.stars);
				n('forks', m.forks);
				n('↓', p.downloads);
				n('安装', m.installs);
				n('安装用户', m.users);
				n('近 7 天安装', m.installs7d);
				n('npm 近 7 天下载', m.downloads7d);
				n('安装失败', m.failures);
				const caps = capsOf(p);
				const reds = redsOf(p);
				const shots = (Array.isArray(p.screenshots) ? p.screenshots : []).filter((s) => typeof s === 'string' && /^https?:\/\//.test(s)).slice(0, 3);
				const english = p.description !== null && typeof p.description === 'object' && typeof p.description.en === 'string' && p.description.en.length > 0 ? p.description.en : '';
				return h('div', { className: 'vkHubDetail' },
					h('div', { className: 'vkHubDesc' }, descOf(p) || '没有描述'),
					english === '' || english === descOf(p) ? null : h('div', { className: 'vkHubDescEn' }, english),
					facts.length === 0 ? null : h('div', { className: 'vkHubDetailRow' }, facts.map(([k, v]) => h('span', { key: k }, h('span', { className: 'vkHubDetailKey' }, k + ' '), v))),
					numbers.length === 0 ? null : h('div', { className: 'vkHubDetailRow' }, numbers.map((t) => h('span', { key: t }, t))),
					caps.length === 0 ? null : h('div', { className: 'vkHubChips' }, caps.map((c) => h(HubChip, { key: 'd-' + c, text: c, title: '能力：' + c }))),
					reds.length === 0 ? null : h('div', { className: 'vkHubRed' }, '红线：' + reds.join('；')),
					shots.length === 0 ? null : h('div', { className: 'vkHubShots' }, shots.map((s) => h('img', { key: s, className: 'vkHubShot', src: s, alt: '截图', loading: 'lazy', title: '在拓展栏浏览器打开', onClick: () => openRepo(s) }))),
					h('div', { className: 'vkHubSort' },
						link.length > 0 ? h(HubBtn, { key: 'repo', name: 'repo', title: '在拓展栏浏览器打开 ' + link, onClick: () => openRepo(link) }) : null,
						command.length > 0 ? h(HubBtn, { key: 'cmd', name: 'copy', title: '复制安装命令', onClick: () => copyCmd(command) }) : null,
						spec.length > 0 ? h('span', { key: 'spec', className: 'vkHubDetailKey', style: { userSelect: 'text', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: '在官方「添加插件」里粘贴：' + spec }, spec) : null,
						link.length > 0 ? h('span', { key: 'url', className: 'vkHubDetailKey', style: { userSelect: 'text', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: link }, link) : null
					)
				);
			};
			const chipsOf = (p) => {
				const caps = capsOf(p);
				const reds = redsOf(p);
				const chips = caps.slice(0, 5).map((c) => h(HubChip, { key: 'c-' + c, text: c, title: '能力：' + c }));
				if (caps.length > 5) chips.push(h(HubChip, { key: 'c-more', text: '+' + (caps.length - 5) }));
				if (reds.length > 0) chips.push(h(HubChip, { key: 'c-red', text: '⚠ ' + reds.length + ' 红线', tone: 'danger', title: reds.join('\n') }));
				return chips.length === 0 ? null : h('div', { className: 'vkHubChips' }, chips);
			};
			return h('div', { className: 'vkHubPane' },
				h('div', { className: 'vkHubBar' },
					h('input', { className: 'vkHubInput', value: query, placeholder: '搜索', onChange: (e) => setQuery(e.target.value), spellCheck: false }),
					h('div', { className: 'vkHubSort' }, MARKET_SORTS.map((s) => {
						const on = sort.key === s.key;
						return h(HubBtn, {
							key: s.key,
							name: on ? (sort.dir === 'desc' ? 'desc' : 'asc') : s.glyph,
							tone: on ? 'accent' : undefined,
							title: on ? '按' + s.label + (sort.dir === 'desc' ? '降序（再点升序，再点取消）' : '升序（再点取消）') : '按' + s.label + '降序',
							onClick: () => cycleSort(s.key)
						});
					})),
					h('div', { className: 'vkHubRowMeta', style: { flex: 'none' }, title: '清单来源：' + sourcesText() }, metaText(matched.length)),
					h(HubBtn, { name: 'refresh', title: '重新拉取清单', onClick: load, disabled: state.phase === 'loading' })
				),
				h(HubMsg, { msg: state.phase === 'error' ? { ok: false, text: state.error } : msg }),
				state.phase === 'loading' && state.plugins.length === 0 ? h('div', { className: 'vkHubEmpty' }, '加载中…')
					: shown.length === 0 ? h('div', { className: 'vkHubEmpty' }, state.phase === 'error' ? '拉取失败（原因见上）' : '没有匹配的插件')
						: h('div', null,
							h('div', { className: 'vkHubList' }, shown.map((p, i) => {
								const spec = specOf(p);
								const link = String(p.url || p.page || '');
								const command = commandOf(p);
								const key = (String(p.owner || '') + '/' + nameOf(p) + '/' + String(p.url || '')).toLowerCase();
								const open = openKey === key;
								const toggle = (e) => { if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); setOpenKey(open ? '' : key); };
								return h('div', { key: key + '#' + i },
									h('div', { className: 'vkHubRow vkHubRowOpen', onClick: toggle },
										h(HubBtn, { name: open ? 'down' : 'right', title: open ? '收起详情' : '展开详情', onClick: toggle }),
										h('div', { className: 'vkHubRowMain' },
											h('div', { className: 'vkHubRowName' }, nameOf(p)),
											h('div', { className: 'vkHubRowMeta' }, metaOf(p) || spec || '—'),
											chipsOf(p)
										),
										link.length === 0 ? null : h(HubBtn, { name: 'repo', title: '在拓展栏浏览器打开 ' + link, onClick: (e) => { if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); openRepo(link); } }),
										spec.length === 0 ? null : h(HubBtn, { name: 'copy', title: '复制包名 ' + spec, onClick: (e) => { if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); copyText(spec).then(() => setMsg({ ok: true, text: '已复制包名：' + spec }), (err) => setMsg({ ok: false, text: String(err) })); } })
									),
									open ? detailOf(p, spec, link, command) : null
								);
							})),
							sorted.length > shown.length ? h('div', { className: 'vkHubMore' }, '只画前 ' + MARKET_MAX_ROWS + ' 条（共 ' + sorted.length + ' 条，用搜索缩小）') : null
						)
			);
		}

		/**
		 * 全局启停：与本插件「插件列表」的全局插件组同一批行（Loader 的 entryId 就是 patch 行的 id），
		 * 每行两条轴——Loader 运行态只读、patch 层启停态可写。会话层（agentPresets 的 rows）不在这里
		 * 冒充全局行，只在被预设提供的模块上打一个只读标记。
		 */
		function VKToggleTab() {
			const [state, setState] = react.useState({ phase: 'loading', rows: [], loader: null, error: null });
			const [busy, setBusy] = react.useState('');
			const [msg, setMsg] = react.useState(null);
			const [query, setQuery] = react.useState('');
			const [closed, setClosed] = react.useState({ bundle: true, official: true, orphan: true });
			const load = react.useCallback(() => {
				setState((prev) => Object.assign({}, prev, { phase: 'loading', error: null }));
				fetch('/dsh-hub/plugins').then((r) => r.json())
					.then((d) => {
						if (d && d.ok === true && Array.isArray(d.rows)) setState({ phase: 'ready', rows: d.rows, loader: d.loader || null, error: null });
						else setState({ phase: 'error', rows: [], loader: null, error: (d && d.error) || '读不到插件清单' });
					})
					.catch((e) => setState({ phase: 'error', rows: [], loader: null, error: String(e) }));
			}, []);
			react.useEffect(load, [load]);
			const flip = (row) => {
				setBusy(row.id);
				setMsg(null);
				hubPost('/dsh-hub/plugins/toggle', { id: row.id, disabled: row.patchDisabled !== true })
					.then((d) => {
						setBusy('');
						if (d && d.ok === true) { setMsg(d.changed === true ? { ok: true, text: '已改，重启后生效' } : null); load(); }
						else setMsg({ ok: false, text: (d && d.error) || '写入失败' });
					})
					.catch((e) => { setBusy(''); setMsg({ ok: false, text: String(e) }); });
			};
			const q = query.trim().toLowerCase();
			const rows = state.rows.filter((r) => q.length === 0 || (r.id + ' ' + r.module).toLowerCase().includes(q));
			const stats = state.rows.reduce((acc, r) => {
				if (r.phase === 'failed') acc.failed += 1;
				else if (r.loaderEnabled === true) acc.on += 1;
				else if (r.loaderEnabled === false) acc.off += 1;
				if (r.patchDisabled === true && r.loaderEnabled === true) acc.pending += 1;
				return acc;
			}, { on: 0, off: 0, failed: 0, pending: 0 });
			const loaderText = (r) => {
				if (r.loaderEnabled === null) return '不在 Loader 里';
				if (r.phase === 'failed') return '加载失败';
				if (r.loaderEnabled === false) return 'Loader 已停用';
				return 'Loader 运行中' + (r.phase === null || r.phase === 'active' ? '' : ' · ' + r.phase);
			};
			const patchText = (r) => {
				if (r.patchDisabled === true) return r.loaderEnabled === true ? 'patch 已停用 · 待重启' : 'patch 已停用';
				if (r.patchPresent === true) return 'patch 已写（启用）';
				return 'patch 无此行';
			};
			const chipsOf = (r) => {
				const chips = [];
				if (r.presets.length > 0) chips.push(h(HubChip, { key: 'preset', text: '由预设提供：' + r.presets.join(' · '), tone: 'accent', title: '由 Agent 预设按会话提供，去「插件列表」看会话层' }));
				if (r.patchDisabled === true && r.loaderEnabled === true) chips.push(h(HubChip, { key: 'pending', text: '待重启生效', tone: 'danger' }));
				if (r.orphan === true) chips.push(h(HubChip, { key: 'orphan', text: 'Loader 里没有此行', tone: 'danger' }));
				if (r.base === true) chips.push(h(HubChip, { key: 'base', text: '基础插件' }));
				return chips.length === 0 ? null : h('div', { className: 'vkHubChips' }, chips);
			};
			const summary = [
				state.rows.length + ' 行',
				'运行 ' + stats.on,
				'停用 ' + stats.off,
				stats.failed > 0 ? '失败 ' + stats.failed : null,
				stats.pending > 0 ? '待重启 ' + stats.pending : null,
				state.loader === null ? '拿不到 Loader 快照' : null
			].filter((x) => x !== null).join(' · ');
			const rowOf = (r) => {
				const dot = r.phase === 'failed' ? ' vkHubDotErr' : r.loaderEnabled === true ? ' vkHubDotOn' : '';
				const locked = r.base === true || r.presets.length > 0;
				const short = moduleShortName(r.module);
				const title = short.length > 0 && short !== r.id ? short + '  ' + r.id : r.id;
				return h('div', { key: r.id, className: 'vkHubRow' },
					h('span', { className: 'vkHubDot' + dot, title: loaderText(r) }),
					h('div', { className: 'vkHubRowMain' },
						h('div', { className: 'vkHubRowName' }, title),
						h('div', { className: 'vkHubRowMeta' }, loaderText(r) + ' · ' + patchText(r)),
						chipsOf(r)
					),
					h(HubBtn, {
						name: 'power',
						title: r.base === true ? '基础插件不可关闭' : r.presets.length > 0 ? '由 Agent 预设按会话提供，去「插件列表」看会话层' : r.patchDisabled === true ? '撤掉 patch 停用（重启后启用）' : '在 patch 层停用（重启后生效）',
						tone: r.patchDisabled === true ? 'accent' : undefined,
						disabled: locked || busy === r.id,
						onClick: () => flip(r)
					})
				);
			};
			/* 分类就是「这行是从哪来的」：自己装的、bundle 带进来的、官方基础、patch 里多出来的。
			   默认只展开「本 profile 装的」——那是真正会去关的那批。 */
			const isOfficial = (r) => String(r.module || '').indexOf('@deepseek-ai/') === 0;
			const GROUPS = [
				{ id: 'profile', label: '本 profile 装的', glyph: 'plugins', pick: (r) => r.orphan !== true && r.installed === true },
				{ id: 'official', label: '官方基础插件', glyph: 'gear', pick: (r) => r.orphan !== true && r.installed !== true && isOfficial(r) },
				{ id: 'bundle', label: 'bundle 带进来的', glyph: 'extra', pick: (r) => r.orphan !== true && r.installed !== true && !isOfficial(r) },
				{ id: 'orphan', label: 'patch 里多出来的行', glyph: 'warn', pick: (r) => r.orphan === true }
			];
			const searching = q.length > 0;
			const groupStats = (list) => list.reduce((acc, r) => {
				if (r.phase === 'failed') acc.failed += 1;
				else if (r.loaderEnabled === true) acc.on += 1;
				if (r.patchDisabled === true && r.loaderEnabled === true) acc.pending += 1;
				return acc;
			}, { on: 0, pending: 0, failed: 0 });
			return h('div', { className: 'vkHubPane' },
				h('div', { className: 'vkHubBar' },
					h('input', { className: 'vkHubInput', value: query, placeholder: '搜索', onChange: (e) => setQuery(e.target.value), spellCheck: false }),
					h('div', { className: 'vkHubRowMeta', style: { flex: 'none' }, title: state.loader === null ? 'Loader 快照不可用' : 'Loader 快照来源：' + state.loader }, summary),
					h(HubBtn, { name: 'refresh', title: '刷新', onClick: load, disabled: busy !== '' })
				),
				h(HubMsg, { msg: state.phase === 'error' ? { ok: false, text: state.error } : msg }),
				state.phase === 'loading' && state.rows.length === 0 ? h('div', { className: 'vkHubEmpty' }, '加载中…')
					: rows.length === 0 ? h('div', { className: 'vkHubEmpty' }, state.phase === 'error' ? '读不到插件清单' : '没有匹配的插件')
						: h('div', { className: 'vkHubList' }, GROUPS.map((group) => {
							const list = rows.filter(group.pick);
							if (list.length === 0) return null;
							const shut = closed[group.id] === true && !searching;
							const gs = groupStats(list);
							return h('div', { key: group.id },
								h('div', { className: 'vkHubGroup', title: shut ? '展开' : '收起', onClick: () => setClosed((c) => Object.assign({}, c, { [group.id]: !c[group.id] })) },
									h(HubIcon, { name: shut ? 'right' : 'down', size: 12 }),
									h('span', null, group.label),
									h('span', { className: 'vkHubGroupN' }, list.length + ' 行 · 运行 ' + gs.on + (gs.pending > 0 ? ' · 待重启 ' + gs.pending : '') + (gs.failed > 0 ? ' · 失败 ' + gs.failed : ''))
								),
								shut ? null : h('div', { className: 'vkHubList' }, list.map(rowOf))
							);
						}))
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
				label: '全局启停'
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
