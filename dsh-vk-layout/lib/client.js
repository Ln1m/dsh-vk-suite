// dsh-vk-layout — 3栏layout 骨架：区域映射到官方插槽的宿主条目 + 标签条渲染。业务不在这里。
// 未接线区域：bottom（由 dsh-vk-cmdstrip 自带 DOM 宿主）、statusbar（官方无对应槽位）。
window.__ModuleLoader__.load({
	id: 'dsh-vk-layout',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

		const react = require('react');
		const contract = require('dsh-vk-contract');
		const h = react.createElement;

		const VK = contract.VK;
		const VK_PANES = contract.VK_PANES;
		const VK_SLOT_TABLE = contract.VK_SLOT_TABLE;
		const VK_SERVICE = contract.VK_SERVICE;

		/** 注册组件运行在框架渲染树里，拿不到 apply 的闭包 —— 与旧实现同款模块级把手。 */
		const ctxRef = { current: null };

		/* ── 图标（内联 SVG，禁 emoji） ────────────────────────────── */
		const ICONS = {
			menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
			folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
			tasks: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
			gear: '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
			panelRight: '<rect x="2" y="3" width="20" height="18" rx="3"/><line x1="14" y1="3" x2="14" y2="21"/>',
			chevronLeft: '<path d="m15 18-6-6 6-6"/>',
			chevronDown: '<path d="m6 9 6 6 6-6"/>',
			chevronRight: '<path d="m9 18 6-6-6-6"/>',
			close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
			file: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/>',
			edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
			image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
			terminal: '<path d="m4 17 6-5-6-5"/><path d="M12 19h8"/>'
		};
		function VIcon({ name, size = 14 }) {
			const d = ICONS[name];
			if (!d) return null;
			return h("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", style: { flex: "none", display: "block" }, dangerouslySetInnerHTML: { __html: d } });
		}
		/** 栏目 id → 图标名。表里没登记 id 的用 file 兜底。 */
		const PANE_GLYPH = {
			sessions: "menu", files: "folder", tasks: "tasks", extensions: "gear",
			viewer: "image", tools: "gear",
			persona: "edit", skills: "tasks", mcp: "gear", extra: "file"
		};

		/* ── 样式 ─────────────────────────────────────────────────── */
		const CSS = [
			":root,body{--vk-accent:var(--dsw-alias-accent,var(--dsw-alias-state-business-primary));--vk-accent-ring:color-mix(in srgb,var(--vk-accent) 22%,transparent);--vk-accent-soft:color-mix(in srgb,var(--vk-accent) 12%,transparent)}",
			".vk_areaHost{width:100%;height:100%;display:flex;flex-direction:column;min-height:0}",
			".vk_paneStack{position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}",
			".vk_paneSlot{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden}",
			".vk_paneSlot:not(.vk_paneSlotActive){display:none}",
			".vk_tabBar{display:flex;align-items:stretch;flex:none;min-width:0;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-sidebar-fill);container-type:inline-size}",
			".vk_tabBtn{appearance:none;border:none;background:none;cursor:pointer;color:var(--dsw-alias-label-secondary);padding:7px 12px;font-size:12px;line-height:16px;font-family:inherit;position:relative;border-bottom:2px solid transparent;transition:color .12s,background-color .12s,border-color .12s;display:inline-flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap}",
			".vk_tabBtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".vk_tabBtnActive{color:var(--dsw-alias-label-primary);border-bottom-color:var(--vk-accent)}",
			".vk_tabGlyph{display:none;flex:none}",
			".vk_tabText{white-space:nowrap}",
			"@container (width<=264px){.vk_tabBtn{padding:7px 8px}.vk_tabText{display:none}.vk_tabGlyph{display:inline-flex;align-items:center}}",
			".vk_tabBarSpacer{flex:1}",
			".vk_tabBtnIcon{width:26px;padding:0;justify-content:center}",
			".vk_rail{display:flex;flex-direction:column;align-items:center;padding:10px 0;gap:4px}",
			".vk_railBtn{appearance:none;border:none;background:none;cursor:pointer;box-sizing:border-box;padding:0;margin:0;line-height:1;width:38px;height:38px;border-radius:9px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;justify-content:center;position:relative;transition:background-color .12s,color .12s,transform .08s}",
			".vk_railBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".vk_railBtn:active{transform:scale(.93)}",
			".vk_railBtnActive{background:var(--vk-accent-soft);color:var(--vk-accent)}",
			".vk_railBtnActive::before{content:'';position:absolute;left:-9px;top:9px;bottom:9px;width:3px;border-radius:2px;background:var(--vk-accent)}",
			".vk_paneBody{display:flex;flex-direction:column;min-height:0;height:100%;width:100%;flex:1 1 auto;overflow:hidden}",
			".vk_seatHost{display:flex;align-items:center;gap:4px;min-width:0}",
			".vk_seatBody{display:flex;flex-direction:column;min-height:0;height:100%;flex:1 1 auto;overflow:auto}",
			// 输入框上方整宽一行（官方 conversation.input.dock）的宿主：整宽块，内容自己决定高度，
			// 展开的技能档抽屉把下面的输入卡片往下推，不会被 scrollBody 的 overflow:auto 裁掉。
			".vk_dockHost{display:block;width:100%;min-width:0;overflow:visible}",
			".vk_empty{padding:32px 20px;font-size:12.5px;line-height:2;color:var(--dsw-alias-label-tertiary);text-align:center;white-space:pre-wrap}",
			".vk_tabBtn:focus-visible,.vk_railBtn:focus-visible{outline:2px solid var(--vk-accent-ring);outline-offset:-2px}",
			".vk_seatRow{display:flex;flex-direction:column;align-items:stretch;gap:0;flex:none}",
			".vk_seatSlot{display:flex;flex-direction:column;align-items:stretch;min-width:0;width:100%}",
			".vk_seatToggle{appearance:none;border:none;background:none;cursor:pointer;box-sizing:border-box;padding:0;margin:0;line-height:1;width:28px;height:28px;border-radius:7px;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;transition:background-color .12s,color .12s}",
			".vk_seatToggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".vk_seatToggleOn{color:var(--vk-accent)}",
			".vk_tabTail{display:flex;align-items:center;gap:2px;padding-right:4px}",
			".vk_brandSlot{display:inline-flex;align-items:center;flex:none}",
			".vk_brandBtn{appearance:none;border:none;background:none;cursor:pointer;box-sizing:border-box;padding:0;margin:0;line-height:1;width:28px;height:28px;border-radius:50%;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;flex:none;transition:background-color .12s,color .12s,transform .08s}",
			".vk_brandBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".vk_brandBtn:active{transform:scale(.93)}",
			".vk_brandBtnOn{color:var(--vk-accent)}"
		].join("");
		(function injectCss() {
			if (typeof document === "undefined") return;
			const plugin = "dsh-vk-layout";
			for (const old of document.querySelectorAll('style[data-plugin="' + plugin + '"]')) { try { old.remove(); } catch { /* ignore */ } }
			const tag = document.createElement("style");
			tag.dataset.plugin = plugin;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		})();

		/* ── 布局状态：区域 → 激活栏目 id（跨区域共享，落 localStorage） ── */
		const LAYOUT_KEY = "dsh-vk-layout:pane:v1";
		let layoutState = {};
		try {
			const raw = window.localStorage.getItem(LAYOUT_KEY);
			const parsed = raw === null ? null : JSON.parse(raw);
			if (parsed !== null && typeof parsed === "object") layoutState = parsed;
		} catch { /* 存储不可用则停在默认态 */ }
		const layoutListeners = new Set();
		function layoutEmit() {
			for (const fn of [...layoutListeners]) { try { fn(); } catch { /* 单个订阅者出错不影响其余 */ } }
		}
		function layoutSubscribe(fn) {
			layoutListeners.add(fn);
			return () => { layoutListeners.delete(fn); };
		}
		function layoutActive(area) {
			const v = layoutState[area];
			return typeof v === "string" && v.length > 0 ? v : null;
		}
		function layoutSelect(area, id) {
			if (typeof id !== "string" || id.length === 0) return;
			if (layoutState[area] === id) return;
			layoutState[area] = id;
			try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layoutState)); } catch { /* ignore */ }
			layoutEmit();
		}

		/* ── 槽查询 ───────────────────────────────────────────────── */
		function slotEntries(ctx, slot) {
			try {
				const list = ctx.slots.entries(slot);
				return Array.isArray(list) ? list : [];
			} catch { return []; }
		}
		function slotCount(ctx, slot) {
			return slotEntries(ctx, slot).length;
		}
		/** 契约表里登记了投递方（provider !== null）的槽是常驻栏目：位置恒在，不随插件加载与否跳动。 */
		function paneVisible(ctx, pane) {
			return slotCount(ctx, pane.slot) > 0 || pane.provider !== null;
		}
		function panesOf(ctx, area) {
			return (VK_PANES[area] || []).filter((pane) => paneVisible(ctx, pane));
		}
		/** 该条目的 children 表：本区域全部槽（含 pane 与固定位），照契约表生成。
		 *  跳过 mirror 行 —— 那些槽由镜像条目自己声明，重复声明会 already declared 并拖垮整条 entry。 */
		function childMap(area, only) {
			const out = {};
			for (const row of VK_SLOT_TABLE) {
				if (row.area !== area) continue;
				if (row.mirror === true) continue;
				if (only !== undefined && only.indexOf(row.slot) < 0) continue;
				out[row.slot] = { kind: row.kind, scope: row.scope };
			}
			return out;
		}
		/** 区域内第一个可作为默认栏目的 id：优先上次选择，否则契约表 order 最小者。 */
		function pickActive(ctx, area) {
			const panes = panesOf(ctx, area);
			const stored = layoutActive(area);
			if (stored !== null && panes.some((p) => p.id === stored)) return stored;
			return panes.length > 0 ? panes[0].id : null;
		}
		/** 订阅本区域所有槽（含固定位）+ 布局状态，任一变化即重渲染。 */
		function usePanes(ctx, area) {
			const [, force] = react.useReducer((x) => x + 1, 0);
			react.useEffect(() => {
				const offs = [];
				for (const row of VK_SLOT_TABLE) {
					if (row.area !== area || row.mirror === true) continue;
					try {
						const off = ctx.slots.subscribe(row.slot, force);
						if (typeof off === "function") offs.push(off);
					} catch { /* 槽尚未声明：订阅不上 */ }
				}
				return () => { for (const off of offs) { try { off(); } catch { /* ignore */ } } };
			}, [area]);
			react.useEffect(() => layoutSubscribe(force), []);
			return panesOf(ctx, area);
		}
		/** 本区域的固定位槽：有人投、或契约里登记了投递方的才渲染。 */
		function seatsOf(ctx, area) {
			return VK_SLOT_TABLE.filter((row) => row.area === area && row.pane === false && row.mirror !== true
				&& (slotCount(ctx, row.slot) > 0 || row.provider !== null));
		}

		/* ── 标签条 / 窄轨 ────────────────────────────────────────── */
		function VKTagStrip({ panes, activeId, onSelect, tail }) {
			return h("div", { className: "vk_tabBar" },
				panes.map((pane) => h("button", {
					key: pane.id,
					type: "button",
					className: "vk_tabBtn" + (pane.id === activeId ? " vk_tabBtnActive" : ""),
					title: pane.label,
					"data-vk-tab": pane.id,
					onClick: () => onSelect(pane.id)
				},
					h("span", { className: "vk_tabGlyph" }, h(VIcon, { name: PANE_GLYPH[pane.id] || "file", size: 14 })),
					h("span", { className: "vk_tabText" }, pane.label))),
				h("div", { className: "vk_tabBarSpacer" }),
				tail === undefined || tail === null ? null : tail);
		}
		function VKRail({ panes, activeId, onSelect, onExpand, tail }) {
			return h("div", { className: "vk_rail" },
				panes.map((pane) => h("button", {
					key: pane.id,
					type: "button",
					className: "vk_railBtn" + (pane.id === activeId ? " vk_railBtnActive" : ""),
					title: pane.label,
					"data-vk-rail": pane.id,
					onClick: () => { onSelect(pane.id); if (typeof onExpand === "function") { try { onExpand(); } catch { /* ignore */ } } }
				}, h(VIcon, { name: PANE_GLYPH[pane.id] || "file", size: 16 }))),
				tail === undefined || tail === null ? null : tail);
		}

		/* ── 宿主组件 ─────────────────────────────────────────────── */
		/**
		 * 一个「标签页区域」的宿主：标签条 + 全部可见槽的正文。
		 * 正文**全部挂载**、非激活项用 CSS 隐藏（与旧实现同款：切标签不丢组件状态），
		 * 并把 `active` 透传给 renderSlot —— lt-tasks 这类靠它判断可见性的栏目要读。
		 */
		function makePaneAreaHost(area, options) {
			const config = options === undefined || options === null ? {} : options;
			return function VKPaneAreaHost(props) {
				const ctx = ctxRef.current;
				const panes = usePanes(ctx, area);
				const activeId = pickActive(ctx, area);
				const renderSlot = props === undefined || props === null ? undefined : props.renderSlot;
				const wide = props === undefined || props === null ? undefined : props.wide;
				const expandSidebar = props === undefined || props === null ? undefined : props.expandSidebar;
				const tail = typeof config.tail === "function" ? h(config.tail, props) : null;
				const onSelect = (id) => layoutSelect(area, id);
					const onExpand = typeof expandSidebar === "function" ? expandSidebar : null;
				if (config.rail === true && wide === false) {
					return h(VKRail, { panes, activeId, onSelect, onExpand: typeof expandSidebar === "function" ? expandSidebar : null, tail });
				}
				return h("div", { className: "vk_areaHost", "data-vk-area": area },
					h(VKTagStrip, { panes, activeId, onSelect, tail }),
					h("div", { className: "vk_paneStack" },
						panes.map((pane) => h("div", {
							key: pane.id,
							className: "vk_paneSlot" + (pane.id === activeId ? " vk_paneSlotActive" : ""),
							"data-vk-pane": pane.id
						}, typeof renderSlot === "function"
							? renderSlot(pane.slot, { active: pane.id === activeId, wide: wide !== false, expandSidebar: onExpand })
							: null))),
					seatsOf(ctx, area).length === 0 ? null : h("div", { className: "vk_seatRow", "data-vk-seats": area },
						seatsOf(ctx, area).map((row) => h("div", {
							key: row.slot,
							className: "vk_seatSlot",
							"data-vk-seat": row.slot
						}, typeof renderSlot === "function" ? renderSlot(row.slot, { active: true, wide: wide !== false, expandSidebar: onExpand }) : null))));
			};
		}
		/** 固定位置的槽宿主：直接渲染一个槽，无标签条。 */
		function makeSeatHost() {
			const slots = Array.prototype.slice.call(arguments);
			return function VKSeatHost(props) {
				const ctx = ctxRef.current;
				const [, force] = react.useReducer((x) => x + 1, 0);
				react.useEffect(() => {
					const offs = [];
					for (const slot of slots) {
						try {
							const off = ctx.slots.subscribe(slot, force);
							if (typeof off === "function") offs.push(off);
						} catch { /* ignore */ }
					}
					return () => { for (const off of offs) { try { off(); } catch { /* ignore */ } } };
				}, [slots.join("|")]);
				const renderSlot = props === undefined || props === null ? undefined : props.renderSlot;
				if (typeof renderSlot !== "function") return null;
				const nodes = slots.map((slot) => {
					const body = renderSlot(slot, {});
					return body === undefined || body === null ? null : h("div", { key: slot, className: "vk_seatBody", "data-vk-seat": slot }, body);
				}).filter((n) => n !== null);
				return h("div", { className: "vk_seatHost" }, nodes);
			};
		}
		/** 输入框上方整宽一行（官方 conversation.input.dock，契约注释：Full-width entries above the composer card）。
		 *  宿主是个整宽块级容器：内容（技能档 dock）自己给出宽度与高度，展开时把下面的输入卡片往下推，
		 *  不会被 scrollBody 的 overflow:auto 裁掉——挂在工具行里那条槽时，向下展开必然掉出可视区。 */
		function makeDockHost(slot) {
			return function VKComposerDockHost(props) {
				const renderSlot = props === undefined || props === null ? undefined : props.renderSlot;
				if (typeof renderSlot !== "function") return null;
				const body = renderSlot(slot, {});
				if (body === undefined || body === null) return null;
				return h("div", { className: "vk_dockHost", "data-vk-dock": slot }, body);
			};
		}
		/** 右栏栏目正文：官方 keyed 槽给宿主下发 tab 上下文（useTabInfo 等），原样透传给槽内容。 */
		function makeRightbarHost(slot) {
			return function VKRightbarHost(props) {
				const renderSlot = props === undefined || props === null ? undefined : props.renderSlot;
				if (typeof renderSlot !== "function") return null;
				const body = renderSlot(slot, Object.assign({}, props, { active: true }));
				if (body === undefined || body === null) return null;
				return h("div", { className: "vk_paneBody", "data-vk-rightbar": slot }, body);
			};
		}
		/** 设置页一个分区：官方设置面板按导航项渲染，正文由这里给出。 */
		function makeSettingsSectionHost(slot) {
			return function VKSettingsSectionHost(props) {
				const renderSlot = props === undefined || props === null ? undefined : props.renderSlot;
				const body = typeof renderSlot === "function" ? renderSlot(slot, {}) : null;
				if (body === undefined || body === null) return null;
				return h("div", { className: "vk_seatBody", "data-vk-settings": slot }, body);
			};
		}

		/* ── 拓展栏开关：会话头与左栏共用同一份状态 ─────────────────
		   三处入口（会话头 / 标签条最右端 / 窄轨）共用 useVKRightPane，
		   因为会话头只在会话真正打开时才挂载，一条消息都没发时必须还有别的入口。 */
		const RIGHT_PANE_KEY = "vk.layout.rightPaneOpen.v1";
		function useVKRightPane() {
			const [open, setOpen] = react.useState(false);
			const baseRef = react.useRef(null);
			react.useEffect(() => {
				const read = () => {
					try {
						const sr = ctxRef.current.get("sidebarRight");
						// 服务未就绪时既不能读也不能写：早期误读成 false 会把「上次是展开」的恢复依据抹掉。
						if (sr === undefined || sr === null || typeof sr.isExpanded !== "function") return;
						const v = sr.isExpanded() === true;
						setOpen((prev) => (prev === v ? prev : v));
						if (baseRef.current === null) { baseRef.current = v; return; }
						if (baseRef.current !== v) {
							baseRef.current = v;
							try { window.localStorage.setItem(RIGHT_PANE_KEY, v ? "1" : "0"); } catch { /* ignore */ }
						}
					} catch { /* 服务未就绪，下一轮再试 */ }
				};
				read();
				const t = setInterval(read, 800);
				return () => clearInterval(t);
			}, []);
			const toggle = () => {
				try {
					const sr = ctxRef.current.get("sidebarRight");
					if (sr === undefined || sr === null || typeof sr.toggleExpanded !== "function") return;
					const before = typeof sr.isExpanded === "function" ? sr.isExpanded() === true : open;
					sr.toggleExpanded();
					// 官方 store 异步生效：紧跟 toggleExpanded() 读到的是旧值（实测会把状态存反），
					// 所以轮询等它翻过来再落盘，最多 1 秒；实在读不到就按取反兜底。
					let tries = 0;
					const settle = () => {
						tries += 1;
						let now = null;
						try { now = typeof sr.isExpanded === "function" ? sr.isExpanded() === true : null; } catch { now = null; }
						if (now === null || now === before) {
							if (tries < 5) { setTimeout(settle, 200); return; }
							now = !before;
						}
						setOpen(now);
						try { window.localStorage.setItem(RIGHT_PANE_KEY, now ? "1" : "0"); } catch { /* ignore */ }
					};
					settle();
				} catch { /* 没接上官方右栏服务就什么也不做 */ }
			};
			return { open: open, toggle: toggle };
		}
		function VKRightbarToggle(props) {
			const rail = props !== undefined && props !== null && props.rail === true;
			const brand = props !== undefined && props !== null && props.brand === true;
			const pane = useVKRightPane();
			const base = brand ? "vk_brandBtn" : rail ? "vk_railBtn" : "vk_seatToggle";
			const on = brand ? " vk_brandBtnOn" : rail ? " vk_railBtnActive" : " vk_seatToggleOn";
			return h("button", {
				type: "button",
				className: base + (pane.open ? on : ""),
				title: pane.open ? "收起拓展栏（官方右侧栏）" : "打开拓展栏（官方右侧栏）",
				"aria-label": pane.open ? "收起拓展栏" : "打开拓展栏",
				"data-vk-right-toggle": rail ? "rail" : brand ? "brand" : "true",
				onClick: pane.toggle
			}, h(VIcon, { name: "panelRight", size: rail || brand ? 16 : 15 }));
		}
		/* ── 品牌行落位 ───────────────────────────────────────────────
		   官方左栏顶栏是「品牌按钮 + 折叠按钮」，没有插槽可投。做法：从 vk 自己的区域宿主往上找品牌行，
		   在它末尾挂一个盒子，放一颗**克隆官方那颗折叠按钮**的按钮 —— 类名与图标都直接取官方的
		   （图标镜像成右栏图标），所以尺寸、描边、悬停状态与官方完全同源，不可能不一致。
		   官方那颗原样不动；拿不到落点就退回标签条尾部。 */
		const BRAND_SLOT_CLASS = "vk_brandSlot";
		function findBrandRow(from) {
			if (from === null || from === undefined || typeof from.parentElement === "undefined") return null;
			let node = from.parentElement;
			while (node !== null && node !== document.body && node !== document.documentElement) {
				for (const child of node.children) {
					if (child === from || child.contains(from)) continue;
					if (child.querySelector("button") !== null) return child;
				}
				node = node.parentElement;
			}
			return null;
		}
		/** 品牌行里那颗官方折叠按钮：从末尾往前找第一颗带 aria-label 的（品牌按钮在最前，不会误取）。 */
		function findOfficialToggle(row) {
			for (let i = row.children.length - 1; i >= 0; i -= 1) {
				const child = row.children[i];
				if (child.hasAttribute("data-vk-brand-slot") === true) continue;
				const btn = child.tagName === "BUTTON" ? child : child.querySelector("button");
				return btn !== null && btn.getAttribute("aria-label") !== null ? btn : null;
			}
			return null;
		}
		function useBrandRowAnchor(enabled) {
			const [box, setBox] = react.useState(null);
			const anchor = typeof react.useLayoutEffect === "function" ? react.useLayoutEffect : react.useEffect;
			anchor(() => {
				setBox(null);
				if (enabled !== true || typeof document === "undefined") return void 0;
				let alive = true;
				let row = null;
				let host = null;
				let own = null;
				let official = null;
				let keep = null;
				let lastIcon = null;
				/** 与官方那颗共用类名与图标：尺寸、描边、悬停状态同源。 */
				const syncStyle = () => {
					if (own === null || official === null) return;
					const want = official.className + " vk_brandOwn";
					if (own.className !== want) own.className = want;
					if (lastIcon !== official.innerHTML) {
						lastIcon = official.innerHTML;
						own.innerHTML = official.innerHTML;
						const svg = own.querySelector("svg");
						if (svg !== null) svg.style.transform = "scaleX(-1)";
					}
					let open = false;
					try {
						const sr = ctxRef.current.get("sidebarRight");
						open = sr !== undefined && sr !== null && typeof sr.isExpanded === "function" && sr.isExpanded() === true;
					} catch { open = false; }
					const label = open ? "收起拓展栏（官方右侧栏）" : "打开拓展栏（官方右侧栏）";
					if (own.title !== label) { own.title = label; own.setAttribute("aria-label", open ? "收起拓展栏" : "打开拓展栏"); }
				};
				const attach = () => {
					if (!alive) return;
					const next = findBrandRow(document.querySelector("[data-vk-area=\"sidebar\"]"));
					if (next === null) return;
					if (next !== row) {
						if (keep !== null) { try { keep.disconnect(); } catch { /* ignore */ } keep = null; }
						if (host !== null) { try { host.remove(); } catch { /* ignore */ } }
						row = next;
						official = findOfficialToggle(row);
						host = document.createElement("span");
						host.className = BRAND_SLOT_CLASS;
						host.setAttribute("data-vk-brand-slot", "1");
						own = document.createElement("button");
						own.type = "button";
						own.setAttribute("data-vk-right-toggle", "brand");
						own.addEventListener("click", () => {
							try {
								const sr = ctxRef.current.get("sidebarRight");
								if (sr !== undefined && sr !== null && typeof sr.toggleExpanded === "function") sr.toggleExpanded();
							} catch { /* 官方右栏服务没接上就什么也不做 */ }
						});
						host.appendChild(own);
						row.appendChild(host);
						if (typeof MutationObserver !== "undefined") {
							keep = new MutationObserver(() => {
								if (alive && host !== null && host.parentElement !== row) { try { row.appendChild(host); } catch { /* ignore */ } }
							});
							keep.observe(row, { childList: true });
						}
						setBox(host);
					} else if (host !== null && host.parentElement !== row) {
						try { row.appendChild(host); } catch { /* ignore */ }
					}
					syncStyle();
				};
				attach();
				// 侧栏可能后挂载、或整行被 React 换掉：轮询兜底（顺带把类名/图标与官方保持同步）。
				let timer = null;
				const tick = () => { attach(); if (alive) timer = setTimeout(tick, host === null ? 100 : 800); };
				timer = setTimeout(tick, 0);
				return () => {
					alive = false;
					if (timer !== null) clearTimeout(timer);
					if (keep !== null) { try { keep.disconnect(); } catch { /* ignore */ } }
					if (host !== null) { try { host.remove(); } catch { /* ignore */ } }
				};
			}, [enabled]);
			return box;
		}
		/** 左栏顶栏的拓展栏开关：落进品牌行就走了（按钮已经挂在那儿），拿不到落点就在标签条尾部兜底。 */
		function VKSidebarTabTail(props) {
			const wide = !(props !== undefined && props !== null && props.wide === false);
			const box = useBrandRowAnchor(wide);
			if (!wide) return h(VKRightbarToggle, { rail: true });
			if (box !== null) return null;
			return h("div", { className: "vk_tabTail" }, h(VKRightbarToggle, {}));
		}

		/* ── 官方条目镜像（不改官方包，把官方注册的渲染能力搬到私有槽上） ── */
		function vkCreateMirror(ctx, sourceKey, targetKey, options) {
			const slots = ctx.slots;
			const config = options === undefined || options === null ? {} : options;
			let dispose = null;
			let mirrored = null;
			const winnerOf = () => {
				if (typeof config.pick === "function") return config.pick(typeof slots.entries === "function" ? slots.entries(sourceKey) : []);
				const winners = typeof slots.entriesOfSlot === "function" ? slots.entriesOfSlot(sourceKey) : [];
				if (winners.length > 0) return winners[0];
				const all = typeof slots.entries === "function" ? slots.entries(sourceKey) : [];
				return all.length > 0 ? all[0] : void 0;
			};
			const drop = () => {
				const current = dispose;
				dispose = null;
				mirrored = null;
				if (current !== null) { try { current(); } catch { /* 源条目已自行卸载时清理是空操作 */ } }
			};
			const sync = () => {
				const source = winnerOf();
				if (source === mirrored) return;
				drop();
				if (source === void 0) return;
				mirrored = source;
				try {
					dispose = slots.register({
						name: targetKey,
						children: config.children,
						store: source.store,
						inject: typeof config.inject === "function" ? config.inject(source) : source.inject,
						locale: source.locale
					}, typeof config.component === "function" ? config.component(source) : source.component);
				} catch (error) {
					drop();
					try { ctx.logger.warn("[vk-layout] 镜像 " + sourceKey + " → " + targetKey + " 失败：" + String(error && error.message ? error.message : error)); } catch { /* ignore */ }
				}
			};
			return { sync, dispose: drop };
		}

		/* ── 三个中立服务 ─────────────────────────────────────────── */
		function makeServices(ctx) {
			const layout = {
				toggleSidebar() {
					try {
						const official = ctx.get("layout");
						if (official !== undefined && official !== null && typeof official.toggleSidebar === "function") { official.toggleSidebar(); return true; }
					} catch { /* 官方布局缺失时无处可收 */ }
					return false;
				},
				toggleRightbar() {
					try {
						const sr = ctx.get("sidebarRight");
						if (sr !== undefined && sr !== null && typeof sr.toggleExpanded === "function") { sr.toggleExpanded(); return true; }
					} catch { /* ignore */ }
					return false;
				},
				selectPane(area, id) { layoutSelect(area, id); },
				activePane(area) { return pickActive(ctx, area); },
				areas() { return Object.keys(VK_PANES); }
			};
			const openFile = {
				open(address, options) {
					if (typeof address !== "string" || address.length === 0) return false;
					const config = options === undefined || options === null ? {} : options;
					try {
						const sr = ctx.get("sidebarRight");
						if (sr === undefined || sr === null || typeof sr.openResource !== "function") return false;
						if (config.expand !== false && typeof sr.isExpanded === "function" && sr.isExpanded() !== true && typeof sr.toggleExpanded === "function") sr.toggleExpanded();
						const args = config.replaceTab === true ? [address, { replaceTab: true }] : [address];
						sr.openResource.apply(sr, args);
						return true;
					} catch (error) {
						try { ctx.logger.warn("[vk-layout] openResource 失败 " + address + "：" + String(error && error.message ? error.message : error)); } catch { /* ignore */ }
						return false;
					}
				},
				address(sessionId, cwd, path) {
					if (typeof path !== "string" || path.length === 0) return null;
					const sid = typeof sessionId === "string" ? sessionId : "";
					const base = typeof cwd === "string" && cwd.length > 0 ? cwd : "";
					const abs = path.replace(/\\/g, "/");
					const rel = base.length > 0 && abs.toLowerCase().indexOf(base.replace(/\\/g, "/").toLowerCase() + "/") === 0
						? abs.slice(base.replace(/\\/g, "/").length + 1)
						: abs;
					const root = base.length > 0 ? base.replace(/\\/g, "/") : "";
					const full = /^[A-Za-z]:\//.test(rel) ? rel : (root.length > 0 ? root + "/" + rel : rel);
					const encoded = full.split("/").map((seg) => encodeURIComponent(seg)).join("/");
					return "dsh-resource://file/session/" + encodeURIComponent(sid) + "/" + encoded;
				}
			};
			const panes = {
				list(area) {
					return panesOf(ctx, area).map((pane) => ({ id: pane.id, slot: pane.slot, label: pane.label, order: pane.order, provider: pane.provider, count: slotCount(ctx, pane.slot) }));
				},
				active(area) { return pickActive(ctx, area); },
				select(area, id) { layoutSelect(area, id); },
				slots() {
					const out = {};
					for (const area of Object.keys(VK_PANES)) out[area] = (VK_PANES[area] || []).map((pane) => pane.slot);
					return out;
				}
			};
			return { layout, openFile, panes };
		}

		/* ── 接线 ─────────────────────────────────────────────────── */
		function apply(ctx) {
			ctxRef.current = ctx;
			try { globalThis.__VK_LAYOUT_CTX__ = ctx; } catch { /* 排障把手，拿不到不影响运行 */ }

			const services = makeServices(ctx);
			const provide = (name, value) => {
				try { ctx.reflect.provide(name, value); } catch (error) {
					try { ctx.logger.warn("[vk-layout] 服务 " + name + " 提供失败：" + String(error && error.message ? error.message : error)); } catch { /* ignore */ }
				}
			};
			// 文件栏与 @ 列表之间的共享数据（旧实现是同一个闭包里的模块级对象；
			// 拆成两个插件后必须有中间人，否则 @ 落地页的三个分组永远是空的）。
			const rootsRef = { treeRoot: null, autoRoot: null, recentDirs: [], fileList: [], sessionFiles: [], sessionDirs: [] };
			provide("vkRoots", {
				ref: rootsRef,
				update(patch) { try { Object.assign(rootsRef, patch); } catch { /* ignore */ } }
			});
			provide(VK_SERVICE.LAYOUT, services.layout);
			provide(VK_SERVICE.OPEN_FILE, services.openFile);
			provide(VK_SERVICE.PANES, services.panes);

			/* 左栏：抢官方 sidebar.workspaces 的正文洞。single 槽按「优先级最低者渲染」，
			   且同优先级重复注册会抛错 —— 取 -2 是为了与旧布局插件（-1）不同档，迁移期两者并存也不炸。 */
			ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
				name: "sidebar.workspaces",
				priority: -2,
				children: childMap("sidebar")
			}, makePaneAreaHost("sidebar", { rail: true, tail: VKSidebarTabTail })));

			/* 左栏「会话」栏目：官方 WorkspaceBrowser 本体镜像到私有槽，不自绘。 */
			const browserMirror = vkCreateMirror(ctx, "sidebar.workspaces", VK.sidebar.sessions, {
				// 官方那条自己被本骨架遮蔽（同键优先级更低者胜），所以镜像要显式挑「非自研」的那条：
				// 迁移期旧布局插件也住在同一个键上，名字前缀同样排除掉。
				pick: (list) => list.filter((entry) => typeof entry.component === "function" && !/^(VK|Anoslide)/.test(entry.component.name || ""))[0],
				// 官方组件会在「添加工作区」弹层里 renderSlot 官方的目录选择洞 —— 重定向到本骨架声明的私有洞。
				children: { [VK.sidebar.dirflow]: { kind: "single", scope: "root" } },
				component: (source) => {
					const Browser = source.component;
					return function VKWorkspaceBrowser(props) {
						const slotOf = props.renderSlot;
						return h(Browser, Object.assign({}, props, {
							renderSlot: (key, owner) => (key === "sidebar.workspaces.directoryFlow" && typeof slotOf === "function"
								? slotOf(VK.sidebar.dirflow, owner)
								: null)
						}));
					};
				}
			});
			ctx.slots.inject(VK.sidebar.sessions, () => ctx.slots.inject("sidebar.workspaces", () => {
				const off = ctx.slots.subscribe("sidebar.workspaces", browserMirror.sync);
				browserMirror.sync();
				return () => { try { off(); } catch { /* ignore */ } browserMirror.dispose(); };
			}));
			/* 目录选择洞同样镜像一份。 */
			const flowMirror = vkCreateMirror(ctx, "sidebar.workspaces.directoryFlow", VK.sidebar.dirflow);
			ctx.slots.inject(VK.sidebar.dirflow, () => {
				const off = ctx.slots.subscribe("sidebar.workspaces.directoryFlow", flowMirror.sync);
				flowMirror.sync();
				return () => { try { off(); } catch { /* ignore */ } flowMirror.dispose(); };
			});

			/* 右栏：官方右栏是 keyed 正文槽（按 tab key 取一条渲染）。契约表里每个 rightbar 栏目登记一条，
			   tab 类型（谁能出现在右栏、认领哪些地址）由业务插件向 sidebarRightTabs 注册，id 就用同一个槽名。 */
			const rightbarSpec = childMap("rightbar");
			for (const pane of (VK_PANES.rightbar || [])) {
				ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
					name: "sidebar.right.pane.tab",
					key: pane.slot,
					inject: () => ({}),
					children: { [pane.slot]: rightbarSpec[pane.slot] }
				}, makeRightbarHost(pane.slot)));
			}

			/* 设置页：契约表里每个 settings 栏目一个导航项，正文是它自己的槽。
			   list 槽按 (id, priority) 去重 —— 取 -1 与旧布局插件（默认 0）分开，迁移期并存不炸。 */
			for (const pane of (VK_PANES.settings || [])) {
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: pane.id,
					order: pane.order,
					priority: -1,
					label: () => pane.label,
					children: { [pane.slot]: { kind: "list", scope: pane.scope } }
				}, makeSettingsSectionHost(pane.slot)));
			}

			/* 输入区左侧：官方工具行左端的紧凑控件位（契约里只有 vk.input.left 落这里）。 */
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "vk-input",
				order: 30,
				children: childMap("input", [VK.input.left])
			}, makeSeatHost(VK.input.left)));

			/* 输入框上方整宽一行：官方 conversation.input.dock（list / session）。
			   技能档 pill 是按「整宽一行 + 展开时在流内撑开」设计的组件，挂这条槽才对：宽度对齐输入卡片、
			   展开把卡片往下推。挂在工具行座位里时宽度被压成 0、向下展开又被裁掉（2026-09-26 实测）。 */
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "vk-input-dock",
				order: 30,
				children: childMap("input", [VK.input.right])
			}, makeDockHost(VK.input.right)));

			/* 会话头右上角：single 槽，同上一篇取 -2 拿下（官方那条就渲染不出来，避免两颗重复按钮）。 */
			ctx.slots.inject("conversation.session.header.corner", () => ctx.slots.register({
				name: "conversation.session.header.corner",
				priority: -2,
				children: childMap("session")
			}, makeSeatHost(VK.session.headerLeft, VK.session.headerRight)));

			/* 浮层：官方 AppFrame 的 list 槽（list 槽必须带 id），本骨架只多挂一条。 */
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "vk-overlay",
				children: childMap("overlay")
			}, makeSeatHost(VK.overlay)));

			/* 会话头左上角：常驻的拓展栏入口（会话头只在会话打开时挂载，左栏尾部还有另一处）。 */
			ctx.slots.inject(VK.session.headerLeft, () => ctx.slots.register({
				name: VK.session.headerLeft,
				id: "rightbar-toggle",
				order: 10
			}, VKRightbarToggle));
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		exports.VIcon = VIcon;
		exports.VKTagStrip = VKTagStrip;
		exports.vkCreateMirror = vkCreateMirror;
		return module.exports;
	}
});
