// dsh-vk-settings — 设置页两个分区：Skill 管理 / MCP 管理。
window.__ModuleLoader__.load({
	id: 'dsh-vk-settings',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

		const react = require('react');
		const contract = require('dsh-vk-contract');
		const h = react.createElement;

		const VK = contract.VK;
		const vkCard = contract.vkCard;

		const ICONS = {
			refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
			plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
			close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
			power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
			trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
			check: '<path d="M20 6 9 17l-5-5"/>'
		};
		function VIcon({ name, size = 14 }) {
			const d = ICONS[name];
			if (!d) return null;
			return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', style: { flex: 'none', display: 'block' }, dangerouslySetInnerHTML: { __html: d } });
		}
		function IconBtn({ name, title, onClick, disabled, danger, primary, size }) {
			return h('button', {
				type: 'button',
				className: 'vk_iBtn' + (danger === true ? ' vk_iBtnDanger' : '') + (primary === true ? ' vk_iBtnPrimary' : ''),
				title, 'aria-label': title, disabled: disabled === true, onClick
			}, h(VIcon, { name, size: size === undefined ? 14 : size }));
		}
		function Dot({ on, title }) {
			return h('span', { className: 'vk_mgrDot' + (on === true ? ' vk_mgrDotOn' : ''), title });
		}

		const CSS = `
:root,body{--vk-accent:var(--dsw-alias-accent,var(--dsw-alias-state-business-primary))}
.vk_pane{display:flex;flex-direction:column;gap:10px;padding:16px;width:100%;box-sizing:border-box}
.vk_paneHead{display:flex;align-items:center;gap:6px}
.vk_paneFoot{display:flex;align-items:center;gap:8px}
.vk_paneMsg{font-size:12px;flex:1;min-width:0}
.vk_paneMsgOk{color:#73c991}
.vk_paneMsgErr{color:#f14c4c}
.vk_iBtn{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;transition:color .12s,background-color .12s,border-color .12s}
.vk_iBtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.vk_iBtn:disabled{opacity:.5;cursor:default}
.vk_iBtnDanger{color:#f14c4c;border-color:rgba(241,76,76,.35)}
.vk_iBtnDanger:hover{background:rgba(241,76,76,.1);color:#f14c4c}
.vk_iBtnPrimary{background:var(--vk-accent);color:#fff;border-color:transparent}
.vk_iBtnPrimary:hover{filter:brightness(1.1);color:#fff}
.vk_mgrList{display:flex;flex-direction:column;gap:8px}
.vk_mgrRow{display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 12px;background:var(--dsw-specific-input-fill,var(--dsw-specific-sidebar-fill))}
.vk_mgrInfo{flex:1;min-width:0}
.vk_mgrName{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vk_mgrMeta{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.vk_mgrDot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-tertiary);cursor:default}
.vk_mgrDotOn{background:#73c991}
.vk_mgrEmpty{font-size:12px;color:var(--dsw-alias-label-secondary);padding:18px 0;text-align:center}
.vk_mgrAddForm{display:flex;flex-direction:column;gap:8px;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;padding:12px}
.vk_mgrInput{background:var(--dsw-specific-input-fill,var(--dsw-specific-sidebar-fill));color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:6px 10px;font-size:12.5px;font-family:inherit}
.vk_mgrInput:focus{outline:none;border-color:var(--vk-accent)}
.vk_mgrLabel{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
`;
		(function injectCss() {
			if (typeof document === 'undefined') return;
			const plugin = 'dsh-vk-settings';
			for (const old of document.querySelectorAll('style[data-plugin="' + plugin + '"]')) { try { old.remove(); } catch { /* ignore */ } }
			const tag = document.createElement('style');
			tag.dataset.plugin = plugin;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		})();

		function VKSkillsPane() {
			const [skills, setSkills] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
			const [err, setErr] = react.useState(null);
			const refresh = react.useCallback(() => {
				let dead = false;
				setBusy(true);
				fetch('/vscode-files/skills')
					.then((r) => r.json())
					.then((d) => { if (!dead) { setSkills(d && d.ok ? d.skills : []); setErr(null); } })
					.catch((e) => { if (!dead) setErr(String(e)); })
					.finally(() => { if (!dead) setBusy(false); });
				return () => { dead = true; };
			}, []);
			react.useEffect(refresh, [refresh]);
			const act = (path, kind) => {
				setBusy(true);
				setErr(null);
				fetch('/vscode-files/skills/' + kind, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }) })
					.then((r) => r.json())
					.then((d) => { if (!d || !d.ok) setErr((d && d.error) || '操作失败'); refresh(); })
					.catch((e) => { setErr(String(e)); setBusy(false); });
			};
			return h('div', { className: 'vk_pane' },
				h('div', { className: 'vk_paneHead' },
					h('div', { style: { flex: 1 } }),
					h(IconBtn, { name: 'refresh', title: '刷新', disabled: busy, onClick: refresh })
				),
				err !== null ? h('div', { className: 'vk_paneMsg vk_paneMsgErr' }, String(err)) : null,
				skills === null ? h('div', { className: 'vk_mgrEmpty' }, '加载中…')
					: skills.length === 0 ? h('div', { className: 'vk_mgrEmpty' }, '~/.dsh/skills 为空')
						: h('div', { className: 'vk_mgrList' },
							skills.map((s) => h('div', { key: s.path, className: 'vk_mgrRow' },
								h(Dot, { on: s.enabled, title: s.enabled ? '已启用' : '已停用' }),
								h('div', { className: 'vk_mgrInfo' },
									h('div', { className: 'vk_mgrName' }, s.name),
									h('div', { className: 'vk_mgrMeta' }, s.path)
								),
								h(IconBtn, { name: 'power', title: s.enabled ? '关闭' : '开启', disabled: busy, onClick: () => act(s.path, 'toggle') }),
								h(IconBtn, { name: 'trash', title: '删除（送回收站）', danger: true, disabled: busy, onClick: () => { if (window.confirm('删除 Skill「' + s.name + '」？送回收站，可恢复。')) act(s.path, 'delete'); } })
							))
						)
			);
		}

		function VKMcpPane() {
			const [servers, setServers] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
			const [err, setErr] = react.useState(null);
			const [showAdd, setShowAdd] = react.useState(false);
			const [form, setForm] = react.useState({ serverName: '', transport: 'stdio', command: '', args: '', url: '', env: '{}' });
			const refresh = react.useCallback(() => {
				let dead = false;
				setBusy(true);
				fetch('/vscode-files/mcp')
					.then((r) => r.json())
					.then((d) => { if (!dead) { setServers(d && d.ok ? d.servers : []); setErr(null); } })
					.catch((e) => { if (!dead) setErr(String(e)); })
					.finally(() => { if (!dead) setBusy(false); });
				return () => { dead = true; };
			}, []);
			react.useEffect(refresh, [refresh]);
			const act = (id, kind) => {
				setBusy(true);
				setErr(null);
				fetch('/vscode-files/mcp/' + kind, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
					.then((r) => r.json())
					.then((d) => { if (!d || !d.ok) setErr((d && d.error) || '操作失败'); refresh(); })
					.catch((e) => { setErr(String(e)); setBusy(false); });
			};
			const submitAdd = () => {
				let env = {};
				try {
					env = JSON.parse(form.env || '{}');
					if (typeof env !== 'object' || env === null || Array.isArray(env)) throw new Error('not object');
				} catch {
					setErr('环境变量需为 JSON 对象');
					return;
				}
				setBusy(true);
				setErr(null);
				fetch('/vscode-files/mcp/add', {
					method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
						serverName: form.serverName.trim(),
						transport: form.transport,
						command: form.command.trim(),
						args: form.args.split(/[\s,]+/).filter(Boolean),
						url: form.url.trim(),
						env
					})
				})
					.then((r) => r.json())
					.then((d) => {
						setBusy(false);
						if (!d || !d.ok) setErr((d && d.error) || '添加失败');
						else {
							setShowAdd(false);
							setForm({ serverName: '', transport: 'stdio', command: '', args: '', url: '', env: '{}' });
							refresh();
						}
					})
					.catch((e) => { setBusy(false); setErr(String(e)); });
			};
			return h('div', { className: 'vk_pane' },
				h('div', { className: 'vk_paneHead' },
					h('div', { style: { flex: 1 } }),
					h(IconBtn, { name: showAdd ? 'close' : 'plus', title: showAdd ? '取消' : '添加 MCP server', onClick: () => setShowAdd(!showAdd) }),
					h(IconBtn, { name: 'refresh', title: '刷新', disabled: busy, onClick: refresh })
				),
				err !== null ? h('div', { className: 'vk_paneMsg vk_paneMsgErr' }, String(err)) : null,
				showAdd ? h('div', { className: 'vk_mgrAddForm' },
					h('div', { className: 'vk_mgrLabel' }, 'serverName'),
					h('input', { className: 'vk_mgrInput', value: form.serverName, onChange: (e) => setForm({ ...form, serverName: e.target.value }), placeholder: 'my-server' }),
					h('div', { className: 'vk_mgrLabel' }, '传输类型'),
					h('select', { className: 'vk_mgrInput', value: form.transport, onChange: (e) => setForm({ ...form, transport: e.target.value }) },
						h('option', { value: 'stdio' }, 'stdio（本地进程）'),
						h('option', { value: 'streamable-http' }, 'streamable-http（远程 URL）')
					),
					h('div', { className: 'vk_mgrLabel' }, form.transport === 'stdio' ? '命令（参数用空格/逗号分隔）' : 'URL'),
					form.transport === 'stdio'
						? h('input', { className: 'vk_mgrInput', value: form.command, onChange: (e) => setForm({ ...form, command: e.target.value }), placeholder: 'npx @playwright/mcp@latest --browser msedge' })
						: h('input', { className: 'vk_mgrInput', value: form.url, onChange: (e) => setForm({ ...form, url: e.target.value }), placeholder: 'https://example.com/mcp' }),
					h('div', { className: 'vk_mgrLabel' }, form.transport === 'stdio' ? '环境变量' : '请求头'),
					h('input', { className: 'vk_mgrInput', value: form.env, onChange: (e) => setForm({ ...form, env: e.target.value }), placeholder: '{"KEY":"value"}' }),
					h('div', { className: 'vk_paneFoot' },
						h('div', { style: { flex: 1 } }),
						h(IconBtn, { name: 'check', title: '添加并启用', primary: true, disabled: busy, onClick: submitAdd, size: 15 })
					)
				) : null,
				servers === null ? h('div', { className: 'vk_mgrEmpty' }, '加载中…')
					: servers.length === 0 ? h('div', { className: 'vk_mgrEmpty' }, '暂无 MCP server')
						: h('div', { className: 'vk_mgrList' },
							servers.map((s) => h('div', { key: s.id, className: 'vk_mgrRow' },
								h(Dot, { on: s.enabled, title: s.enabled ? '已启用' : '已停用' }),
								h('div', { className: 'vk_mgrInfo' },
									h('div', { className: 'vk_mgrName' }, s.serverName),
									h('div', { className: 'vk_mgrMeta' }, (s.transport === 'stdio' ? (s.command || 'stdio') : (s.url || 'http')) + (s.hasEnv ? ' · 含环境变量' : ''))
								),
								h(IconBtn, { name: 'power', title: s.enabled ? '关闭' : '开启', disabled: busy, onClick: () => act(s.id, 'toggle') }),
								h(IconBtn, { name: 'trash', title: '删除', danger: true, disabled: busy, onClick: () => { if (window.confirm('删除 MCP「' + s.serverName + '」？')) act(s.id, 'delete'); } })
							))
						)
			);
		}

		function apply(ctx) {
			vkCard(ctx, { slot: VK.settings.skills, id: 'skills', order: 20, component: VKSkillsPane });
			vkCard(ctx, { slot: VK.settings.mcp, id: 'mcp', order: 30, component: VKMcpPane });
		}

		exports.apply = apply;
		exports.inject = ['slots'];
		return module.exports;
	}
});
