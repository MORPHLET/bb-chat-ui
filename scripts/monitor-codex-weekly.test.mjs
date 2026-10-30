import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUsage as parseHostUsage, descendants, cycle } from './monitor-codex-weekly.mjs';

// Parse usage against the explicit test host instead of a machine-specific scope.
function parseUsage(data, at) { return parseHostUsage(data, at, 'test-host'); }
// Build a minimal usage response for the selected host.
function usage(percent, reset = '2026-11-04T08:48:05Z') {
  return { machines: [{ id: 'test-host', providers: [{ providerId: 'codex', usage: { status: 'ok', windows: [{ label: 'Weekly limit', usedPercent: percent, resetsAt: reset }] } }] }] };
}
const now = Date.parse('2026-10-29T08:39:11Z');

test('usage accepts valid values, selects the highest window and rejects stale or invalid responses', () => {
  for (const n of [25, 79.9, 80, 81]) assert.equal(parseUsage(usage(n), now).percent, n);
  const data = usage(25); data.machines[0].providers[0].usage.windows.push({ label: 'Weekly limit', usedPercent: 80, resetsAt: '2026-11-04T08:48:05Z' });
  assert.equal(parseUsage(data, now).percent, 80);
  assert.equal(parseUsage(usage(25, '2026-10-28T00:00:00Z'), now), null);
  assert.equal(parseUsage({ machines: [] }, now), null);
  data.machines[0].providers[0].usage.status = 'error'; assert.equal(parseUsage(data, now), null);
  data.machines[0].providers[0].usage = { status: 'ok', windows: [] }; assert.equal(parseUsage(data, now), null);
  const partial = usage(25);
  partial.machines[0].providers.push({ providerId: 'codex', usage: { status: 'ok', windows: [] } });
  assert.equal(parseUsage(partial, now), null);
  assert.equal(parseHostUsage(usage(25), now, undefined), null);
  assert.equal(parseHostUsage(usage(25), now, 'another-host'), null);
});

test('collects only Codex descendants including hidden and grandchildren through other providers', () => {
  const rows = [
    { id: 'root', providerId: 'codex' }, { id: 'a', parentThreadId: 'root', providerId: 'other' },
    { id: 'b', parentThreadId: 'a', providerId: 'codex', visibility: 'hidden' },
    { id: 'c', parentThreadId: 'root', providerId: 'codex' }, { id: 'd', providerId: 'codex' },
  ];
  assert.deepEqual(descendants(rows, 'root').sort(), ['b', 'c']);
});

test('latches at 80, retries failed stops and does not duplicate threshold notification after restart', async () => {
  let state = {}; const stops = []; const notices = []; let fail = true;
  const io = { host: 'test-host', now: () => now, save: async s => { state = structuredClone(s); }, readUsage: async () => usage(80),
    list: async () => [{ id: 'root', providerId: 'codex' }, { id: 'a', parentThreadId: 'root', providerId: 'codex' }],
    stop: async id => { stops.push(id); if (fail) throw Error(); }, notify: async kind => { notices.push(kind); } };
  await cycle(state, io, 'root'); assert.equal(state.latched, true); assert.deepEqual(notices, ['threshold']);
  fail = false; await cycle(state, io, 'root'); assert.deepEqual(stops, ['a', 'a']); assert.deepEqual(notices, ['threshold']);
  assert.equal(state.stops.a, 'stopped'); assert.equal(state.allowNewWork, false);
});

test('unknown failures block new work, notify after consecutive failures and recover without asserting threshold', async () => {
  let state = {}; let bad = true; const notices = [];
  const io = { host: 'test-host', now: () => now, save: async s => { state = structuredClone(s); }, readUsage: async () => { if (bad) throw Error(); return usage(25); },
    list: async () => [], stop: async () => assert.fail('must not stop'), notify: async kind => notices.push(kind) };
  for (let i = 0; i < 3; i++) await cycle(state, io, 'root');
  assert.equal(state.status, 'unknown'); assert.equal(state.allowNewWork, false); assert.deepEqual(notices, ['unknown']); assert.notEqual(state.latched, true);
  bad = false; await cycle(state, io, 'root'); assert.equal(state.allowNewWork, true); assert.equal(state.status, 'ok');
});

test('79.9 percent permits work and uses the faster interval without stopping', async () => {
  let state = {};
  const io = { host: 'test-host', now: () => now, save: async s => { state = structuredClone(s); }, readUsage: async () => usage(79.9),
    list: async () => assert.fail('must not list'), stop: async () => assert.fail('must not stop'), notify: async () => assert.fail('must not notify') };
  assert.equal(await cycle(state, io, 'root'), 12000); assert.equal(state.allowNewWork, true); assert.notEqual(state.latched, true);
});

test('list and notice failures remain visible and are retried', async () => {
  let state = {}; let fail = true; let notifications = 0;
  const io = { host: 'test-host', now: () => now, save: async s => { state = structuredClone(s); }, readUsage: async () => usage(81),
    list: async () => { if (fail) throw Error(); return [{ id: 'root', providerId: 'codex' }]; }, stop: async () => assert.fail('must not stop'),
    notify: async () => { notifications++; if (fail) throw Error(); } };
  await cycle(state, io, 'root'); assert.equal(state.listStatus, 'failed'); assert.equal(state.thresholdNotification, 'failed');
  fail = false; await cycle(state, io, 'root'); assert.equal(state.listStatus, 'ok'); assert.equal(state.thresholdNotification, 'sent'); assert.equal(notifications, 2);
});

// Verify the threshold notice starts before any potentially slow stop operation.
test('starts the parent notice before listing or stopping descendants', async () => {
  const events = []; let releaseNotice;
  const noticePending = new Promise(resolve => { releaseNotice = resolve; });
  const io = { host: 'test-host', now: () => now, save: async () => {}, readUsage: async () => usage(80),
    notify: async () => { events.push('notice'); await noticePending; },
    list: async () => { events.push('list'); return [{ id: 'root', providerId: 'codex' }, { id: 'a', parentThreadId: 'root', providerId: 'codex' }]; },
    stop: async () => { events.push('stop'); releaseNotice(); } };
  await cycle({}, io, 'root');
  assert.deepEqual(events, ['notice', 'list', 'stop']);
});

// Retry a notification interrupted after its attempted state was persisted.
test('retries attempted threshold notices after restart', async () => {
  const state = { latched: true, thresholdNotified: true, thresholdNotification: 'attempted' };
  let notices = 0;
  const io = { host: 'test-host', now: () => now, save: async () => {}, readUsage: async () => usage(79),
    notify: async () => { notices++; }, list: async () => [{ id: 'root', providerId: 'codex' }], stop: async () => {} };
  await cycle(state, io, 'root');
  assert.equal(notices, 1); assert.equal(state.thresholdNotification, 'sent');
});

// Reject a project list that cannot prove the requested root scope.
test('records a missing root as list failure instead of successful empty scope', async () => {
  const state = {};
  const io = { host: 'test-host', now: () => now, save: async () => {}, readUsage: async () => usage(80),
    notify: async () => {}, list: async () => [{ id: 'unrelated', providerId: 'codex' }],
    stop: async () => assert.fail('must not stop an unverified scope') };
  await cycle(state, io, 'root');
  assert.equal(state.listStatus, 'failed'); assert.equal(state.allowNewWork, false);
});

// Ensure one blocked stop cannot delay starting the other descendant stops.
test('starts every descendant stop without waiting for earlier stop completion', async () => {
  const state = {}; const events = []; let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const io = { host: 'test-host', now: () => now, save: async () => {}, readUsage: async () => usage(80),
    notify: async () => {}, list: async () => [{ id: 'root', providerId: 'codex' },
      { id: 'a', parentThreadId: 'root', providerId: 'codex' }, { id: 'b', parentThreadId: 'root', providerId: 'codex' }],
    stop: async id => { events.push(id); if (id === 'a') await blocked; else release(); } };
  const run = cycle(state, io, 'root');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, ['a', 'b']);
  await run;
  assert.deepEqual(state.stops, { a: 'stopped', b: 'stopped' });
});
