// dsh-vk-settings-hub — host 半：插件市场与启停管理的后端。
//   GET  /dsh-hub/market          → 拉取插件市场清单（外网，失败要给明确回显）
//   POST /dsh-hub/market/install  → body { spec }：dsh plugin add <spec>（--profile web）
//   GET  /dsh-hub/plugins         → Loader 全局层行（只读运行态）× cordis.patch.yml（可写启停态）
//   POST /dsh-hub/plugins/toggle  → body { id, disabled }：改 profile 的 cordis.patch.yml（写前备份）
// 所有子进程隐藏执行、stdio 丢弃，结果靠退出码与文件交换。模型不触达这些路由。

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, copyFileSync, statSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const name = "dsh-vk-settings-hub";
export const inject = ["webServer"];

const ROOT = process.env.DSH_ROOT || join(homedir(), "DeepSeek_harness");
const DSH_CLI = join(ROOT, "node_modules", ".bin", "dsh.cmd");
const PROFILE_DIR = join(homedir(), ".dsh", "profiles", "web");
const PROFILE_JSON = join(PROFILE_DIR, "package.json");
const PATCH_FILE = join(PROFILE_DIR, "cordis.patch.yml");
const BACKUP_DIR = process.env.DSH_HUB_BACKUP_DIR ?? join(ROOT, "backups", "settings-hub-plugin-toggles");
const CACHE_DIR = process.env.DSH_HUB_CACHE_DIR ?? join(ROOT, "tmp");
/* 市场清单两个源（2026-09-29 实测）：
   · awesome —— 目录最全（4382 条，带 capabilities / 能力红线 / 中英描述 / 截图），但只有收录日期；
   · 1024    —— 官方站点索引（catalogTotal 13734，公开接口给前 500 条），带真实安装数、stars/forks、
                pushedAt/updatedAt 与 installMethods 里 verified 的安装源。
   两个都落盘、合并后给前端；某个源拉不到只影响它自己，另一个照常用。 */
const MARKET_SOURCES = [
	{ id: "awesome", url: "https://awesome-dsh-plugin.com/plugins.json", cache: join(CACHE_DIR, "dsh-market-cache.json") },
	{ id: "1024", url: "https://deepseek1024.com/api/v1/plugins", cache: join(CACHE_DIR, "dsh-market-1024-cache.json") },
];
/* 清单实测 4.7MB + 2.3MB：12s 那版只够握手，正文要几十秒，必然 abort。
   放大到 180s，并把拿到的清单落盘，之后秒开 + 后台刷新。 */
const MARKET_TIMEOUT_MS = 180000;
const MARKET_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const LOG = join(ROOT, "logs", "dsh-vk-settings-hub.log");
const LOG_MAX_BYTES = 1024 * 1024;
const INSTALL_TIMEOUT_MS = 180000;

function log(msg) {
	try {
		if (statSync(LOG).size > LOG_MAX_BYTES) {
			const old = LOG + ".1";
			try { copyFileSync(LOG, old); } catch { /* ignore */ }
			writeFileSync(LOG, "", "utf8");
		}
	} catch { /* 还不存在 */ }
	try { appendFileSync(LOG, new Date().toISOString() + " " + msg + "\n"); } catch { /* ignore */ }
}

function readJson(file) {
	try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}

/** 幂等键：只允许包名/路径/URL 形态，杜绝把 shell 元字符带进命令行。
    github:/gitlab:/bitbucket:/gist: 是 npm 的托管 git 简写，市场清单里 1901 条就是这个形态。 */
const SPEC_RE = /^(file:|git\+|github:|gitlab:|bitbucket:|gist:|https?:\/\/|@?[A-Za-z0-9._@/-]+(\.tgz)?$)/;
function specSafe(spec) {
	return typeof spec === "string" && spec.length > 0 && spec.length < 300 && SPEC_RE.test(spec) && !/[&|<>^"'\s]/.test(spec);
}

function runDsh(args, timeoutMs) {
	return new Promise((resolveRun) => {
		const started = Date.now();
		let settled = false;
		const finish = (code) => { if (!settled) { settled = true; resolveRun({ code, ms: Date.now() - started }); } };
		try {
			const child = spawn("cmd.exe", ["/c", DSH_CLI].concat(args), { stdio: "ignore", windowsHide: true });
			const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish(-2); }, timeoutMs);
			child.on("exit", (code) => { clearTimeout(timer); finish(code === null || code === undefined ? -1 : code); });
			child.on("error", (e) => { clearTimeout(timer); log("spawn error: " + (e && e.message)); finish(-1); });
		} catch (e) {
			log("spawn threw: " + (e && e.message));
			finish(-1);
		}
	});
}

/* ── cordis.patch.yml 的行级编辑（保住原有注释与顺序） ── */
const ID_RE = /^[A-Za-z0-9@/._-]+$/;

function findRow(lines, id) {
	for (let i = 0; i < lines.length; i += 1) {
		const m = /^- id:\s*(\S+)\s*$/.exec(lines[i]);
		if (m && m[1] === id) {
			let end = i + 1;
			while (end < lines.length && /^\s+\S/.test(lines[end])) end += 1;
			return { start: i, end };
		}
	}
	return null;
}

function readPatch(file) {
	try { return readFileSync(file === undefined ? PATCH_FILE : file, "utf8").split(/\r?\n/); } catch { return null; }
}

function patchState(file) {
	const lines = readPatch(file);
	const out = new Map();
	if (lines === null) return out;
	for (let i = 0; i < lines.length; i += 1) {
		const m = /^- id:\s*(\S+)\s*$/.exec(lines[i]);
		if (!m) continue;
		const row = findRow(lines, m[1]);
		const block = lines.slice(row.start, row.end);
		out.set(m[1], block.some((l) => /^\s+disabled:\s*true\s*$/.test(l)));
	}
	return out;
}

function profilePluginIds(file) {
	const pkg = readJson(file === undefined ? PROFILE_JSON : file);
	if (pkg === null) return [];
	const deps = pkg.dependencies === undefined ? {} : pkg.dependencies;
	const bundles = (pkg.dsh?.profile?.bundles) ?? [];
	const ids = new Set(Object.keys(deps));
	for (const b of bundles) ids.add(b);
	return Array.from(ids).sort();
}

/* ── Loader 运行态（只读）：与官方「插件列表」同源 ──
   官方 pluginInventory 是只读 host 服务，取的正是 Loader 当前的 entry 快照；拿不到时直接读
   Loader 兜底（同一个真相，只是少了预设组成那一段）。两者都拿不到才返回 null。 */
const FIBER_PHASE = { 0: "pending", 1: "loading", 2: "active", 3: "failed", 4: null, 5: "unloading" };

function moduleNameOf(entry) {
	const raw = entry.options === undefined || entry.options === null ? undefined : entry.options.name;
	if (typeof raw === "string" && raw.length > 0) return raw;
	if (typeof raw === "function" && typeof raw.name === "string" && raw.name.length > 0) return raw.name;
	return String(entry.id);
}

function projectEntry(entry) {
	const fiber = entry.fiber;
	return {
		entryId: String(entry.id),
		moduleName: moduleNameOf(entry),
		enabled: entry.disabled !== true,
		fiberPhase: fiber === undefined || fiber === null ? null : (FIBER_PHASE[fiber.state] ?? null),
	};
}

async function loaderSnapshot(ctx) {
	try {
		const inventory = ctx.get("pluginInventory");
		if (inventory !== undefined && inventory !== null && typeof inventory.list === "function") {
			const snapshot = await inventory.list();
			if (snapshot !== null && typeof snapshot === "object" && Array.isArray(snapshot.entries)) {
				return { via: "pluginInventory", entries: snapshot.entries, presets: Array.isArray(snapshot.agentPresets) ? snapshot.agentPresets : [] };
			}
		}
	} catch (e) {
		log("pluginInventory.list failed: " + String((e && e.message) || e));
	}
	try {
		const loader = ctx.get("loader");
		if (loader !== undefined && loader !== null && typeof loader.entries === "function") {
			const entries = [];
			for (const entry of loader.entries()) {
				if (entry.options !== undefined && entry.options !== null && entry.options.group) continue;
				entries.push(projectEntry(entry));
			}
			return { via: "loader", entries, presets: [] };
		}
	} catch (e) {
		log("loader.entries failed: " + String((e && e.message) || e));
	}
	return null;
}

/**
 * 全局层每一行：id 是 Loader 的 entryId（也就是 cordis.patch.yml 里的 `- id:`），
 * 两条互不相干的轴——loader* 是当前进程的运行态（只读），patch* 是下一次启动的启停态（可写）。
 */
async function pluginRows(ctx) {
	const state = patchState();
	const known = new Set(profilePluginIds());
	const snapshot = await loaderSnapshot(ctx);
	const providers = new Map();
	if (snapshot !== null) {
		for (const preset of snapshot.presets) {
			const label = String(preset.name || preset.id || "预设");
			for (const row of (Array.isArray(preset.rows) ? preset.rows : [])) {
				if (row.enabled !== true) continue;
				const list = providers.get(String(row.moduleName));
				if (list === undefined) providers.set(String(row.moduleName), [label]);
				else if (!list.includes(label)) list.push(label);
			}
		}
	}
	const rows = [];
	const seen = new Set();
	for (const entry of (snapshot === null ? [] : snapshot.entries)) {
		const id = String(entry.entryId || entry.moduleName || "");
		if (id.length === 0 || seen.has(id)) continue;
		seen.add(id);
		const module = String(entry.moduleName || "");
		rows.push({
			id,
			module,
			base: id.indexOf("@deepseek-ai/") === 0,
			installed: known.has(module) || known.has(id),
			orphan: false,
			presets: providers.get(module) ?? [],
			loaderEnabled: entry.enabled === true,
			phase: entry.fiberPhase === undefined ? null : entry.fiberPhase,
			patchPresent: state.has(id),
			patchDisabled: state.get(id) === true,
		});
	}
	/* patch 表里还有、Loader 里已经没有的行（旧 id / 拼错）：照样列出来，否则改不回去 */
	for (const [id, disabled] of state) {
		if (seen.has(id)) continue;
		rows.push({
			id,
			module: "",
			base: id.indexOf("@deepseek-ai/") === 0,
			installed: known.has(id),
			orphan: true,
			presets: [],
			loaderEnabled: null,
			phase: null,
			patchPresent: true,
			patchDisabled: disabled,
		});
	}
	return { rows, via: snapshot === null ? null : snapshot.via };
}

/** 改一行插件的启停：写前把整份 patch 文件备份到备份区，失败不改文件。 */
function applyPluginPatch(id, disabled, options) {
	const config = options === undefined || options === null ? {} : options;
	const file = config.file === undefined ? PATCH_FILE : config.file;
	const backupDir = config.backupDir === undefined ? BACKUP_DIR : config.backupDir;
	if (!ID_RE.test(id)) return { ok: false, error: "bad id" };
	const lines = readPatch(file);
	if (lines === null) return { ok: false, error: "patch file unreadable: " + file };
	const row = findRow(lines, id);
	let next = lines.slice();
	let dirty = false;
	if (disabled === true) {
		if (row === null) {
			while (next.length > 0 && next[next.length - 1].trim() === "") next.pop();
			next.push("- id: " + id, "  disabled: true", "");
			dirty = true;
		} else if (!next.slice(row.start, row.end).some((l) => /^\s+disabled:\s*true\s*$/.test(l))) {
			next.splice(row.start + 1, 0, "  disabled: true");
			dirty = true;
		}
	} else {
		if (row === null) return { ok: true, changed: false };
		const block = next.slice(row.start, row.end);
		const at = block.findIndex((l) => /^\s+disabled:\s*true\s*$/.test(l));
		if (at < 0) return { ok: true, changed: false };
		if (block.length <= 2) next.splice(row.start, 2);
		else next.splice(row.start + at, 1);
		dirty = true;
	}
	if (!dirty) return { ok: true, changed: false };
	try { mkdirSync(backupDir, { recursive: true }); } catch { /* ignore */ }
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	let backup = "";
	try {
		const named = join(backupDir, "cordis.patch.yml." + stamp);
		copyFileSync(file, named);
		backup = named;
	} catch (e) {
		return { ok: false, error: "backup failed: " + (e && e.message) };
	}
	try {
		writeFileSync(file, next.join("\n"), "utf8");
	} catch (e) {
		return { ok: false, error: "write failed: " + (e && e.message) };
	}
	return { ok: true, changed: true, backup };
}

/** 市场清单的载荷可能是数组，也可能是包着数组的对象；数组字段名按候选兜底找一遍。 */
function parseMarket(data) {
	if (Array.isArray(data)) return data;
	if (data !== null && typeof data === "object") {
		for (const key of ["plugins", "packages", "items", "data", "list", "entries"]) {
			if (Array.isArray(data[key])) return data[key];
		}
		for (const key of Object.keys(data)) if (Array.isArray(data[key])) return data[key];
	}
	return null;
}

/** 两个源的分类都是 en/zh 双语；统一成 { id: { en, zh } } 再合并。 */
function normalizeCategories(raw) {
	const out = {};
	if (Array.isArray(raw)) {
		for (const item of raw) {
			if (item === null || typeof item !== "object" || typeof item.id !== "string") continue;
			out[item.id] = { en: String(item.en || item.id), zh: String(item.zh || item.en || item.id) };
		}
	} else if (raw !== null && typeof raw === "object") {
		for (const [id, value] of Object.entries(raw)) {
			if (value === null || typeof value !== "object") continue;
			out[id] = { en: String(value.en || id), zh: String(value.zh || value.en || id) };
		}
	}
	return out;
}

function marketCacheOf(source) {
	try {
		const c = JSON.parse(readFileSync(source.cache, "utf8"));
		if (Array.isArray(c?.plugins) && typeof c.fetchedAt === "string") {
			source.categories = normalizeCategories(c.categories);
			return { fetchedAt: c.fetchedAt, plugins: c.plugins };
		}
	} catch { /* 还没缓存 / 缓存坏了 */ }
	return null;
}

function writeMarketCache(source, plugins, categories) {
	source.categories = normalizeCategories(categories);
	try {
		mkdirSync(CACHE_DIR, { recursive: true });
		writeFileSync(source.cache, JSON.stringify({ fetchedAt: new Date().toISOString(), plugins, categories }), "utf8");
	} catch (e) {
		log("market cache write failed " + source.id + ": " + String((e && e.message) || e));
	}
}

const marketInFlight = new Map();
/** 每个源同一时刻只拉一份（并发调用共享同一个 promise）。 */
function fetchMarket(source) {
	if (marketInFlight.has(source.id)) return marketInFlight.get(source.id);
	const job = (async () => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), MARKET_TIMEOUT_MS);
		try {
			const r = await fetch(source.url, { signal: controller.signal, headers: { accept: "application/json" } });
			if (!r.ok) throw new Error(source.id + " http " + r.status);
			const payload = JSON.parse(await r.text());
			const list = parseMarket(payload);
			if (list === null) throw new Error(source.id + " payload carries no array of plugins");
			writeMarketCache(source, list, payload !== null && typeof payload === "object" ? payload.categories : null);
			return list;
		} finally {
			clearTimeout(timer);
			marketInFlight.delete(source.id);
		}
	})();
	marketInFlight.set(source.id, job);
	return job;
}

function marketError(e, source) {
	return e !== null && e !== undefined && e.name === "AbortError"
		? source.id + " timeout after " + Math.round(MARKET_TIMEOUT_MS / 1000) + "s"
		: String((e && e.message) || e);
}

/* ── 两源合并：目录（awesome）× 度量（1024） ──
   合并键按可靠度排：npm / installMethods 的 spec → 仓库 URL → owner/name。
   对上就把度量挂到目录行上，对不上就整条补进来（那批目录里根本没有）。 */
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v) => (typeof v === "string" && v.length > 0 ? v : null);
const urlKeyOf = (u) => String(u || "").toLowerCase().replace(/^git\+/, "").replace(/\.git$/, "").replace(/\/+$/, "");
const ownerKeyOf = (p) => String(p.owner || "").toLowerCase() + "/" + String(p.name || "").toLowerCase();

function specKeysOf(p) {
	const out = [];
	if (typeof p.npm === "string" && p.npm.length > 0) out.push(p.npm.toLowerCase());
	const methods = Array.isArray(p.installMethods) ? p.installMethods : [];
	for (const m of methods) if (m !== null && typeof m === "object" && typeof m.spec === "string" && m.spec.length > 0) out.push(m.spec.toLowerCase());
	return out;
}

function metricsOf(b) {
	return {
		installs: num(b.installCount),
		users: num(b.installerCount),
		installs7d: num(b.installs7d),
		installs30d: num(b.installs30d),
		downloads7d: num(b.npmDownloads7d),
		stars: num(b.stars),
		forks: num(b.forks),
		failures: num(b.failureCount),
		updatedAt: str(b.pushedAt) ?? str(b.updatedAt),
		releasedAt: str(b.latestReleaseAt),
	};
}

function mergeMarket(bySource) {
	const rows = [];
	const bySpec = new Map();
	const byUrl = new Map();
	const byOwner = new Map();
	const index = (row) => {
		rows.push(row);
		for (const s of specKeysOf(row)) if (!bySpec.has(s)) bySpec.set(s, row);
		const u = urlKeyOf(row.url);
		if (u.length > 0 && !byUrl.has(u)) byUrl.set(u, row);
		const o = ownerKeyOf(row);
		if (!byOwner.has(o)) byOwner.set(o, row);
	};
	for (const row of bySource.awesome) index(Object.assign({}, row, { src: ["awesome"] }));
	for (const row of bySource.metrics) {
		let hit = null;
		for (const s of specKeysOf(row)) {
			if (bySpec.has(s)) { hit = bySpec.get(s); break; }
		}
		if (hit === null) {
			const u = urlKeyOf(row.url);
			if (u.length > 0 && byUrl.has(u)) hit = byUrl.get(u);
		}
		if (hit === null && byOwner.has(ownerKeyOf(row))) hit = byOwner.get(ownerKeyOf(row));
		if (hit !== null) {
			if (!hit.src.includes("1024")) hit.src.push("1024");
			hit.metrics = metricsOf(row);
			if (typeof hit.stars !== "number" && typeof row.stars === "number") hit.stars = row.stars;
			continue;
		}
		const methods = Array.isArray(row.installMethods) ? row.installMethods : [];
		const npm = methods.find((m) => m !== null && typeof m === "object" && m.kind === "npm" && str(m.spec) !== null);
		const revision = methods.map((m) => (m !== null && typeof m === "object" ? m.revision : null)).find((v) => str(v) !== null);
		const extra = Object.assign({}, row, {
			src: ["1024"],
			name: String(row.name || ""),
			owner: String(row.owner || ""),
			npm: npm === undefined ? undefined : npm.spec,
			version: str(row.version) ?? str(revision) ?? undefined,
			added: str(row.added) ?? undefined,
			metrics: metricsOf(row),
		});
		index(extra);
	}
	return rows;
}

function mergeCategories(sources) {
	const out = {};
	for (const source of sources) {
		for (const [id, value] of Object.entries(source.categories ?? {})) if (out[id] === undefined) out[id] = value;
	}
	return out;
}

export function apply(ctx) {
	const webServer = ctx.get("webServer");
	if (!webServer) {
		log("webServer service unavailable, /dsh-hub/* not registered");
		return;
	}
	const send = (res, body, status) => {
		res.writeHead(status === undefined ? 200 : status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
		res.end(JSON.stringify(body));
	};
	const readBody = (req) => new Promise((resolveRead) => {
		const chunks = [];
		req.on("data", (c) => chunks.push(c));
		req.on("end", () => resolveRead(Buffer.concat(chunks).toString("utf8")));
		req.on("error", () => resolveRead(""));
	});

	webServer.register({
		kind: "exact",
		path: "/dsh-hub/market",
		handler: async (req, res) => {
			const lists = new Map();
			const reports = [];
			const missing = [];
			let refreshing = false;
			for (const source of MARKET_SOURCES) {
				const cached = marketCacheOf(source);
				if (cached === null) {
					lists.set(source.id, []);
					missing.push(source);
					continue;
				}
				lists.set(source.id, cached.plugins);
				const age = Date.now() - Date.parse(cached.fetchedAt);
				const fresh = Number.isFinite(age) && age < MARKET_CACHE_MAX_AGE_MS;
				if (!fresh) {
					/* 旧清单先给出去，后台悄悄刷新；拉不到就继续用旧的，别把页面卡空 */
					refreshing = true;
					fetchMarket(source)
						.then((list) => log("market cache refreshed " + source.id + ": " + list.length))
						.catch((e) => log("market refresh failed " + source.id + ": " + marketError(e, source)));
				}
				reports.push({ id: source.id, ok: true, fromCache: true, count: cached.plugins.length, fetchedAt: cached.fetchedAt });
			}
			for (const source of missing) {
				try {
					const list = await fetchMarket(source);
					lists.set(source.id, list);
					reports.push({ id: source.id, ok: true, fromCache: false, count: list.length, fetchedAt: new Date().toISOString() });
				} catch (e) {
					const msg = marketError(e, source);
					log("market fetch failed " + source.id + ": " + msg);
					reports.push({ id: source.id, ok: false, fromCache: false, count: 0, fetchedAt: null, error: msg });
				}
			}
			const plugins = mergeMarket({ awesome: lists.get("awesome") ?? [], metrics: lists.get("1024") ?? [] });
			if (plugins.length === 0) {
				const first = reports.find((r) => r.ok !== true);
				send(res, { ok: false, error: first === undefined ? "market empty" : first.error });
				return;
			}
			const stamps = reports.map((r) => r.fetchedAt).filter((v) => typeof v === "string").sort();
			send(res, {
				ok: true,
				plugins,
				fetchedAt: stamps.length === 0 ? new Date().toISOString() : stamps[stamps.length - 1],
				cached: reports.some((r) => r.fromCache === true),
				refreshing,
				sources: reports,
				categories: mergeCategories(MARKET_SOURCES),
			});
		},
	});

	webServer.register({
		kind: "exact",
		path: "/dsh-hub/market/install",
		handler: async (req, res) => {
			if (req.method !== "POST") { send(res, { ok: false, error: "method-not-allowed" }); return; }
			let payload = null;
			try { payload = JSON.parse((await readBody(req)) || "{}"); } catch { /* ignore */ }
			const spec = payload === null ? "" : String(payload.spec || "");
			if (!specSafe(spec)) { send(res, { ok: false, error: "unsafe or empty spec" }); return; }
			log("plugin install requested: " + spec);
			const run = await runDsh(["plugin", "--profile", "web", "add", spec], INSTALL_TIMEOUT_MS);
			log("plugin install finished spec=" + spec + " exit=" + run.code);
			send(res, { ok: run.code === 0, exitCode: run.code, ms: run.ms, spec, restartRequired: run.code === 0 });
		},
	});

	webServer.register({
		kind: "exact",
		path: "/dsh-hub/plugins",
		handler: async (req, res) => {
			const built = await pluginRows(ctx);
			send(res, { ok: true, patch: PATCH_FILE, loader: built.via, rows: built.rows });
		},
	});

	webServer.register({
		kind: "exact",
		path: "/dsh-hub/plugins/toggle",
		handler: async (req, res) => {
			if (req.method !== "POST") { send(res, { ok: false, error: "method-not-allowed" }); return; }
			let payload = null;
			try { payload = JSON.parse((await readBody(req)) || "{}"); } catch { /* ignore */ }
			const id = payload === null ? "" : String(payload.id || "");
			const disabled = payload !== null && payload.disabled === true;
			if (id.length === 0) { send(res, { ok: false, error: "body needs { id, disabled }" }); return; }
			if (id.indexOf("@deepseek-ai/") === 0) { send(res, { ok: false, error: "base plugin is not closable" }); return; }
			const result = applyPluginPatch(id, disabled);
			if (result.ok === true) log("plugin toggle id=" + id + " disabled=" + disabled + " changed=" + (result.changed === true));
			send(res, Object.assign({ id, disabled, restartRequired: result.changed === true }, result));
		},
	});

	log("routes registered: /dsh-hub/market /dsh-hub/market/install /dsh-hub/plugins /dsh-hub/plugins/toggle");
}

export { applyPluginPatch, fetchMarket, loaderSnapshot, mergeMarket, normalizeCategories, parseMarket, patchState, pluginRows, profilePluginIds, specSafe };
