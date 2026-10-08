import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const name = 'dsh-vk-layout';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DSH_ROOT || join(homedir(), 'DeepSeek_harness');
const LOG = join(ROOT, 'logs', 'vk-layout-dockkit.log');
const PAYLOAD = JSON.parse(readFileSync(join(HERE, 'dockkit-payload.json'), 'utf8'));
const SHELL_PKG = '@deepseek-ai/dsh-web-frontend';
const SIDEBAR_PKG = '@deepseek-ai/dsh-client-ui-sidebar-right';

function log(line) {
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, new Date().toISOString() + '  ' + line + '\n');
  } catch { /* 日志不可写不影响补丁 */ }
}

function packageDir(pkg) {
  const segs = pkg.split('/');
  let dir = HERE;
  for (;;) {
    const cand = join(dir, 'node_modules', ...segs);
    if (existsSync(join(cand, 'package.json'))) return cand;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  const fallback = join(ROOT, 'node_modules', ...segs);
  return existsSync(join(fallback, 'package.json')) ? fallback : null;
}

function count(text, needle) { return text.split(needle).length - 1; }

function braceEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') { depth -= 1; if (depth === 0) return i; }
  }
  throw new Error('unbalanced braces');
}

function put(text, old, next, label) {
  const n = count(text, old);
  if (n !== 1) throw new Error('anchor [' + label + '] expected 1 got ' + n);
  const at = text.indexOf(old);
  return text.slice(0, at) + next + text.slice(at + old.length);
}

function shellTarget() {
  const dir = packageDir(SHELL_PKG);
  if (dir === null) return null;
  const dist = join(dir, 'dist');
  const m = /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(readFileSync(join(dist, 'index.html'), 'utf8'));
  return m === null ? null : join(dist, 'assets', m[1]);
}

function sidebarTarget() {
  const dir = packageDir(SIDEBAR_PKG);
  return dir === null ? null : join(dir, 'lib', 'client.js');
}

function shellDone(text) {
  return text.includes(PAYLOAD.tsParamsNew) && text.includes(PAYLOAD.capNew)
    && text.includes('dkCell?dkCell.col') && !text.includes(PAYLOAD.nsGuard);
}

function sidebarDone(text) {
  return !text.includes('dropZones: "horizontal",') && text.includes('axis: "column"')
    && !text.includes('id !== layout.rootId');
}

function patchShell(text) {
  if (count(text, PAYLOAD.nsAnchor) !== 1) throw new Error('shell: DockLayout anchor not found');
  const at = text.indexOf(PAYLOAD.nsAnchor);
  const end = braceEnd(text, at);
  if (!text.slice(at, end + 1).includes(PAYLOAD.nsGuard)) throw new Error('shell: DockLayout body changed');
  let out = text.slice(0, at) + PAYLOAD.newNs + text.slice(end + 1);
  out = out.replace(PAYLOAD.tsParamsOld, () => PAYLOAD.tsParamsNew);
  out = out.replace(PAYLOAD.tsStyleOld, () => PAYLOAD.tsStyleNew);
  out = out.replace(PAYLOAD.capOld, () => PAYLOAD.capNew);
  out = out.replace(PAYLOAD.maxOld, () => PAYLOAD.maxNew);
  if (!shellDone(out)) throw new Error('shell: post-check failed');
  return out;
}

function patchSidebar(text) {
  let out = text;
  for (const rule of PAYLOAD.rules) out = put(out, rule.a, rule.b, rule.n);
  const lines = out.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) if (lines[i].trim() === PAYLOAD.pnAnchor) hits.push(i);
  if (hits.length !== 1) throw new Error('sidebar: preferNewPane line not unique (' + hits.length + ')');
  const line = lines[hits[0]];
  lines[hits[0]] = line.slice(0, line.length - line.trimStart().length) + PAYLOAD.pnNew;
  out = lines.join('\n');
  if (!sidebarDone(out)) throw new Error('sidebar: post-check failed');
  return out;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

export function patchDockkit(opts) {
  const shellFile = opts.shellFile;
  const sidebarFile = opts.sidebarFile;
  if (shellFile === null || sidebarFile === null || !existsSync(shellFile) || !existsSync(sidebarFile)) {
    return { status: 'missing' };
  }
  const shellBefore = readFileSync(shellFile, 'utf8');
  const sidebarBefore = readFileSync(sidebarFile, 'utf8');
  const needShell = !shellDone(shellBefore);
  const needSidebar = !sidebarDone(sidebarBefore);
  if (!needShell && !needSidebar) return { status: 'already' };
  const shellAfter = needShell ? patchShell(shellBefore) : shellBefore;
  const sidebarAfter = needSidebar ? patchSidebar(sidebarBefore) : sidebarBefore;
  const backup = opts.backupRoot;
  mkdirSync(backup, { recursive: true });
  if (needShell) copyFileSync(shellFile, join(backup, 'shell-index.js'));
  if (needSidebar) copyFileSync(sidebarFile, join(backup, 'sidebar-right.client.js'));
  if (needShell) writeFileSync(shellFile, shellAfter);
  if (needSidebar) writeFileSync(sidebarFile, sidebarAfter);
  return { status: 'patched', shell: needShell, sidebar: needSidebar, backup };
}

export function apply() {
  let report;
  try {
    report = patchDockkit({
      shellFile: shellTarget(),
      sidebarFile: sidebarTarget(),
      backupRoot: join(ROOT, 'backups', 'dsh-dockkit-2axis-' + stamp()),
    });
  } catch (e) {
    report = { status: 'error', detail: String((e && e.message) || e) };
  }
  if (report.status !== 'already') log('dockkit-2axis ' + JSON.stringify(report));
}
