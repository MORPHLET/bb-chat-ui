import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.BB_THREAD_ID;
const PROJECT = process.env.BB_PROJECT_ID;
const HOST = process.env.BB_USAGE_HOST_ID;
const DIR = process.env.BB_THREAD_STORAGE ? path.join(process.env.BB_THREAD_STORAGE, 'quota-monitor') : null;
const STATE = DIR ? path.join(DIR, 'state.json') : null;

// Extract the largest valid weekly usage for the requested host.
export function parseUsage(data, now, host) {
  if (typeof host !== 'string' || !host) return null;
  const machine = data?.machines?.find(m => m.id === host);
  if (!machine || machine.status === 'disconnected' || !Array.isArray(machine.providers)) return null;
  const providers = machine.providers.filter(p => p.providerId === 'codex');
  if (!providers.length || providers.some(p => p.usage?.status !== 'ok' || !Array.isArray(p.usage.windows))) return null;
  const perProvider = providers.map(p => p.usage.windows.filter(w => w.label === 'Weekly limit'));
  if (perProvider.some(windows => !windows.length)) return null;
  const windows = perProvider.flat();
  if (!windows.length || windows.some(w => !Number.isFinite(w.usedPercent) || w.usedPercent < 0 || w.usedPercent > 100 || !Number.isFinite(Date.parse(w.resetsAt)) || Date.parse(w.resetsAt) <= now)) return null;
  const selected = windows.reduce((a, b) => b.usedPercent > a.usedPercent ? b : a);
  return { percent: selected.usedPercent, resetsAt: selected.resetsAt };
}

// Find Codex descendants while traversing every provider and hidden thread.
export function descendants(rows, root) {
  if (!Array.isArray(rows)) throw new Error('Invalid thread list');
  if (!rows.some(row => row.id === root)) throw new Error('Root is absent from the selected project');
  const seen = new Set([root]); const queue = [root]; const result = [];
  while (queue.length) {
    const parent = queue.shift();
    for (const row of rows) {
      if (row.parentThreadId !== parent || typeof row.id !== 'string' || seen.has(row.id)) continue;
      seen.add(row.id); queue.push(row.id);
      if (row.providerId === 'codex') result.push(row.id);
    }
  }
  return result;
}

// Poll once, persist the safety decision and carry out scoped stops and notices.
export async function cycle(state, io, root = ROOT) {
  const start = io.now(); let value = null;
  try { const data = await io.readUsage(); if (io.now() - start <= 30000) value = parseUsage(data, io.now(), io.host); } catch { /* A failed lookup is unknown. */ }
  state.heartbeatAt = new Date(io.now()).toISOString();
  state.status = value ? 'ok' : 'unknown';
  state.percent = value?.percent ?? null; state.resetsAt = value?.resetsAt ?? null;
  state.failures = value ? 0 : (state.failures || 0) + 1;
  if (value) state.unknownNotified = false;
  if (value && value.percent >= 80) state.latched = true;
  state.allowNewWork = Boolean(value && !state.latched);
  state.stops ||= {};
  await io.save(state);
  if (state.latched) {
    let thresholdNotice;
    if (state.thresholdNotification !== 'sent') {
      state.thresholdNotified = true; state.thresholdNotification = 'attempted'; await io.save(state);
      // Begin the parent notice independently of slow descendant stop commands.
      thresholdNotice = io.notify('threshold', structuredClone(state)).then(() => 'sent', () => 'failed');
    }
    try {
      const rows = await io.list();
      const ids = descendants(rows, root);
      state.listStatus = 'ok';
      const pending = ids.filter(id => state.stops[id] !== 'stopped' || rows.find(row => row.id === id)?.status === 'active');
      // Start independent stop requests together and persist their results only after they settle.
      const results = await Promise.all(pending.map(async id => {
        try { await io.stop(id); return [id, 'stopped']; } catch { return [id, 'failed']; }
      }));
      for (const [id, result] of results) state.stops[id] = result;
    } catch { state.listStatus = 'failed'; }
    await io.save(state);
    if (thresholdNotice) {
      state.thresholdNotification = await thresholdNotice;
      await io.save(state);
    }
  } else if (!value && state.failures >= 3 && (!state.unknownNotified || state.unknownNotification === 'failed')) {
    state.unknownNotified = true; state.unknownNotification = 'attempted'; await io.save(state);
    try { await io.notify('unknown', state); state.unknownNotification = 'sent'; } catch { state.unknownNotification = 'failed'; }
    await io.save(state);
  }
  return value && value.percent < 75 && !state.latched ? 60000 : 12000;
}

// Atomically replace a JSON state file within its directory.
async function writeJson(file, data) {
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await fs.rename(temporary, file);
}

// Execute the verified BB entry through Node without a shell or console window.
async function bb(args) {
  const entry = process.env.BB_CLI;
  if (!entry || !path.isAbsolute(entry)) throw new Error('BB_CLI must be an absolute Node entry');
  const stat = await fs.stat(entry);
  if (!stat.isFile()) throw new Error('Invalid BB_CLI entry');
  const prefix = (await fs.readFile(entry)).subarray(0, 256).toString('utf8');
  if (!prefix.startsWith('#!/usr/bin/env node')) throw new Error('BB_CLI is not the Node entry');
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'ignore'] });
    let output = ''; let exceeded = false;
    const timer = setTimeout(() => { child.kill(); }, 30000);
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 8_000_000) { exceeded = true; child.kill(); } });
    child.on('error', () => { clearTimeout(timer); reject(new Error('BB command failed')); });
    child.on('close', code => { clearTimeout(timer); if (code !== 0 || exceeded) return reject(new Error('BB command failed')); try { resolve(JSON.parse(output)); } catch { reject(new Error('Invalid BB JSON')); } });
  });
}

// Create the runtime adapter for the fixed project and parent thread.
async function adapter() {
  if (![ROOT, PROJECT, HOST, DIR].every(value => typeof value === 'string' && value.length > 0)) throw new Error('BB scope environment is required');
  await fs.mkdir(DIR, { recursive: true });
  const input = path.join(DIR, 'usage-input.json');
  await writeJson(input, { force: true, machineIds: [HOST], providerId: 'codex', maxAgeMs: 0 });
  return {
    host: HOST,
    now: Date.now,
    save: s => writeJson(STATE, s),
    readUsage: () => bb(['plugin', 'rpc', 'call', 'bb-usage', 'getUsage', '--input-file', input, '--json']),
    list: () => bb(['thread', 'list', '--project', PROJECT, '--include-hidden', '--json']),
    stop: id => bb(['thread', 'stop', id, '--json']),
    // Send only the safety decision and stop results to the parent.
    notify: async (kind, state) => {
      const message = kind === 'threshold'
        ? `Codex 주간 사용률이 80% 이상입니다. 감시기가 하위 Codex 중단을 진행 중입니다. 중단 결과는 상태 파일에서 확인하세요: ${STATE}. 새 실험과 하위 작업을 중단하고 최종 보고와 PR만 진행하세요.`
        : `Codex 주간 사용률을 연속 3회 확인하지 못했습니다. 80% 도달로 판정한 것은 아닙니다. 새 실험을 중단하고 사용률 확인을 복구하세요. 상태: ${STATE}.`;
      const file = path.join(DIR, 'notice.txt'); await fs.writeFile(file, message, 'utf8');
      await bb(['thread', 'tell', ROOT, '--message-file', file, '--mode', 'steer', '--json']);
    },
  };
}

// Run a read-only preview or the persistent watcher.
async function main() {
  const mode = process.argv[2] || '--watch';
  if (!['--once', '--dry-run', '--watch'].includes(mode)) throw new Error('Use --once, --dry-run or --watch');
  const io = await adapter();
  if (mode !== '--watch') {
    const start = Date.now(); const result = parseUsage(await io.readUsage(), Date.now(), io.host);
    if (!result || Date.now() - start > 30000) throw new Error('Usage unknown');
    const output = { ...result, checkedAt: new Date().toISOString() };
    if (mode === '--dry-run') output.stopPreview = descendants(await io.list(), ROOT);
    process.stdout.write(JSON.stringify(output) + '\n'); return;
  }
  const lock = path.join(DIR, 'watcher.lock');
  const handle = await fs.open(lock, 'wx');
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); await handle.close();
    let state;
    try { state = JSON.parse(await fs.readFile(STATE, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; state = {}; }
    state.pid = process.pid; state.startedAt = new Date().toISOString(); state.allowNewWork = false; await io.save(state);
    while (true) { const delay = await cycle(state, io); await new Promise(resolve => setTimeout(resolve, delay)); }
  } finally { await handle.close().catch(() => {}); await fs.unlink(lock).catch(() => {}); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { process.stderr.write('Quota monitor failed; usage is unknown.\n'); process.exitCode = 1; });
}
