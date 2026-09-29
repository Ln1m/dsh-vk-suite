// dsh-vk-settings-hub — host 半：插件市场与启停管理的后端。
//   GET  /dsh-hub/market          → 拉取插件市场清单（外网，失败要给明确回显）
//   POST /dsh-hub/market/install  → body { spec }：dsh plugin add <spec>（--profile web）
//   GET  /dsh-hub/plugins         → profile 已装插件 + cordis.patch.yml 里的启停状态
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
const MARKET_URL = "https://awesome-dsh-plugin.com/plugins.json";
/* 清单实测 5.0MB / 4382 条（2026-09-29）：12s 那版只够握手，正文要几十秒，必然 abort。
   放大到 90s，并把拿到的清单落盘，之后秒开 + 后台刷新。 */
const MARKET_TIMEOUT_MS = 180000;
const MARKET_CACHE = join(ROOT, "tmp", "dsh-market-cache.json");
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

/** 幂等键：只允许包名/路径/URL 形态，杜绝把 shell 元字符带进命令行。 */
const SPEC_RE = /^(file:|git\+|https?:\/\/|@?[A-Za-z0-9._@/-]+(\.tgz)?$)/;
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
		for (const key of ["plugins", "items", "data", "list", "entries"]) {
			if (Array.isArray(data[key])) return data[key];
		}
		for (const key of Object.keys(data)) if (Array.isArray(data[key])) return data[key];
	}
	return null;
}

function readMarketCache() {
	try {
		const c = JSON.parse(readFileSync(MARKET_CACHE, "utf8"));
		if (Array.isArray(c?.plugins) && typeof c.fetchedAt === "string") return c;
	} catch { /* 还没缓存 / 缓存坏了 */ }
	return null;
}

function writeMarketCache(plugins) {
	try {
		writeFileSync(MARKET_CACHE, JSON.stringify({ fetchedAt: new Date().toISOString(), plugins }), "utf8");
	} catch (e) {
		log("market cache write failed: " + String((e && e.message) || e));
	}
}

/** 同一时刻只拉一份（并发调用共享同一个 promise）。 */
let marketInFlight = null;
function fetchMarket() {
	if (marketInFlight !== null) return marketInFlight;
	marketInFlight = (async () => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), MARKET_TIMEOUT_MS);
		try {
			const r = await fetch(MARKET_URL, { signal: controller.signal, headers: { accept: "application/json" } });
			if (!r.ok) throw new Error("market http " + r.status);
			const list = parseMarket(JSON.parse(await r.text()));
			if (list === null) throw new Error("market payload carries no array of plugins");
			writeMarketCache(list);
			return list;
		} finally {
			clearTimeout(timer);
			marketInFlight = null;
		}
	})();
	return marketInFlight;
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
			const cached = readMarketCache();
			if (cached !== null) {
				const fresh = Date.now() - Date.parse(cached.fetchedAt) < MARKET_CACHE_MAX_AGE_MS;
				if (!fresh) {
					/* 旧清单先给出去，后台悄悄刷新；拉不到就继续用旧的，别把页面卡空 */
					fetchMarket()
						.then((plugins) => log("market cache refreshed: " + plugins.length))
						.catch((e) => log("market cache refresh failed: " + String((e && e.message) || e)));
				}
				send(res, { ok: true, plugins: cached.plugins, fetchedAt: cached.fetchedAt, cached: true, refreshing: !fresh });
				return;
			}
			try {
				const plugins = await fetchMarket();
				send(res, { ok: true, plugins, fetchedAt: new Date().toISOString(), cached: false });
			} catch (e) {
				const msg = e && e.name === "AbortError"
					? "market fetch timeout after " + Math.round(MARKET_TIMEOUT_MS / 1000) + "s"
					: String((e && e.message) || e);
				log("market fetch failed: " + msg);
				send(res, { ok: false, error: msg });
			}
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
			const state = patchState();
			const ids = profilePluginIds();
			const rows = ids.map((id) => ({
				id,
				disabled: state.get(id) === true,
				base: id.indexOf("@deepseek-ai/") === 0,
				patched: state.has(id),
			}));
			send(res, { ok: true, patch: PATCH_FILE, plugins: rows });
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

export { applyPluginPatch, parseMarket, patchState, profilePluginIds, specSafe };
