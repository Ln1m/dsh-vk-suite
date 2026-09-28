// dsh-vk-layout — 3栏layout 骨架：区域映射到官方插槽的宿主条目 + 标签条渲染。业务不在这里。
// 骨架自带右栏下段命令行面板：右栏 = 上方标签 + 下方命令行，一次给全。
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
			"@container (width<=400px){.vk_tabBtn{padding:7px 8px}}",
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
				/** 与官方那颗同源：类名叠加、图标照抄并强制显示（官方平时是悬停才显），照抄不到就自己画一个同规格的。 */
				const syncStyle = () => {
					if (own === null) return;
					const want = (official === null ? "" : official.className + " ") + "vk_brandBtn vk_brandOwn";
					if (own.className !== want) own.className = want;
					const iconHtml = official === null ? "" : official.innerHTML;
					if (lastIcon !== iconHtml) {
						lastIcon = iconHtml;
						own.innerHTML = iconHtml;
						let svg = own.querySelector("svg");
						if (svg === null) {
							own.innerHTML = "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"2\" y=\"3\" width=\"20\" height=\"18\" rx=\"3\"/><line x1=\"14\" y1=\"3\" x2=\"14\" y2=\"21\"/></svg>";
							own.setAttribute("data-vk-icon", "fallback");
							svg = own.querySelector("svg");
						} else {
							own.setAttribute("data-vk-icon", "official");
						}
						if (svg !== null) {
							svg.style.display = "inline";
							svg.style.transform = own.getAttribute("data-vk-icon") === "official" ? "scaleX(-1)" : "";
						}
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
		function vkLayoutApply(ctx) {
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

		/* ── 右栏下段命令行面板 ─────────────────────────────────────── */
		const vkCmdStrip = (function () {
			const react = require('react');
			const h = react.createElement;
			const ctxRef = { current: null };

			const _VK_ICONS = {
				menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
				tasks: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
				folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
				folderOpen: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
				chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
				eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
				eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
				search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
				edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
				trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
				check: '<path d="M20 6 9 17l-5-5"/>',
				close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
				save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
				columns: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>',
				fullscreen: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
				file: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/>',
				fileText: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
				image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
				video: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
				music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
				archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
				lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
				tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
				atom: '<circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>',
				terminal: '<path d="m4 17 6-5-6-5"/><path d="M12 19h8"/>',
				open: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
				zoomIn: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
				zoomOut: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>',
				gear: '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
				gitBranch: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
				box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
				chevronLeft: '<path d="m15 18-6-6 6-6"/>',
				// 侧栏/面板类图标（左侧栏 Tab 条最右端的「打开拓展栏」按钮用）
				panelRight: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="15" y1="4" x2="15" y2="20"/>',
				// 拓展栏顶栏第 4 颗按钮：上下分界（上=官方拓展栏，下=命令行）
				panelBottom: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="13" x2="21" y2="13"/><path d="m6.6 15.6 2.4 1.7-2.4 1.7" stroke-width="1.6"/><line x1="11" y1="19" x2="15" y2="19" stroke-width="1.6"/>',
				chevronRight: '<path d="m9 18 6-6-6-6"/>',
				chevronDown: '<path d="m6 9 6 6 6-6"/>',
				chevronUp: '<path d="m18 15-6-6-6 6"/>',
				arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
				hardDrive: '<line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/>',
				refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
				monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
				home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'
			};
			function VIcon({ name, size = 14 }) {
				const d = _VK_ICONS[name];
				if (!d) return null;
				return h("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", style: { flex: "none", display: "block" }, dangerouslySetInnerHTML: { __html: d } });
			}
			const CSS = [
				// 官方 sidebar.footer.action 是 **list 槽**，容器默认按一行横排；自研那三块 dock（钱包 dsw-dock /
				// 移动端访问 dwa-dock / 局域网服务 dls-dock）都是「整宽一行」的设计，横排会互相挤，
				// 实测后两块被顶到侧栏之外（局域网服务渲染在 x=378，而侧栏只有 280px 宽）。
				// 改成竖向排列后实测：三块各占一行、x=12、宽 256（侧栏 280 − 两侧 12），与设置行左右边距对齐。
				// 注意槽里那个匿名包裹层是 `display:contents`（不生成盒子），所以槽的直接子元素在**盒子树**里
				// 就是这几块 dock——用后代选择器（不要用 `>`，DOM 上它们是孙节点）兜住宽度。
				"[class*=_footerActions]{flex-direction:column;align-items:stretch;gap:0}",
				"[class*=_footerActions] [class*=dsw-dock],[class*=_footerActions] [class*=dwa-dock],[class*=_footerActions] [class*=dls-dock]{width:100%;min-width:0;box-sizing:border-box}",
				// ── 拓展栏「上下分界」：下半是命令行面板（2026-09-12）────────────────────────
				// 分隔**不靠样式表**：上半让位走 `右栏列.style.paddingBottom = <px>`（JS 内联），
				// 面板高度也全部内联，CSS 只管面板内部的观感，不做任何尺寸决策。
				// 顶栏第 4 颗按钮（与官方两颗、自研拓展栏开关并排）
				".vk_cmdChromeBtn{appearance:none;border:none;background:none;cursor:pointer;width:28px;height:28px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;flex:none;padding:0;color:var(--dsw-alias-label-secondary);transition:background-color .12s,color .12s,transform .08s}",
				".vk_cmdChromeBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
				".vk_cmdChromeBtn:active{transform:scale(.94)}",
				".vk_cmdChromeBtnOn{color:var(--vk-accent)}",
				".vk_cmdChromeBtnOn:hover{color:var(--vk-accent)}",
				".vk_cmdHandle{position:absolute;left:0;right:0;top:-4px;height:8px;cursor:row-resize;touch-action:none;z-index:6}",
				".vk_cmdHandle::after{content:'';position:absolute;left:0;right:0;top:3px;height:2px;background:transparent;transition:background-color .12s}",
				".vk_cmdHandle:hover::after,.vk_cmdHandle[data-dragging]::after{background:var(--vk-accent)}",
				".vk_cmdHead{display:flex;align-items:center;gap:6px;flex:none;height:30px;padding:0 6px 0 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
				".vk_cmdTitle{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary);flex:none}",
				".vk_cmdCwd{flex:1;min-width:0;font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,'Cascadia Mono',Consolas,monospace}",
				".vk_cmdBadge{flex:none;font-size:11px;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);white-space:nowrap}",
				".vk_cmdDiag{flex:none;max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-family:ui-monospace,'Cascadia Mono',Consolas,monospace;opacity:.85}",
				".vk_cmdIconBtn{appearance:none;border:none;background:none;cursor:pointer;flex:none;width:24px;height:24px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;padding:0;color:var(--dsw-alias-label-secondary)}",
				".vk_cmdIconBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
				".vk_cmdIconBtn:disabled{opacity:.4;cursor:default}",
				".vk_cmdIconBtn:disabled:hover{background:none;color:var(--dsw-alias-label-secondary)}",
				".vk_cmdIconBtn:focus-visible,.vk_cmdTextBtn:focus-visible,.vk_cmdInput:focus-visible{outline:2px solid var(--vk-accent-ring);outline-offset:-2px}",
				// ── 下段 v2（2026-09-17）：正文 = 官方 TerminalBody。样式只做「撑高 / 撑满」兜底，
				//    官方自己的模块样式若已生效，这几条与之不冲突（都是让 xterm 容器拿到真实高度）。──
				".vk_termPanel{display:flex;flex-direction:column;min-height:0;height:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base)}",
				".vk_termHost{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}",
				".vk_termHost>[data-sidebar-terminal]{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;height:100%;width:100%}",
				".vk_termHost>[data-sidebar-terminal]>div[role=status]{flex:none;padding:4px 10px;font-size:12px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:8px}",
				".vk_termHost>[data-sidebar-terminal]>div:not([role=status]){flex:1 1 auto;min-height:0;width:100%;overflow:hidden}",
				".vk_termHost .xterm{height:100%}",
				".vk_termNote{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:12px;padding:12px;text-align:center}",
			].join("");

			(function injectCmdCss() {
				if (typeof document === 'undefined') return;
				const plugin = 'dsh-vk-cmdstrip';
				for (const old of document.querySelectorAll('style[data-plugin="' + plugin + '"]')) { try { old.remove(); } catch { /* ignore */ } }
				const tag = document.createElement('style');
				tag.dataset.plugin = plugin;
				tag.textContent = CSS;
				document.head.appendChild(tag);
			})();

			function vkCurrentSessionId() {
				try {
					const snapshot = ctxRef.current.get("sessions").list.getSnapshot();
					return snapshot !== undefined && snapshot !== null && typeof snapshot.current === "string" ? snapshot.current : "";
				} catch { return ""; }
			}

			const vkZoomNote = { text: "", store: null, set(text) { this.text = String(text); if (this.store !== null) this.store.setDiag(String(text)); } };
			/** 最近一次被滚轮/捕获层缩放过的那一帧：父页键盘只认它（守卫条件之一，见 attachFrameZoom）。 */
			let vkZoomLastFrame = null;

			const VK_CMD_OPEN_KEY = "vk.layout.cmdOpen.v1";
			const VK_CMD_HEIGHT_KEY = "vk.layout.cmdHeight.v1";
			const VK_CMD_HISTORY_KEY = "vk.layout.cmdHistory.v1";
			/** 下界高度：百分比（相对视口高），拖动会改它。 */
			const VK_CMD_HEIGHT_MIN = 12;
			const VK_CMD_HEIGHT_MAX = 70;
			const VK_CMD_HEIGHT_DEFAULT = 34;
			/** 下界像素下限（百分比在矮窗口里会小到没法用）。 */
			const VK_CMD_PX_MIN = 80;
			/** 右栏那一格至少这么宽（px）才放得下下界；收起时是 0px 的网格轨，低于它就是收起态。 */
			const VK_CMD_COL_MIN_W = 300;
			const VK_CMD_HISTORY_MAX = 60;
			const VK_CMD_POLL_MS = 700;
			/** 构建标记：每次改动这块代码必须改它（刷新后先在控制台确认它变了，再判断功能）。 */
			const VK_CMD_BUILD = "official-terminal-2026-09-17-1400";
			let vkCmdSeq = 0;

			function vkCmdStoredFlag(key) {
				try { return window.localStorage.getItem(key) === "1"; } catch { return false; }
			}
			function vkCmdWriteFlag(key, on) {
				try { window.localStorage.setItem(key, on ? "1" : "0"); } catch { /* ignore */ }
			}
			function vkCmdStoredHeight() {
				try {
					const raw = Number(window.localStorage.getItem(VK_CMD_HEIGHT_KEY));
					if (Number.isFinite(raw) && raw >= VK_CMD_HEIGHT_MIN && raw <= VK_CMD_HEIGHT_MAX) return Math.round(raw);
				} catch { /* ignore */ }
				return VK_CMD_HEIGHT_DEFAULT;
			}
			function vkCmdStoredHistory() {
				try {
					const raw = JSON.parse(window.localStorage.getItem(VK_CMD_HISTORY_KEY) || "[]");
					if (Array.isArray(raw)) return raw.filter((item) => typeof item === "string").slice(-VK_CMD_HISTORY_MAX);
				} catch { /* ignore */ }
				return [];
			}

			/** 面板级 UI 状态（面板收起时组件卸载，所以草稿/筛选/上次快照留在模块级，重开即恢复）。 */
			const vkCmdUi = {
				draft: "",
				filter: "",
				view: { jobs: [], agent: [], shell: null, ok: false, err: null, agentErr: null }
			};
			/** 诊断文本里的空值归一（`null`/`undefined` → "无"，避免把 undefined 写进 DOM）。 */
			function vkCmdText(value) {
				return value === null || value === undefined ? "无" : String(value);
			}
			/** 命令行面板共享状态：按钮与面板两处都读它，改动通过订阅同步到 DOM。 */
			const vkCmdStore = {
				open: vkCmdStoredFlag(VK_CMD_OPEN_KEY),
				height: vkCmdStoredHeight(),
				history: vkCmdStoredHistory(),
				/** 官方右栏当前是否展开（tick 轮询同步进来；收起时下界整块拔出）。 */
				paneOpen: true,
				/** 官方右栏是否处于全屏模式（全屏时它铺满视口，下界整块不出现）。 */
				paneFullscreen: false,
				/** 展开态够不够放下界：那一格宽 <300px（含收起时的 0px 网格轨）就算放不下。 */
				paneCollapsed: false,
				/** 诊断行：面板标题栏右侧显示的那串状态（真机上不带控制台就能读）。 */
				diag: "",
				listeners: new Set(),
				subscribe(fn) {
					this.listeners.add(fn);
					return () => { this.listeners.delete(fn); };
				},
				emit() {
					for (const fn of [...this.listeners]) { try { fn(); } catch { /* ignore */ } }
				},
				setPaneOpen(on) {
					const next = on === true;
					if (this.paneOpen === next) return;
					this.paneOpen = next;
					this.emit();
				},
				setPaneFullscreen(on) {
					const next = on === true;
					if (this.paneFullscreen === next) return;
					this.paneFullscreen = next;
					this.emit();
				},
				setPaneCollapsed(on) {
					const next = on === true;
					if (this.paneCollapsed === next) return;
					this.paneCollapsed = next;
					this.emit();
				},
				setDiag(text) {
					const next = String(text ?? "");
					if (this.diag === next) return;
					this.diag = next;
					this.emit();
				},
				setOpen(on) {
					const next = on === true;
					if (this.open === next) return;
					this.open = next;
					vkCmdWriteFlag(VK_CMD_OPEN_KEY, next);
					this.emit();
				},
				setHeight(percent) {
					const next = Math.max(VK_CMD_HEIGHT_MIN, Math.min(VK_CMD_HEIGHT_MAX, Math.round(percent)));
					if (this.height === next) return;
					this.height = next;
					try { window.localStorage.setItem(VK_CMD_HEIGHT_KEY, String(next)); } catch { /* ignore */ }
					this.emit();
				},
				pushHistory(text) {
					const line = String(text);
					const list = this.history.filter((item) => item !== line);
					list.push(line);
					this.history = list.slice(-VK_CMD_HISTORY_MAX);
					try { window.localStorage.setItem(VK_CMD_HISTORY_KEY, JSON.stringify(this.history)); } catch { /* ignore */ }
				}
			};
			function useVkCmdStore() {
				return typeof react.useSyncExternalStore === "function"
					? react.useSyncExternalStore((fn) => vkCmdStore.subscribe(fn), () => vkCmdStore)
					: vkCmdStore;
			}
			// 把「网页缩放」诊断接进面板标题行（缩放那条链定义在 store 之前，用这个反填）。
			try { vkZoomNote.store = vkCmdStore; } catch { /* ignore */ }

			/** 落位探针（控制台一行看出「按钮没接上 / 宿主没插 / 插了没高度」）。 */
			function vkCmdProbe(patch) {
				try {
					globalThis.__VK_CMD_MOUNT__ = Object.assign(
						globalThis.__VK_CMD_MOUNT__ ?? { colFound: false, inCol: false, pinnedPx: 0, panelRendered: false, chrome: false, buttonInChrome: false, err: null, ticks: 0, build: VK_CMD_BUILD },
						patch ?? {}
					);
				} catch { /* ignore */ }
			}

			/**
			 * 读右栏那一格的宽度（px）。
			 * `__VK_CMD_WIDTH__` 是**测试覆盖口**：离线冒烟的 DOM 垫片没有布局引擎，跨 vm 沙箱的
			 * getBoundingClientRect 读不到测试改的矩形，用它才能把「收起态（0 宽）」这条路径测出来。
			 * 真机上没有这个把手，一律走真实测量。
			 */
			function vkCmdWidthOf(col) {
				try {
					const override = globalThis.__VK_CMD_WIDTH__;
					if (typeof override === "number" && Number.isFinite(override)) return Math.round(override);
				} catch { /* ignore */ }
				try { return Math.round(col.getBoundingClientRect().width); } catch { return -1; }
			}

			/**
			 * 从某元素往上找第一个会裁剪的祖先（没有就返回 null）——「插进去了却看不见」的第一嫌疑。
			 * @param {HTMLElement|null} start
			 */
			function vkCmdClipAncestor(start) {
				try {
					let node = start === null || start === undefined ? null : start.parentElement;
					for (let i = 0; node !== null && node !== undefined && i < 8; i++) {
						const cs = window.getComputedStyle(node);
						if (cs.overflow !== "visible") return String(node.className || node.tagName).slice(0, 24) + "(" + cs.overflow + ")";
						node = node.parentElement;
					}
				} catch { /* ignore */ }
				return null;
			}

			/**
			 * 「分割」实证的最新读数（每次落位 tick 刷新）。
			 * 排障口径：`JSON.stringify(__VK_CMD_DIAG__().split)` —— 判「真分割」看三条：
			 *   ① overlap === false（官方面板 bottom ≤ 命令行宿主 top，两者不相交）；
			 *   ② panelH 还有一段可用高度（不是被压没）；
			 *   ③ mode 是 "padding"（那一格的 padding 就够，没碰官方盒子）还是 "panel"（改用内联 bottom）。
			 */
			const vkCmdSplitState = { mode: "none", gap: null, panelH: null, hostTop: null, panelBottom: null, overlap: null, touchedOfficial: false, scroller: null, at: null };

			/**
			 * 官方面板里那个「真正在滚」的容器（只读测量）：在面板后代里找第一个 scrollHeight 明显大于
			 * clientHeight 的元素并回报它 —— 分割之后它必须还留着可用高度，否则官方拓展栏就被压没了。
			 */
			function vkCmdScrollerOf(root) {
				try {
					if (root === null || root === undefined) return null;
					const list = [root];
					for (let i = 0; i < list.length && i < 60; i++) {
						const el = list[i];
						try { for (const child of el.children) list.push(child); } catch { /* ignore */ }
						let sh = 0;
						let ch = 0;
						try { sh = Number(el.scrollHeight) || 0; ch = Number(el.clientHeight) || 0; } catch { /* ignore */ }
						if (el !== root && ch > 0 && sh > ch + 4) {
							return { cls: String(el.className || el.tagName).slice(0, 24), clientH: Math.round(ch), scrollH: Math.round(sh) };
						}
					}
				} catch { /* ignore */ }
				return null;
			}

			/**
			 * 深探针：落位失败时用来一次性看清「那一格是谁、定位模式是什么、面板到底在哪」。
			 * 排障用法（控制台）：`JSON.stringify(__VK_CMD_DIAG__())`
			 * build 字段本身就是版本自证——**没有这个函数 = 浏览器跑的还是旧 bundle**。
			 */
			function vkCmdDiag() {
				const box = (el) => {
					if (el === null || el === undefined) return null;
					try {
						const r = el.getBoundingClientRect();
						return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
					} catch { return null; }
				};
				const chain = [];
				try {
					let node = document.querySelector("[data-rightbar-col]");
					for (let i = 0; node !== null && node !== undefined && i < 8; i++) {
						let pos = "?";
						try { pos = window.getComputedStyle(node).position; } catch { /* ignore */ }
						chain.push({
							tag: node.tagName,
							cls: String(node.className || "").slice(0, 40),
							pos,
							overflow: (() => { try { return window.getComputedStyle(node).overflow; } catch { return "?"; } })(),
							inlineStyle: String(node.getAttribute("style") || "").slice(0, 90),
							rect: box(node)
						});
						node = node.parentElement;
					}
				} catch { /* ignore */ }
				const panel = (() => { try { return document.querySelector('[class*="_panel"][data-sidebar-right-panel], [data-sidebar-right-panel]'); } catch { return null; } })();
				const paneAttrs = panel === null ? null : {
					panel: panel.getAttribute("data-sidebar-right-panel"),
					open: panel.hasAttribute("data-sidebar-right-open"),
					position: (() => { try { return window.getComputedStyle(panel).position; } catch { return "?"; } })(),
					rect: box(panel)
				};
				const el = (() => { try { return document.querySelector("[data-vk-cmd-host]"); } catch { return null; } })();
				// 宿主是否真的落在视口里、是否被祖先裁剪 —— 「按钮蓝了却看不见下界」最需要这两条
				const hostRect = box(el);
				const inViewport = hostRect === null ? null
					: (hostRect.y >= 0 && hostRect.x >= 0 && hostRect.y < window.innerHeight && hostRect.x < window.innerWidth);
				const clippedBy = vkCmdClipAncestor(el);
				return {
					build: VK_CMD_BUILD,
					when: new Date().toISOString(),
					viewport: { w: window.innerWidth, h: window.innerHeight },
					paneOpen: vkCmdStore.paneOpen,
					paneFullscreen: vkCmdStore.paneFullscreen,
					open: vkCmdStore.open,
					heightPct: vkCmdStore.height,
					mount: globalThis.__VK_CMD_MOUNT__ ?? null,
					hostInViewport: inViewport,
					clippedBy: clippedBy,				host: el === null ? null : {
						parentCls: String((el.parentElement && el.parentElement.className) || "").slice(0, 40),
						isCol: (() => { try { return el.parentElement === document.querySelector("[data-rightbar-col]"); } catch { return false; } })(),
						colPos: (() => { try { return window.getComputedStyle(el.parentElement).position; } catch { return "?"; } })(),
						colPaddingBottom: el.parentElement === null ? null : el.parentElement.style.paddingBottom,
						zIndex: el.style.zIndex,
						pe: (() => { try { return window.getComputedStyle(el).pointerEvents; } catch { return "?"; } })(),
						children: el.childNodes.length,
						rect: box(el)
					},
					panel: paneAttrs,
					split: Object.assign({}, vkCmdSplitState),
					colChain: chain
				};
			}

			/**
			 * 找到官方右栏那一格（右栏的网格轨）。
			 *
			 * 2026-09-12 用真实 shell 的 DOM 核对过（`class="pI_x6G_rightbarCol"`）：
			 *   `<div class="*_rightbarCol" data-rightbar-col="true"><div data-slot="rightbar" style="display:contents"></div></div>`
			 *   它 `position:relative`（自带定位上下文，不用我们改）、`display:block`、`overflow:visible`；
			 *   收起时它是 frame 网格里的 `0px` 轨（宽 0），官方面板根本**不渲染**（面板在 slot 的 display:contents 里）。
			 * 所以：① 认这个标记（它比"面板的父节点"更稳：收起时没有面板）；② 才退回面板父节点；
			 *       ③ 最后样式兜底。**并排除 body/html**——绝对定位挂到 body 上就会横在中栏、还吃掉滚轮。
			 */
			function vkCmdFindCol() {
				const ok = (el) => el !== null && el !== undefined && el !== document.body && el !== document.documentElement && el.isConnected === true;
				try {
					const tagged = document.querySelector("[data-rightbar-col]");
					if (ok(tagged)) return tagged;
				} catch { /* ignore */ }
				// 官方右栏面板（`[data-sidebar-right-panel]`，CSS module 类 `_panel`；normal 时 absolute
				// top:0/bottom:0/right:0，fullscreen 时 fixed + inset:0）的父节点同样可以当那一格用。
				try {
					const panel = document.querySelector("[data-sidebar-right-panel]");
					if (panel !== null && ok(panel.parentElement)) {
						try { panel.parentElement.setAttribute("data-rightbar-col", "true"); } catch { /* ignore */ }
						return panel.parentElement;
					}
				} catch { /* ignore */ }
				// 兜底：按样式特征找「贴右缘的绝对定位那一格」，排除自身也被绝对定位的嵌套层、排除太窄的
				try {
					const winW = window.innerWidth;
					for (const cand of document.querySelectorAll("div")) {
						if (!ok(cand)) continue;
						const style = cand.getAttribute("style");
						if (style === null || style.indexOf("absolute") < 0 || style.indexOf("right") < 0) continue;
						const parent = cand.parentElement;
						if (parent !== null && parent.getAttribute("style") !== null && parent.getAttribute("style").indexOf("absolute") >= 0) continue;
						if (cand.getBoundingClientRect().width < Math.max(80, winW * 0.2)) continue;
						try { cand.setAttribute("data-rightbar-col", "true"); } catch { /* ignore */ }
						return cand;
					}
				} catch { /* ignore */ }
				return null;
			}

			/** 官方面板是否处于全屏模式（fullscreen 时它是 position:fixed;inset:0，上下分界无意义）。 */
			function vkCmdFullscreen() {
				try {
					const panel = document.querySelector("[data-sidebar-right-panel]");
					return panel !== null && panel.getAttribute("data-sidebar-right-panel") === "fullscreen";
				} catch { return false; }
			}

			/**
			 * 只读滚轮探针（排障用：查「中栏网页缩不动」）。
			 * 在**捕获阶段**旁听 Ctrl+滚轮，不改任何行为，把三件事写进面板标题行的诊断：
			 *   · ctrl=1 — Ctrl 键确实到了页面；
			 *   · at=<元素> — 光标下是谁（若带「(我方)」说明滚在命令行面板上，而不是网页上）；
			 *   · pd=1/0 — 默认行为有没有被 preventDefault（延时 60ms 读最终值）。
			 * 不装这个，就只能靠「缩不动」三个字猜是哪一环断的。
			 */
			function vkCmdInstallWheelProbe() {
				const onWheel = (event) => {
					try {
						if (event.ctrlKey !== true && event.metaKey !== true) return;
						const tag = (el) => (el === null || el === undefined ? "null" : String(el.tagName) + "." + String(el.className || "").slice(0, 20));
						const under = document.elementFromPoint(event.clientX, event.clientY);
						let mine = false;
						try { mine = under !== null && typeof under.closest === "function" && under.closest("[data-vk-cmd-host], [data-vk-cmd-panel]") !== null; } catch { mine = false; }
						const line = (pd) => "ctrl=1 dy=" + String(Math.round(event.deltaY)) + " at=" + tag(under) + (mine ? "(我方)" : "") + " pd=" + pd;
						vkCmdStore.setDiag(line("…"));
						window.setTimeout(() => { try { vkCmdStore.setDiag(line(event.defaultPrevented ? "1" : "0")); } catch { /* ignore */ } }, 60);
					} catch { /* 探针出错绝不影响滚轮本身 */ }
				};
				try { window.addEventListener("wheel", onWheel, { capture: true, passive: true }); } catch { /* ignore */ }
				return () => { try { window.removeEventListener("wheel", onWheel, { capture: true }); } catch { /* ignore */ } };
			}

			/**
			 * 命令行落位：宿主 = React 根 = 面板本体，按 store 的 open/height 把它插进官方右栏那一格。
			 * 订阅在构造时就接上——**断言只驱动 store**，不手动补 tick（否则会掩盖「订阅没接上」）。
			 * @param {HTMLElement} host - apply 里创建、createRoot 挂上的那个节点
			 */
			function vkCmdMount(host) {
				if (host === null || host === undefined) return () => {};
				let col = null;
				let pinnedPx = -1;
				/** 每 tick 实读的格子宽度（真实宽度会随侧栏动画/收起/全屏变化，不能只在插入时量一次）。 */
				let colWidth = -1;
				/** 被我们临时改成 relative 的那一格的原始 inline position（拔出时还原；绝不留痕在官方盒子上）。 */
				let colPosBackup = null;
				/** 「分割」实证结论：null=还没量；"padding"=那一格的 padding 就够（没碰官方盒子）；"panel"=必须动官方盒子的内联 bottom。 */
				let splitMode = null;
				/** 被我们改过内联 bottom 的官方盒子 + 原值（拔出时**原样**还原，绝不留痕）。 */
				let panelNudged = null;
				const pxOf = () => {
					if (vkCmdStore.open !== true || vkCmdStore.paneOpen !== true) return 0;
					return Math.max(VK_CMD_PX_MIN, Math.round((window.innerHeight * vkCmdStore.height) / 100));
				};
				const detach = () => {
					try { if (host.parentElement !== null) host.parentElement.removeChild(host); } catch { /* ignore */ }
					try {
						if (col !== null && col.isConnected === true && col.style.paddingBottom !== "") col.style.paddingBottom = "";
						if (col !== null && colPosBackup !== null) {
							col.style.position = colPosBackup;
							colPosBackup = null;
						}
						// 官方盒子的内联 bottom 原样还回去（换成别的官方盒子了也一样处理）
						if (panelNudged !== null && panelNudged.el !== null && panelNudged.el !== undefined) {
							try { panelNudged.el.style.bottom = panelNudged.bottom; } catch { /* ignore */ }
						}
						panelNudged = null;
						splitMode = null;
						vkCmdSplitState.mode = "detached";
						vkCmdSplitState.overlap = null;
						vkCmdSplitState.gap = null;
					} catch { /* ignore */ }
					pinnedPx = -1;
				};
				/**
				 * 「分割」实证（用户原话：让他分割拓展栏而不是遮挡）——**先量后判**，不信推理。
				 *
				 * 现行做法（给那一格 padding-bottom）理论上能让官方面板只占上段：面板是 absolute +
				 * top:0/bottom:0，包含块正是那一格的 padding box。但实测（2026-09-12，按真实结构复刻
				 * frame/col/slot/panel，4 种 box-sizing × height 组合各测一遍）：
				 *   · 给那一格 padding-bottom:300px → 官方面板高度 600 → **600**（纹丝不动，padding 只缩了
				 *     content box，stretch/height:100% 下 padding box 不变）；
				 *   · 把内联 bottom:300px 写到**官方盒子**上 → 面板高度 600 → **300**。
				 * 所以这里每次都实读两个 rect：还重叠才动官方盒子（原值留底、拔出还原），并如实报出用的是哪条。
				 * @param {number} px - 命令行面板高度（px）
				 */
				const splitCheck = (px) => {
					const out = { mode: splitMode === null ? "measuring" : splitMode, gap: null, panelH: null, hostTop: null, panelBottom: null, overlap: null, touchedOfficial: panelNudged !== null, scroller: null, at: Date.now() };
					try {
						const panel = document.querySelector("[data-sidebar-right-panel]");
						if (panel === null || panel === undefined) { Object.assign(vkCmdSplitState, out); return out; }
						const hr = host.getBoundingClientRect();
						const pr = panel.getBoundingClientRect();
						// 还没拿到真实布局（垫片/初始帧）：不judge，也不动任何东西
						if (hr.height <= 1 || hr.width <= 1 || pr.height <= 1) { Object.assign(vkCmdSplitState, out); return out; }
						out.hostTop = Math.round(hr.top);
						out.panelBottom = Math.round(pr.bottom);
						out.panelH = Math.round(pr.height);
						out.gap = Math.round(hr.top - pr.bottom);
						out.overlap = pr.bottom > hr.top + 1 && pr.top < hr.bottom - 1;
						if (out.overlap === true && splitMode !== "panel") {
							splitMode = "panel";
							panelNudged = { el: panel, bottom: panel.style.bottom };
							panel.style.bottom = px + "px";
							out.touchedOfficial = true;
							const p2 = panel.getBoundingClientRect();
							out.panelH = Math.round(p2.height);
							out.panelBottom = Math.round(p2.bottom);
							out.gap = Math.round(hr.top - p2.bottom);
							out.overlap = p2.bottom > hr.top + 1 && p2.top < hr.bottom - 1;
						} else if (out.overlap !== true && splitMode === null) {
							splitMode = "padding";
						}
						if (splitMode === "panel") {
							// 官方盒子被 React 换过节点：旧的还原、新的接上（否则会留下一个多出来的内联 bottom）
							if (panelNudged !== null && panelNudged.el !== panel) {
								try { if (panelNudged.el !== null && panelNudged.el !== undefined) panelNudged.el.style.bottom = panelNudged.bottom; } catch { /* ignore */ }
								panelNudged = { el: panel, bottom: panel.style.bottom };
							}
							if (panelNudged !== null && panel.style.bottom !== px + "px") panel.style.bottom = px + "px";
						}
						out.mode = splitMode === null ? "measuring" : splitMode;
						out.touchedOfficial = panelNudged !== null;
						out.scroller = vkCmdScrollerOf(panel);
					} catch { /* 量不到就什么都不动 */ }
					Object.assign(vkCmdSplitState, out);
					return out;
				};
				const tick = () => {
					vkCmdProbe({ ticks: ((globalThis.__VK_CMD_MOUNT__ ?? {}).ticks ?? 0) + 1 });
					// 官方右栏展开态 / 全屏态：收起或全屏时整块拔出（有状态的部分留在 store/模块级，重开即恢复）
					try {
						const sr = ctxRef.current === null ? void 0 : ctxRef.current.get("sidebarRight");
						if (sr !== void 0 && sr !== null && typeof sr.isExpanded === "function") vkCmdStore.setPaneOpen(sr.isExpanded() === true);
					} catch { /* 服务未就绪：按上次状态 */ }
					// 只在状态真的变了才写 store（setPaneFullscreen 内部已去重，这里避免每 tick 都读 DOM 属性）
					const wantFullscreen = vkCmdFullscreen();
					if (vkCmdStore.paneFullscreen !== wantFullscreen) vkCmdStore.setPaneFullscreen(wantFullscreen);
					const px = pxOf();
					if (px === 0) {
						detach();
						vkCmdProbe({ inCol: false, pinnedPx: 0, colFound: col !== null, fullscreen: wantFullscreen });
						return;
					}
					if (col === null || col.isConnected !== true) {
						col = vkCmdFindCol();
						// 换过格子：旧格子上留下的 padding/position 要清掉
						if (col !== null && colPosBackup !== null) { try { colPosBackup = null; } catch { /* ignore */ } }
					}
					if (col === null || col === document.body || col === document.documentElement) {
						vkCmdProbe({ colFound: false, inCol: false, fullscreen: wantFullscreen });
						col = null;
						return;
					}
					// 那一格宽度不够（含收起时 0px 的网格轨 / 全屏时被固定层接管）：不挂，并如实告诉用户。
					// 宽度**每 tick 实读**：侧栏收起/展开有过渡动画，只在插入时量一次会拿到中间值。
					let widthNow = -1;
					try { widthNow = vkCmdWidthOf(col); } catch { widthNow = -1; }
					if (widthNow >= 0) colWidth = widthNow;
					if (colWidth >= 0 && colWidth < VK_CMD_COL_MIN_W) {
						detach();
						vkCmdStore.setPaneCollapsed(true);
						vkCmdStore.setDiag("colW=" + String(colWidth) + " · 放不下 · " + VK_CMD_BUILD);
						vkCmdProbe({ colFound: true, inCol: false, colWidth, collapsed: true, pinnedPx: 0 });
						return;
					}
					vkCmdStore.setPaneCollapsed(false);
					try {
						// ⚠️ 关键一条（用户实测：按钮变蓝但下栏不出现 + 中栏网页缩不动）：
						// 宿主是 position:absolute，只有当**那一格自己是 positioned** 时，它才落在下段；
						// 若那一格是 static，绝对定位会往上找包含块 → 跑出右栏、盖在中栏上（既看不见又吃掉滚轮）。
						// 所以插入前先确保这一格是定位元素（记录原值，拔出时还原）。
						// （实测真实 shell 的 `_rightbarCol` 本来就是 relative，这里是兜底，不改就不动。）
						const computed = window.getComputedStyle(col);
						if (computed !== null && computed.position === "static") {
							if (colPosBackup === null) colPosBackup = col.style.position;
							col.style.position = "relative";
						}
					} catch { /* 取不到 computed 也不能拦着挂载 */ }
		const hostParent = wantFullscreen === true ? document.body : col;
		try {
			host.style.position = wantFullscreen === true ? "fixed" : "absolute";
			host.style.left = "0";
			host.style.right = "0";
			host.style.bottom = "0";
			host.style.width = "auto";
			host.style.height = px + "px";
			// z-index 必须**高于**官方面板：普通态面板 z-index:10（取 20），
			// 全屏态面板 position:fixed + z-index:40（取 60）。
			host.style.zIndex = wantFullscreen === true ? "60" : "20";
			host.style.pointerEvents = "auto";
					} catch { /* ignore */ }
					if (host.parentElement !== hostParent) {
						try { hostParent.appendChild(host); } catch (e) {
							vkCmdProbe({ err: "宿主插入失败：" + String(e && e.message ? e.message : e), inCol: false });
							col = null;
							return;
						}
					}
			if (wantFullscreen === true) {
				pinnedPx = px;
				try { if (col.style.paddingBottom !== "") col.style.paddingBottom = ""; } catch { /* ignore */ }
			} else if (pinnedPx !== px) {
				pinnedPx = px;
				try {
					col.style.paddingBottom = px + "px";
				} catch { /* ignore */ }
			}
					// 「分割」实证：padding 先试，**每次实读**两个 rect 判它到底有没有把官方面板抬起来；
					// 还重叠才动官方盒子的内联 bottom（见 splitCheck 上面那段实测）。
					const split = splitCheck(px);
					vkCmdProbe({
						colFound: true, inCol: host.parentElement === col, colWidth, pinnedPx: px, panelRendered: host.childElementCount > 0, err: null,
						split: split.mode, splitGap: split.gap, splitOverlap: split.overlap, splitPanelH: split.panelH, touchedOfficial: split.touchedOfficial
					});
					// 面板标题栏那行诊断（用户在真机上直接读，不用开控制台）。
					// 缩放那条**放在最前面**：这一行 max-width:46% + nowrap + ellipsis，只有开头一定看得见；
					// 完整串在 span 的 title 属性里（也能用 __VK_CMD_DIAG__() 读）。
					vkCmdStore.setDiag((vkZoomNote.text === "" ? "" : vkZoomNote.text + " · ") +
						"col=" + String(colWidth) + "x" + (() => { try { return Math.round(col.getBoundingClientRect().height); } catch { return -1; } })() +
						" pad=" + String(px) +
						" 分=" + vkCmdText(split.mode) + "(gap=" + vkCmdText(split.gap) + ",面板" + vkCmdText(split.panelH) + "px)" +
						" inCol=" + (host.parentElement === col ? "1" : "0") +
						" clip=" + vkCmdText(vkCmdClipAncestor(col)) +
						" · " + VK_CMD_BUILD);
				};
				tick();
				const timer = window.setInterval(tick, 1000);
				const onResize = () => tick();
				try { window.addEventListener("resize", onResize); } catch { /* ignore */ }
				const off = vkCmdStore.subscribe(tick);
				try { globalThis.__VK_CMD_TICK__ = tick; } catch { /* ignore */ }
				return () => {
					try { window.clearInterval(timer); } catch { /* ignore */ }
					try { window.removeEventListener("resize", onResize); } catch { /* ignore */ }
					try { off(); } catch { /* ignore */ }
					detach();
				};
			}

			/**
			 * 顶栏第 4 颗按钮（原生 DOM，不用 React）：1s 轮询补挂进
			 * [data-dockkit-strip-chrome]（官方重渲染会重建这个盒子，所以必须反复补）。
			 * 按钮的开关态直接订阅 store，与面板是否挂载无关。
			 */
			function vkCmdInstallButton() {
				const box = document.createElement("span");
				box.setAttribute("data-vk-cmd-strip-host", "true");
				box.style.cssText = "display:inline-flex;align-items:center;flex:none;";
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "vk_cmdChromeBtn";
				btn.setAttribute("data-vk-cmd-toggle", "true");
				box.appendChild(btn);
				const sync = () => {
					const on = vkCmdStore.open === true && vkCmdStore.paneOpen === true;
					btn.className = "vk_cmdChromeBtn" + (on ? " vk_cmdChromeBtnOn" : "");
					btn.title = vkCmdStore.paneCollapsed === true
						? "命令行：拓展栏这一格现在是 0 宽（收起态），先展开拓展栏"
						: (on ? "收起命令行（下界）" : "打开命令行（下界：持久 PowerShell 会话）");
					btn.setAttribute("aria-label", on ? "收起命令行" : "打开命令行");
					btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block">' + _VK_ICONS.panelBottom + "</svg>";
				};
				btn.addEventListener("click", (event) => {
					try { event.stopPropagation(); } catch { /* ignore */ }
					vkCmdStore.setOpen(vkCmdStore.open !== true);
				});
				const pump = () => {
					sync();
					let chrome = null;
					try { chrome = document.querySelector("[data-dockkit-strip-chrome]"); } catch { chrome = null; }
					if (chrome === null) {
						vkCmdProbe({ chrome: false, buttonInChrome: false });
						return;
					}
					if (box.parentElement !== chrome) {
						try { chrome.appendChild(box); } catch { /* ignore */ }
					}
					vkCmdProbe({ chrome: true, buttonInChrome: box.parentElement === chrome });
				};
				pump();
				const timer = window.setInterval(pump, 1000);
				const off = vkCmdStore.subscribe(sync);
				return () => {
					try { window.clearInterval(timer); } catch { /* ignore */ }
					try { off(); } catch { /* ignore */ }
					try { if (box.parentElement !== null) box.parentElement.removeChild(box); } catch { /* ignore */ }
				};
			}

			/**
			 * 右栏「本机文件」页签的类型 kind。
			 * 跨包约定：dsh-files-tree 用这个 kind 顶替官方的 files 类型并登记正文。
			 * 拆包（旧单机布局 → vk 套件）时这一行漏搬过，`sr.openTab(PICK_TAB_KIND, {})` 直接
			 * ReferenceError，被下面的 catch 吞掉 → 这颗按钮点了没反应。
			 */
			const PICK_TAB_KIND = "files";
			/** 在拓展栏里打开「本机文件」页签（复用自研已有 files 类型入口）。 */
			function vkCmdOpenLocalFiles() {
				try {
					const sr = ctxRef.current === null ? void 0 : ctxRef.current.get("sidebarRight");
					if (sr !== undefined && sr !== null && typeof sr.openTab === "function") {
						sr.openTab(PICK_TAB_KIND, {});
						return true;
					}
				} catch { /* 没有官方右栏服务时静默 */ }
				return false;
			}

			/** 下界面板本体（只有 open 时才被渲染；这里只管内部，自己的高宽由宿主给）。 */
			const VK_TERM_KEY = "vk-cmdline-term";
			/** 自己实现的 useTabInfo 返回的「页签」：id 必须 = 上面那个 key（TerminalBody 用它调 view/useTerminal）。 */
			const VK_TERM_TAB = { id: VK_TERM_KEY, title: "终端", visible: true };
			const VK_TERM_ENTRY_ID = "@deepseek-ai/dsh-client-ui-sidebar-terminal";
			/** 官方那个 entry 的 locale 命名空间（官方源码里就是这么注册的）。 */
			const VK_TERM_LOCALE = "sidebarTerminal";
			const VK_TERM_TRIES = 40;
			const VK_TERM_INTERVAL = 500;
			/** 拿不到 store 时的空快照（保证 hooks 调用链稳定，不抛）。 */
			const VK_TERM_EMPTY_STORE = { subscribe: () => () => {}, getSnapshot: () => void 0 };
			/**
			 * 服务不可用时的哑 view：让官方 TerminalBody 照常挂载（显示 loading）而不是在渲染期抛错
			 * ——「渲染期抛错 → 整棵树被卸载 → 下段空白」是本机 2026-09-17 踩过的坑。
			 */
			const VK_TERM_DEAD_VIEW = {
				state: VK_TERM_EMPTY_STORE,
				mount: () => () => {},
				connect: () => {},
				refresh: () => {},
				write: () => {},
				resize: () => {},
				rename: () => {},
				acknowledge: () => {},
				close: () => {}
			};
			/** 兜底文案（官方 locale 命名空间 sidebarTerminal 拿不到时用）。 */
			const VK_TERM_TEXT_ZH = {
				loading: "正在加载…", creating: "正在创建终端…", connecting: "正在连接…", disconnected: "连接已断开",
				exited: (params) => "进程已退出（代码 " + String(params.code ?? "—") + "）",
				unavailable: "终端不可用", closed: "终端已关闭", readonly: "只读：", control: "接管",
				retry: "重试", reconnect: "重新连接", title: "终端",
				failed: (params) => "终端失败：" + String(params.message ?? "")
			};
			const VK_TERM_TEXT_EN = {
				loading: "Loading…", creating: "Creating terminal…", connecting: "Connecting…", disconnected: "Disconnected",
				exited: (params) => "Exited (code " + String(params.code ?? "—") + ")",
				unavailable: "Unavailable", closed: "Closed", readonly: "Read-only:", control: "Take control",
				retry: "Retry", reconnect: "Reconnect", title: "Terminal",
				failed: (params) => "Terminal failed: " + String(params.message ?? "")
			};

			/**
			 * 官方终端条目：从 sidebar.right.pane.tab 的 entries 里找。
			 * 条目的字段形状是官方插槽给的，不保证每个字段都在 —— 所以按**多信号**认：key / id / name
			 * 命中官方包名、locale 命中 sidebarTerminal、或组件函数名就是 TerminalBody，任一命中即取。
			 * 命中信号写进 __VK_TERM_DIAG__（真机一眼看出「找到没 / 凭哪条认的 / 一共几条候选」）；
			 * 都没中就返回 null（面板显示等待态，不抛）。
			 */
			function vkTerminalEntry() {
				try {
					const ctx = ctxRef.current;
					if (ctx === null || ctx === void 0) return null;
					const entries = typeof ctx.slots.entries === "function" ? ctx.slots.entries("sidebar.right.pane.tab") : [];
					const seen = [];
					for (const entry of entries) {
						if (entry === null || entry === void 0) continue;
						const component = entry.component;
						if (typeof component !== "function") continue;
						let why = null;
						if (entry.key === VK_TERM_ENTRY_ID) why = "key";
						else if (entry.id === VK_TERM_ENTRY_ID) why = "id";
						else if (entry.name === VK_TERM_ENTRY_ID) why = "name";
						else if (entry.locale === VK_TERM_LOCALE) why = "locale";
						else if (component.name === "TerminalBody") why = "componentName";
						if (why === null) { seen.push(typeof component.name === "string" && component.name.length > 0 ? component.name : "anonymous"); continue; }
						try { globalThis.__VK_TERM_DIAG__ = { found: true, why, count: entries.length, seen }; } catch { /* ignore */ }
						return entry;
					}
					try { globalThis.__VK_TERM_DIAG__ = { found: false, why: null, count: entries.length, seen }; } catch { /* ignore */ }
				} catch { /* 右栏服务未就绪：面板显示等待态，不抛 */ }
				return null;
			}

			function vkTermFallback(key, params) {
				let en = false;
				try { en = String(window.navigator.language || "").toLowerCase().indexOf("en") === 0; } catch { en = false; }
				const table = en ? VK_TERM_TEXT_EN : VK_TERM_TEXT_ZH;
				const item = table[key];
				if (typeof item === "function") return item(params === null || params === void 0 ? {} : params);
				return item === void 0 ? key : item;
			}

			/** 文案：优先官方 locale.bind('sidebarTerminal')（与官方那条 entry 同一套），拿不到才自备。 */
			function vkTermText() {
				let bound = null;
				try {
					const locale = ctxRef.current === null || ctxRef.current === void 0 ? void 0 : ctxRef.current.locale;
					if (locale !== null && locale !== void 0 && typeof locale.bind === "function") bound = locale.bind("sidebarTerminal");
				} catch { bound = null; }
				if (typeof bound === "function") {
					return (key, params) => {
						try { return bound(key, params); } catch { return vkTermFallback(key, params); }
					};
				}
				return vkTermFallback;
			}

			/**
			 * 自己实现官方 TerminalBody 要的 5 个 props（照它的实现契约，不改官方包）。
			 *
			 * ⚠️ 真机教训（2026-09-17，DevTools 取证）：**绝不能用官方 entry 的 inject().view**。
			 * 官方那条 view 会先查官方右栏的 tab domain（「这个 key 在官方右栏里是不是一个已提交的
			 * 标签页」）——我们的下段 key 不是官方 tab，调用即抛
			 *   sidebarRight: tab "vk-cmdline-term" has no committed occurrence in session "…"
			 * → 渲染期抛错 → 整棵 React 树卸载 → 下段空白且毫无提示。
			 * 正解：走官方终端服务 ctx.get('webTerminals')（纯服务，**不碰 tab domain**）+ 插件自己的
			 * ctx.theme。服务调用一律在调用点兜错（任何异常都不许冒到渲染期）。
			 * @returns props 对象；会话还没就绪时返回 null（服务拿不到则返回哑 view，由出题态提示接管）。
			 */
			function vkTerminalProps(entry, sid) {
				if (sid.length === 0) return null;
				let svc = null;
				let svcErr = null;
				try { svc = ctxRef.current.get("webTerminals"); } catch (error) { svcErr = String(error && error.message ? error.message : error); }
				const usable = svc !== null && svc !== void 0 && typeof svc.view === "function";
				const callErr = { error: svcErr };
				/** 调服务取 view；**调用点兜错**（服务侧异常绝不冒到渲染期，否则整棵树被卸载）。 */
				const callView = (key) => {
					if (usable !== true) return null;
					try {
						const v = svc.view(sid, key);
						return v === null || v === void 0 ? null : v;
					} catch (error) {
						callErr.error = String(error && error.message ? error.message : error);
						return null;
					}
				};
				const view = (key) => {
					const v = callView(key);
					return v === null ? VK_TERM_DEAD_VIEW : v;
				};
				const storeOf = (key) => {
					const v = callView(key);
					return v === null ? null : v.state;
				};
				const via = usable === true ? "service" : "none";
				let themeObs = null;
				try {
					const ctx = ctxRef.current;
					if (ctx !== null && ctx !== void 0 && ctx.theme !== null && ctx.theme !== void 0) {
						themeObs = { getSnapshot: () => ctx.theme.getTheme(), subscribe: (listener) => ctx.on("theme/change", listener) };
					}
				} catch { themeObs = null; }
				if (themeObs === null) themeObs = { getSnapshot: () => void 0, subscribe: () => () => {} };
				// 就地诊断：真机「空白无提示」时，这几项就是根因（拿到哪条路 / 快照有没有 / 抛没抛）。
				let store = null;
				let probeErr = null;
				try { store = storeOf(VK_TERM_KEY); } catch (error) { probeErr = String(error && error.message ? error.message : error); }
				const probe = { via, sid, storeOk: store !== null && store !== void 0, probeErr, callErr: callErr.error };
				try { globalThis.__VK_TERM_DIAG__ = Object.assign(globalThis.__VK_TERM_DIAG__ ?? {}, probe); } catch { /* 痕迹只给排查用 */ }
				const useTabInfo = () => ({ tab: VK_TERM_TAB });
				const useTheme = (select) => {
					const ref = react.useRef(null);
					if (ref.current === null || ref.current.obs !== themeObs) {
						const cell = { obs: themeObs, sel: select, has: false, value: void 0, subs: new Set(), off: null, subscribe: null, snapshot: null };
						// ⚠️ 快照**只在主题变更通知时重算**：useSyncExternalStore 一旦每次拿到新对象就判定「变了」，
						// 立刻无限重渲染（实测：Maximum update depth exceeded + 整块白屏）。
						// 主题源换实现（getTheme() 每次返新对象）也照样稳。
						cell.subscribe = (fn) => {
							cell.subs.add(fn);
							if (cell.subs.size === 1) {
								cell.off = cell.obs.subscribe(() => {
									cell.has = false;
									for (const listener of [...cell.subs]) { try { listener(); } catch { /* ignore */ } }
								});
							}
							return () => {
								cell.subs.delete(fn);
								if (cell.subs.size === 0 && typeof cell.off === "function") {
									try { cell.off(); } catch { /* ignore */ }
									cell.off = null;
								}
							};
						};
						cell.snapshot = () => {
							if (cell.has !== true) { cell.value = cell.sel(cell.obs.getSnapshot()); cell.has = true; }
							return cell.value;
						};
						ref.current = cell;
					}
					const cell = ref.current;
					cell.sel = select;
					if (typeof react.useSyncExternalStore !== "function") return cell.snapshot();
					return react.useSyncExternalStore(cell.subscribe, cell.snapshot);
				};
				const useTerminal = (key) => {
					const store = storeOf(key);
					const ref = react.useRef(null);
					if (ref.current === null || ref.current.store !== store) {
						const cell = {
							store,
							target: store === null || store === void 0 ? VK_TERM_EMPTY_STORE : store,
							has: false,
							value: void 0,
							subscribe: null,
							snapshot: null
						};
						// ⚠️ 与 useTheme 同一条铁律：**getSnapshot 必须返回稳定引用**。
						// 直接透传 store.getSnapshot() 时，只要快照源每次调用都返新对象（快照库实现差异），
						// useSyncExternalStore 就判定「一直变了」→ Maximum update depth exceeded →
						// 整棵 React 树被卸载 → 下段**空白且无任何提示**（无错误边界时什么都看不到）。
						// 这里缓存值：只有订阅回调真的到达才失效，下一次 snapshot 才重算。
						cell.subscribe = (fn) => cell.target.subscribe(() => { cell.has = false; fn(); });
						cell.snapshot = () => {
							if (cell.has !== true) { cell.value = cell.target.getSnapshot(); cell.has = true; }
							return cell.value;
						};
						ref.current = cell;
					}
					const cell = ref.current;
					if (typeof react.useSyncExternalStore !== "function") return cell.snapshot();
					return react.useSyncExternalStore(cell.subscribe, cell.snapshot);
				};
				return { useTabInfo, useTerminal, useTheme, view, t: vkTermText(), probe };
			}

			/**
			 * 终端错误边界：官方 TerminalBody 万一在渲染期抛错，React 会**卸载整棵树** → 下段空白、
			 * 一点提示都没有（就是本机 2026-09-17 那次观测到的现象）。这一层把错误就地显示出来，
			 * 并留在 globalThis.__VK_TERM_ERROR__ 里供取证；切换会话时 key 变 → 自动重建重试。
			 */
			class VKTermBoundary extends react.Component {
				constructor(props) {
					super(props);
					this.state = { err: null };
				}
				static getDerivedStateFromError(error) {
					return { err: error };
				}
				componentDidCatch(error) {
					try { globalThis.__VK_TERM_ERROR__ = String(error && error.stack ? error.stack : error); } catch { /* 痕迹只给排查用 */ }
				}
				render() {
					if (this.state.err === null) return this.props.children;
					const message = this.state.err === null || this.state.err === void 0 ? "未知错误" : String(this.state.err.message ?? this.state.err);
					return h("div", { className: "vk_termNote" }, "官方终端渲染失败：" + message);
				}
			}

			/** 状态徽标：与官方 TerminalBody 用**同一套 props 契约**订阅同一个快照，把 phase 显示在标题行。 */
			function VKTermBadge(input) {
				const props = input === null || input === void 0 ? null : input.props;
				if (props === null) return h("span", { className: "vk_cmdBadge" }, "—");
				const state = props.useTerminal(VK_TERM_KEY);
				if (state === void 0 || state === null) return h("span", { className: "vk_cmdBadge" }, "无快照");
				const info = state.info;
				const alive = info !== null && info !== void 0 && typeof info.state === "string" ? "·" + info.state : "";
				return h("span", { className: "vk_cmdBadge", title: "终端状态（官方快照）" }, String(state.phase) + alive);
			}

			/**
			 * 下界面板 v2 本体：壳照旧（拖高 / 标题 / 收起），正文 = 官方 TerminalBody。
			 * 只在 open 时被渲染（收起即整棵卸载，进程不动）。
			 */
			function VKTerminalPanel() {
				const cmd = useVkCmdStore();
				const [entry, setEntry] = react.useState(() => vkTerminalEntry());
				const [sid, setSid] = react.useState(() => vkCurrentSessionId());
				const [waited, setWaited] = react.useState(false);

				// 官方终端条目就绪轮询：照 vkAttemptRightPane 的既有模式（有上限，到顶就显示失败文案，不抛）
				react.useEffect(() => {
					if (entry !== null) return void 0;
					let tries = 0;
					let timer = 0;
					const tick = () => {
						const found = vkTerminalEntry();
						if (found !== null) { setEntry(found); return; }
						tries += 1;
						if (tries >= VK_TERM_TRIES) { setWaited(true); return; }
						timer = window.setTimeout(tick, VK_TERM_INTERVAL);
					};
					tick();
					return () => { try { window.clearTimeout(timer); } catch { /* ignore */ } };
				}, [entry]);

				// 会话切换：官方 view 按 (sessionId, key) 索引 —— 换会话就换 view，旧会话的进程**不杀**（切回即恢复）
				react.useEffect(() => {
					const tick = () => {
						const next = vkCurrentSessionId();
						setSid((prev) => (prev === next ? prev : next));
					};
					const timer = window.setInterval(tick, VK_CMD_POLL_MS);
					return () => { try { window.clearInterval(timer); } catch { /* ignore */ } };
				}, []);

				const props = entry === null ? null : vkTerminalProps(entry, sid);
				const diag = (() => { try { return globalThis.__VK_TERM_DIAG__ ?? null; } catch { return null; } })();
				let note = "";
				if (entry === null) {
					const count = diag === null || diag.count === void 0 ? "?" : String(diag.count);
					note = waited
						? "官方终端服务未加载（候选 " + count + " 条，一条都没认出来 —— 看 __VK_TERM_DIAG__.seen）"
						: "正在等待官方终端服务…（候选 " + count + " 条）";
				} else if (props === null) {
					note = sid.length === 0 ? "正在等待会话…" : "官方终端入口不可用（webTerminals 拿不到）";
				} else if (props.probe.storeOk !== true) {
					const why = props.probe.probeErr !== null ? props.probe.probeErr : props.probe.callErr;
					note = "官方终端服务不可用（via=" + props.probe.via + "）" + (why === null ? "" : "：" + why);
				}

				return h("div", { className: "vk_termPanel", "data-vk-cmd-panel": "true" },
					h("div", { className: "vk_cmdHandle", "data-vk-cmd-handle": "true", title: "拖动调整终端高度", onPointerDown: (event) => {
						try {
							event.preventDefault();
							const panel = event.currentTarget.parentElement;
							const startY = event.clientY;
							const startH = panel === null ? vkCmdStore.height : (panel.getBoundingClientRect().height / Math.max(1, window.innerHeight)) * 100;
							const handle = event.currentTarget;
							try { handle.setPointerCapture(event.pointerId); } catch { /* ignore */ }
							handle.dataset.dragging = "1";
							const move = (ev) => {
								const deltaPct = ((startY - ev.clientY) / Math.max(1, window.innerHeight)) * 100;
								vkCmdStore.setHeight(startH + deltaPct);
							};
							const up = () => {
								delete handle.dataset.dragging;
								try { handle.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
								handle.removeEventListener("pointermove", move);
								handle.removeEventListener("pointerup", up);
								handle.removeEventListener("pointercancel", up);
							};
							handle.addEventListener("pointermove", move);
							handle.addEventListener("pointerup", up);
							handle.addEventListener("pointercancel", up);
						} catch { /* ignore */ }
					} }),
					h("div", { className: "vk_cmdHead" },
						h("span", { className: "vk_cmdTitle" }, h(VIcon, { name: "terminal", size: 13 }), "终端"),
						h("span", { className: "vk_cmdCwd", title: "官方本机 PTY（PowerShell）· 会话 " + (sid.length > 0 ? sid : "—") },
							sid.length > 0 ? "官方 PTY · " + vkCmdText(vkTermSessionLabel(sid)) : "等待会话"),
						// 就地诊断：真机上肉眼可见（不开控制台就能把故障定位到「哪一格/多宽/被谁裁」）
						h("span", { className: "vk_cmdDiag", "data-vk-cmd-diag": "true", title: "落位诊断：" + cmd.diag }, cmd.diag),
						props === null
							? h("span", { className: "vk_cmdBadge" }, entry === null ? "等待服务" : "—")
							: h(VKTermBadge, { key: "vk-term-badge", props }),
						h("span", { style: { flex: 1 } }),
						h("button", { type: "button", className: "vk_cmdIconBtn", title: "收起终端", "data-vk-cmd-hide": "true", onClick: () => vkCmdStore.setOpen(false) }, h(VIcon, { name: "chevronDown", size: 14 }))
					),
					h("div", { className: "vk_termHost", "data-vk-term-host": "true" },
						note.length > 0 ? h("div", { className: "vk_termNote" }, note) : null,
						props === null ? null : h(VKTermBoundary, { key: "vk-term-bound-" + sid },
							h(entry.component, Object.assign({ key: "vk-term-" + sid }, props))
						)
					)
				);
			}

			/** 会话标签（标题行显示用；只读前 8 位，不做任何会话状态推断）。 */
			function vkTermSessionLabel(sid) {
				return sid.length > 8 ? sid.slice(0, 8) : sid;
			}

			// ══════════════════════════════════════════════════════════════
			// 「新建终端」入口重定向（2026-09-17 用户要求）：
			//   点官方那几处「新建终端」不许在上段开官方标签，**直接展开下段终端**（只留下段这一个终端）。
			//   官方入口的 DOM 锚点是它自己给的：TerminalGuide 渲染的根节点带
			//   `data-sidebar-right-guide-entry="terminal"`，里面的主按钮 onClick 就是
			//   `tab.actions.openTab("terminal", { replaceTab: true })`；旁边那颗 chevron 展开 shell 菜单后
			//   也是 `openTab("terminal", { params: { shellPath } })`。两条都在这个根节点里。
			//   拦法：document **捕获阶段**吃 click 并 stopPropagation —— React 17+ 把合成事件挂在 root
			//   容器上，document 捕获早于它，于是官方 onClick 根本不执行、官方标签不会被创建。
			//   处理函数同时挂在 __VK_TERM_GUIDE_CLICK__ 上，供离线测试与真机取证直接调用。
			// ══════════════════════════════════════════════════════════════
			const VK_TERM_GUIDE_ATTR = "data-sidebar-right-guide-entry";
			const VK_TERM_GUIDE_KIND = "terminal";

			/** 从事件目标向上找官方「新建终端」入口；命中返回该节点，否则 null（不用 closest：垫片环境没有）。 */
			function vkGuideEntryOf(node) {
				let el = node !== null && node !== void 0 && node.nodeType === 3 ? node.parentElement : node;
				let depth = 0;
				while (el !== null && el !== void 0 && depth < 12) {
					try {
						if (typeof el.getAttribute === "function" && el.getAttribute(VK_TERM_GUIDE_ATTR) === VK_TERM_GUIDE_KIND) return el;
					} catch { return null; }
					el = el.parentElement;
					depth += 1;
				}
				return null;
			}

			/**
			 * 装上「新建终端 → 下段」拦截。
			 * @param ctx - 插件上下文（用它拿 sidebarRight 判断要不要先展开右栏）。
			 * @returns 卸载函数。
			 */
			function vkInstallTerminalGuideIntercept(ctx) {
				const handle = (event) => {
					try {
						if (event === null || event === void 0) return false;
						if (vkGuideEntryOf(event.target) === null) return false;
						if (typeof event.preventDefault === "function") event.preventDefault();
						if (typeof event.stopPropagation === "function") event.stopPropagation();
						try {
							const prev = globalThis.__VK_TERM_GUIDE_INTERCEPT__;
							globalThis.__VK_TERM_GUIDE_INTERCEPT__ = { at: Date.now(), count: (prev === null || prev === void 0 ? 0 : Number(prev.count) || 0) + 1 };
						} catch { /* 痕迹只给排查用 */ }
						// 右栏若被收起，先展开：下段要有落位的那一格
						try {
							const sr = ctx.get("sidebarRight");
							if (sr !== null && sr !== void 0 && typeof sr.isExpanded === "function" && sr.isExpanded() !== true && typeof sr.toggleExpanded === "function") sr.toggleExpanded();
						} catch { /* ignore */ }
						vkCmdStore.setOpen(true);
						return true;
					} catch { return false; }
				};
				try { globalThis.__VK_TERM_GUIDE_CLICK__ = handle; } catch { /* ignore */ }
				try { document.addEventListener("click", handle, true); } catch { /* ignore */ }
				return () => {
					try { document.removeEventListener("click", handle, true); } catch { /* ignore */ }
					try { if (globalThis.__VK_TERM_GUIDE_CLICK__ === handle) delete globalThis.__VK_TERM_GUIDE_CLICK__; } catch { /* ignore */ }
				};
			}


			function apply(ctx) {
				ctxRef.current = ctx;
				try { globalThis.__VK_CMD_BUILD__ = VK_CMD_BUILD; } catch { /* ignore */ }
				try { globalThis.__VK_CMDSTORE__ = vkCmdStore; } catch { /* ignore */ }
				try { globalThis.__VK_CMD_DIAG__ = vkCmdDiag; } catch { /* ignore */ }
				ctx.effect(() => {
					let host = null;
					let root = null;
					let unmountMount = () => {};
					let unmountButton = () => {};
					let unmountWheel = () => {};
					try {
						host = document.createElement("div");
						host.setAttribute("data-vk-cmd-host", "panel");
						host.style.cssText = "position:absolute;left:0;right:0;bottom:0;height:0;z-index:5;pointer-events:auto;";
						const client = require("react-dom/client");
						const dom = require("react-dom");
						const createRoot = client !== null && client !== void 0 && typeof client.createRoot === "function" ? client.createRoot : void 0;
						const flush = dom !== null && dom !== void 0 && typeof dom.flushSync === "function" ? () => { try { dom.flushSync(() => {}); } catch { /* ignore */ } } : () => {};
						const render = () => {
							const next = vkCmdStore.open === true ? h(VKTerminalPanel, { key: "vk-term-panel" }) : null;
							if (createRoot !== void 0) {
								if (root === null) root = createRoot(host);
								root.render(next);
							} else if (dom !== null && dom !== void 0 && typeof dom.render === "function") {
								dom.render(next, host);
							}
							flush();
						};
						render();
						const off = vkCmdStore.subscribe(render);
						unmountMount = vkCmdMount(host);
						unmountButton = vkCmdInstallButton();
						unmountWheel = vkCmdInstallWheelProbe();
						return () => {
							try { off(); } catch { /* ignore */ }
							try { unmountMount(); } catch { /* ignore */ }
							try { unmountButton(); } catch { /* ignore */ }
							try { unmountWheel(); } catch { /* ignore */ }
							try { if (root !== null) root.unmount(); } catch { /* ignore */ }
							try { if (host !== null && host.parentElement !== null) host.parentElement.removeChild(host); } catch { /* ignore */ }
						};
					} catch (error) {
						try { ctx.logger.warn("[dsh-vk-layout] 面板挂载失败：" + String(error)); } catch { /* ignore */ }
						return () => {
							try { unmountMount(); } catch { /* ignore */ }
							try { unmountButton(); } catch { /* ignore */ }
							try { unmountWheel(); } catch { /* ignore */ }
						};
					}
				}, "dsh-vk-layout: rightbar bottom panel");
				ctx.effect(() => vkInstallTerminalGuideIntercept(ctx), "dsh-vk-layout: terminal guide intercept");
			}
			return apply;
		})();

		/** 骨架接线 + 右栏下段命令行：后者挂在骨架之后，失败只告警不拖垮骨架。 */
		function apply(ctx) {
			vkLayoutApply(ctx);
			try {
				vkCmdStrip(ctx);
			} catch (error) {
				try { ctx.logger.warn("[dsh-vk-layout] 下段命令行挂载失败：" + String(error)); } catch { /* ignore */ }
			}
		}
		exports.apply = apply;
		exports.inject = ["slots"];
		exports.VIcon = VIcon;
		exports.VKTagStrip = VKTagStrip;
		exports.vkCreateMirror = vkCreateMirror;
		return module.exports;
	}
});
