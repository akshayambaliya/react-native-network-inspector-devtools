#!/usr/bin/env node

import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

if (process.argv.includes('--mcp') || process.env.NETWORK_INSPECTOR_MCP === '1') {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('./network-inspector-mcp.mjs', import.meta.url))],
    { env: process.env, stdio: 'inherit' }
  );
  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (error) => {
    process.stderr.write(`Failed to start network inspector MCP server: ${error.message}\n`);
    process.exit(1);
  });
  await new Promise(() => {});
}

const port = Number(process.env.NETWORK_INSPECTOR_PORT ?? 8765);
const host = process.env.NETWORK_INSPECTOR_HOST ?? '0.0.0.0';
const maxEntries = Number(process.env.NETWORK_INSPECTOR_MAX_ENTRIES ?? 1000);
const maxDevices = Number(process.env.NETWORK_INSPECTOR_MAX_DEVICES ?? 20);
const emptyDeviceTtlMs = Number(process.env.NETWORK_INSPECTOR_EMPTY_DEVICE_TTL_MS ?? 10_000);

const devices = new Map();
const deviceAliases = new Map();

const json = (res, status, body) => {
  res.writeHead(status, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(body));
};

const readBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
};

const normalizeDeviceId = (value) => {
  const text = String(value ?? '').trim();
  return text || 'default';
};

const normalizeDeviceName = (value) => String(value ?? '').trim();

const deviceNameKey = (value) => normalizeDeviceName(value).toLowerCase();

const resolveDeviceId = (deviceId) => {
  const targetDeviceId = deviceAliases.get(deviceId);
  if (!targetDeviceId) return deviceId;
  if (devices.has(targetDeviceId)) return targetDeviceId;
  deviceAliases.delete(deviceId);
  return deviceId;
};

const cleanupDeviceAliases = () => {
  for (const [fromDeviceId, toDeviceId] of deviceAliases) {
    if (fromDeviceId === toDeviceId || !devices.has(toDeviceId)) {
      deviceAliases.delete(fromDeviceId);
    }
  }
};

const findSameNamedDevice = (deviceId, deviceName) => {
  const key = deviceNameKey(deviceName);
  if (!key) return undefined;
  return [...devices.values()]
    .filter((device) => device.id !== deviceId && deviceNameKey(device.name) === key)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
};

const reassignDeviceId = (device, deviceId) => {
  if (device.id === deviceId) return device;
  const previousDeviceId = device.id;
  devices.delete(previousDeviceId);
  device.id = deviceId;
  devices.set(deviceId, device);
  deviceAliases.set(previousDeviceId, deviceId);
  for (const [fromDeviceId, toDeviceId] of deviceAliases) {
    if (toDeviceId === previousDeviceId) {
      deviceAliases.set(fromDeviceId, deviceId);
    }
  }
  return device;
};

const fallbackDeviceName = (deviceId) => {
  if (deviceId === 'default') return 'Default device';
  return `Device ${deviceId.slice(-6).toUpperCase()}`;
};

const getDevice = (url) => {
  const requestedDeviceId = normalizeDeviceId(url.searchParams.get('deviceId'));
  const deviceId = resolveDeviceId(requestedDeviceId);
  const deviceName = normalizeDeviceName(url.searchParams.get('deviceName'));
  let device = devices.get(deviceId);
  if (!device) {
    const sameNamedDevice = findSameNamedDevice(requestedDeviceId, deviceName);
    if (sameNamedDevice) {
      device = reassignDeviceId(sameNamedDevice, requestedDeviceId);
    } else {
      device = {
        id: requestedDeviceId,
        name: fallbackDeviceName(requestedDeviceId),
        entries: new Map(),
        clients: new Set(),
        mocks: [],
        isFabVisible: true,
        nextActionId: 1,
        actions: [],
        updatedAt: Date.now(),
      };
      devices.set(requestedDeviceId, device);
    }
  }

  if (deviceName) {
    device.name = deviceName;
    device.updatedAt = Date.now();
  }
  pruneDevices();
  return device;
};

const pruneDevices = () => {
  const now = Date.now();
  for (const device of devices.values()) {
    if (
      device.entries.size === 0 &&
      device.mocks.length === 0 &&
      device.actions.length === 0 &&
      now - device.updatedAt > emptyDeviceTtlMs
    ) {
      devices.delete(device.id);
    }
  }
  cleanupDeviceAliases();

  if (devices.size <= maxDevices) return;
  const staleDevices = [...devices.values()]
    .filter((device) => device.clients.size === 0)
    .sort((a, b) => a.updatedAt - b.updatedAt);

  while (devices.size > maxDevices && staleDevices.length) {
    devices.delete(staleDevices.shift().id);
  }
  cleanupDeviceAliases();
};

const listDevices = () => {
  pruneDevices();
  return [...devices.values()]
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  .map((device) => ({
    id: device.id,
    name: device.name,
    updatedAt: device.updatedAt,
    entryCount: device.entries.size,
    mockCount: device.mocks.length,
  }));
};

const allEntries = (device) => [...device.entries.values()].sort((a, b) => b.startTime - a.startTime);

const queueAction = (device, action) => {
  if (!action || typeof action.type !== 'string') {
    throw new Error('Action must include a type');
  }

  device.actions.push({
    id: device.nextActionId++,
    type: action.type,
    payload: action.payload,
    createdAt: Date.now(),
  });

  while (device.actions.length > 500) device.actions.shift();
};

const broadcast = (device) => {
  const payload = `data: ${JSON.stringify(allEntries(device))}\n\n`;
  for (const client of device.clients) {
    client.write(payload);
  }
};

const upsertEntry = (device, entry) => {
  if (!entry || typeof entry.id !== 'string') {
    throw new Error('Log entry must include a string id');
  }

  device.entries.set(entry.id, {
    ...(device.entries.get(entry.id) ?? {}),
    ...entry,
    deviceId: device.id,
    deviceName: device.name,
    receivedAt: Date.now(),
  });

  while (device.entries.size > maxEntries) {
    device.entries.delete(device.entries.keys().next().value);
  }
};

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Network Inspector Logs</title>
<style>
:root {
  color-scheme: dark;
  --bg: #0F172A;
  --panel: #1E293B;
  --panel-2: #334155;
  --border: #475569;
  --muted: #94A3B8;
  --text: #F8FAFC;
  --blue: #3B82F6;
  --green: #22C55E;
  --yellow: #F59E0B;
  --red: #EF4444;
  --purple: #7C3AED;
  --shadow: 0 18px 55px rgba(0, 0, 0, .28);
  background: var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: var(--bg); }
button, input, select { font: inherit; }
button { cursor: pointer; }
.shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; }
.topbar { position: sticky; top: 0; z-index: 5; padding: 18px 22px 0; background: rgba(15, 23, 42, .94); border-bottom: 1px solid var(--border); backdrop-filter: blur(18px); }
.title-row { margin-bottom: 16px; }
h1 { margin: 0; font-size: 20px; line-height: 1.1; letter-spacing: -.02em; }
.controls { display: grid; grid-template-columns: minmax(160px, 240px) minmax(220px, 1fr) repeat(3, auto); gap: 10px; align-items: center; }
.field, .select, .button { border: 1px solid var(--border); border-radius: 10px; background: var(--panel); color: var(--text); min-height: 40px; }
.field { width: 100%; padding: 0 13px; outline: none; }
.search-wrap { position: relative; min-width: 0; }
.search-wrap .field { padding-right: 44px; }
.clear-search { position: absolute; top: 50%; right: 8px; transform: translateY(-50%); width: 28px; height: 28px; min-height: 0; padding: 0; border-radius: 999px; color: var(--muted); }
.clear-search:hover { color: var(--text); border-color: var(--blue); }
.field:focus, .select:focus, .button:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(119, 183, 255, .14); }
.select { padding: 0 11px; }
.button { padding: 0 13px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
.button.primary { background: var(--blue); border-color: var(--blue); color: #fff; }
.button.danger { background: var(--red); border-color: var(--red); color: #fff; }
.button.small { min-height: 30px; padding: 0 10px; border-radius: 6px; font-size: 12px; }
.tabbar { display: flex; margin-top: 14px; border-top: 1px solid rgba(71, 85, 105, .55); }
.tab { flex: 1; min-height: 44px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); font-size: 12px; font-weight: 600; }
.tab.active { border-bottom-color: var(--blue); color: var(--blue); }
.content { padding: 18px 22px 26px; }
.list-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; color: var(--muted); font-size: 12px; }
.list-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.entries { display: grid; gap: 10px; }
.empty { border: 1px dashed var(--border); border-radius: 10px; padding: 42px 18px; text-align: center; color: var(--muted); background: rgba(30, 41, 59, .6); }
.entry, .mock-row { border: 1px solid var(--border); border-radius: 10px; background: var(--panel); box-shadow: var(--shadow); overflow: hidden; }
.summary { width: 100%; border: 0; background: transparent; color: inherit; text-align: left; padding: 14px 16px; display: grid; grid-template-columns: 18px 90px 76px minmax(0, 1fr) auto 90px 78px; gap: 12px; align-items: center; }
.chevron { color: var(--muted); transition: transform .16s ease; }
.entry.open .chevron { transform: rotate(90deg); }
.method { font-size: 12px; font-weight: 900; letter-spacing: .08em; }
.method-wrap { display: inline-flex; align-items: center; gap: 7px; min-width: 0; }
.method-get { color: #2563EB; }
.method-post { color: #7C3AED; }
.method-put { color: #EA580C; }
.method-patch { color: #D97706; }
.method-delete { color: #DC2626; }
.method-head, .method-options { color: #94A3B8; }
.pill { justify-self: start; border-radius: 4px; padding: 4px 8px; min-width: 48px; text-align: center; background: var(--panel-2); color: #fff; font-size: 12px; font-weight: 800; }
.pill.ok { background: var(--green); }
.pill.warn { background: var(--yellow); }
.pill.error { background: var(--red); }
.url { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; }
.time, .duration { color: var(--muted); font-size: 12px; white-space: nowrap; text-align: right; }
.duration { color: #bdd2ee; }
.badges { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 16px 12px 104px; }
.badge { border: 1px solid #3c4e6a; border-radius: 999px; padding: 3px 8px; color: var(--muted); font-size: 11px; }
.badge.mocked { border-color: #806723; color: var(--yellow); }
.mock-dot { width: 20px; height: 20px; border: 1px solid var(--yellow); border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; color: var(--yellow); font-size: 11px; font-weight: 900; letter-spacing: 0; }
.details { display: none; border-top: 1px solid var(--border); background: rgba(5, 12, 23, .34); padding: 14px 16px 16px; }
.entry.open .details { display: block; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.section { min-width: 0; }
.section.full { grid-column: 1 / -1; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
.section-title { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .09em; font-weight: 800; }
.copy { border: 1px solid #2d405d; border-radius: 9px; background: #0b1525; color: #b7c9e3; padding: 5px 8px; font-size: 11px; }
pre { margin: 0; min-height: 45px; max-height: 380px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid #1d2c42; border-radius: 13px; background: #061020; color: #d6e6fb; padding: 12px; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.toast { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); opacity: 0; pointer-events: none; transition: opacity .16s ease, bottom .16s ease; background: #d6e6fb; color: #07111f; border-radius: 999px; padding: 9px 13px; font-size: 12px; font-weight: 800; box-shadow: var(--shadow); }
.toast.show { opacity: 1; bottom: 28px; }
.hidden { display: none !important; }
.mocks { display: grid; gap: 8px; }
.controller-card { border: 1px solid var(--border); border-radius: 10px; background: var(--panel); box-shadow: var(--shadow); padding: 12px; display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
.controller-title { margin-bottom: 3px; font-size: 13px; font-weight: 800; }
.controller-text { color: var(--muted); font-size: 12px; line-height: 18px; }
.mock-toolbar { display: flex; justify-content: flex-end; margin-bottom: 14px; }
.mock-section-title { margin: 20px 0 8px; color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
.mock-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 12px; }
.mock-row.pinned { border-color: var(--blue); }
.mock-info { min-width: 0; display: grid; gap: 7px; }
.mock-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mock-url { color: var(--text); font-size: 13px; line-height: 20px; word-break: break-all; }
.method-badge, .status-badge, .preset-badge, .disabled-badge { border-radius: 4px; padding: 3px 7px; color: #fff; font-size: 10px; font-weight: 800; }
.method-badge { background: var(--blue); }
.status-badge.ok { background: var(--green); }
.status-badge.warn { background: var(--yellow); }
.status-badge.error { background: var(--red); }
.preset-badge { background: var(--purple); }
.disabled-badge { border: 1px solid var(--border); color: var(--muted); background: transparent; }
.variant-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.variant-chip { border: 1px solid var(--border); border-radius: 20px; background: transparent; color: var(--muted); padding: 5px 10px; font-size: 11px; font-weight: 700; }
.variant-chip.active { border-color: var(--blue); background: var(--blue); color: #fff; }
.mock-actions { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.switch { position: relative; width: 46px; height: 28px; border: 0; border-radius: 999px; background: #767577; transition: background .16s ease; }
.switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 999px; background: #fff; transition: transform .16s ease; }
.switch.on { background: var(--blue); }
.switch.on::after { transform: translateX(18px); }
.modal-backdrop { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(2, 6, 23, .78); backdrop-filter: blur(8px); }
.modal { width: min(760px, 100%); max-height: min(860px, calc(100vh - 40px)); overflow: auto; border: 1px solid var(--border); border-radius: 14px; background: var(--panel); box-shadow: var(--shadow); }
.modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
.modal-title { font-size: 16px; font-weight: 900; }
.modal-body { display: grid; gap: 13px; padding: 18px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
.form-field { display: grid; gap: 6px; }
.form-field.full { grid-column: 1 / -1; }
.form-field label { color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.textarea { min-height: 170px; resize: vertical; padding: 12px; line-height: 1.45; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.form-error { min-height: 18px; color: var(--red); font-size: 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 0 18px 18px; }
@media (max-width: 980px) {
  .controls { grid-template-columns: 1fr 1fr; }
  .summary { grid-template-columns: 18px 82px 68px minmax(0, 1fr) auto; }
  .time, .duration { grid-column: 4; text-align: left; }
  .badges { padding-left: 16px; }
  .detail-grid { grid-template-columns: 1fr; }
  .mock-row { grid-template-columns: 1fr; }
  .mock-actions { justify-content: flex-start; }
  .form-grid { grid-template-columns: 1fr; }
}
@media (max-width: 620px) {
  .topbar, .content { padding-left: 14px; padding-right: 14px; }
  .controls { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div class="title-row">
      <h1>Network Inspector</h1>
    </div>

    <div class="controls">
      <div class="search-wrap">
        <input id="search" class="field" placeholder="Search URL, method, status" autocomplete="off" />
        <button id="clear-search" class="button clear-search" type="button" aria-label="Clear search">×</button>
      </div>
      <select id="device" class="select" aria-label="Device">
        <option value="">Waiting for devices</option>
      </select>
      <select id="method" class="select" aria-label="Method filter">
        <option value="">All methods</option>
      </select>
      <select id="state" class="select" aria-label="State filter">
        <option value="">All states</option>
        <option value="pending">Pending</option>
        <option value="done">Done</option>
        <option value="error">Error</option>
      </select>
      <button id="toggle-controller" class="button primary" type="button">Hide controller</button>
    </div>
    <nav class="tabbar" aria-label="Dashboard tabs">
      <button id="logs-tab" class="tab active" type="button">Logs</button>
      <button id="mocks-tab" class="tab" type="button">Mocks</button>
    </nav>
  </header>

  <main class="content">
    <section id="logs-panel">
      <div class="list-tools">
      <div id="range">Waiting for app traffic</div>
      <div class="list-actions">
        <button id="expand-all" class="button" type="button">Expand all</button>
        <button id="collapse-all" class="button" type="button">Collapse all</button>
        <button id="download" class="button primary" type="button">Download JSON</button>
        <button id="clear" class="button danger" type="button">Clear</button>
      </div>
      </div>
      <section id="entries" class="entries"><div class="empty">Waiting for app traffic...</div></section>
    </section>
    <section id="mocks-panel" class="hidden">
      <div class="list-tools">
        <div id="mock-range">Waiting for app mock state</div>
      </div>
      <div class="mock-toolbar">
        <button id="add-mock" class="button primary" type="button">Add mock</button>
      </div>
      <section id="mocks" class="mocks"><div class="empty">Waiting for app mock state...</div></section>
    </section>
  </main>
</div>
<div id="mock-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="mock-modal-title">
  <form id="mock-form" class="modal">
    <div class="modal-head">
      <div id="mock-modal-title" class="modal-title">Add mock</div>
      <button id="mock-cancel-x" class="button small" type="button">Close</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-field">
          <label for="mock-method">Method</label>
          <select id="mock-method" class="select">
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>
        </div>
        <div class="form-field">
          <label for="mock-status">Status</label>
          <input id="mock-status" class="field" inputmode="numeric" value="200" />
          <div id="mock-status-error" class="form-error"></div>
        </div>
        <div class="form-field full">
          <label for="mock-url">URL pattern</label>
          <input id="mock-url" class="field" placeholder="/api/v1/customer or full URL" />
          <div id="mock-url-error" class="form-error"></div>
        </div>
        <div class="form-field">
          <label for="mock-match">Match type</label>
          <select id="mock-match" class="select">
            <option value="contains">Contains</option>
            <option value="exact">Exact</option>
            <option value="regex">Regex</option>
          </select>
        </div>
        <div class="form-field">
          <label for="mock-delay">Delay seconds</label>
          <input id="mock-delay" class="field" inputmode="decimal" placeholder="Optional" />
          <div id="mock-delay-error" class="form-error"></div>
        </div>
        <div class="form-field full">
          <label for="mock-body">Response body</label>
          <textarea id="mock-body" class="field textarea" placeholder='{"ok": true}'></textarea>
          <div id="mock-body-error" class="form-error"></div>
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button id="mock-cancel" class="button" type="button">Cancel</button>
      <button class="button primary" type="submit">Save mock</button>
    </div>
  </form>
</div>
<div id="toast" class="toast">Copied</div>

<script>
let logs = [];
let mocks = [];
let devices = [];
let selectedDeviceId = localStorage.getItem('network-inspector-device-id') || '';
let isFabVisible = true;
let activePanel = 'logs';
let editingMockId = null;
const expanded = new Set();

const els = {
  entries: document.querySelector('#entries'),
  search: document.querySelector('#search'),
  clearSearch: document.querySelector('#clear-search'),
  device: document.querySelector('#device'),
  method: document.querySelector('#method'),
  state: document.querySelector('#state'),
  range: document.querySelector('#range'),
  mockRange: document.querySelector('#mock-range'),
  toast: document.querySelector('#toast'),
  mocks: document.querySelector('#mocks'),
  logsPanel: document.querySelector('#logs-panel'),
  mocksPanel: document.querySelector('#mocks-panel'),
  logsTab: document.querySelector('#logs-tab'),
  mocksTab: document.querySelector('#mocks-tab'),
  toggleController: document.querySelector('#toggle-controller'),
  addMock: document.querySelector('#add-mock'),
  mockModal: document.querySelector('#mock-modal'),
  mockForm: document.querySelector('#mock-form'),
  mockModalTitle: document.querySelector('#mock-modal-title'),
  mockMethod: document.querySelector('#mock-method'),
  mockStatus: document.querySelector('#mock-status'),
  mockUrl: document.querySelector('#mock-url'),
  mockMatch: document.querySelector('#mock-match'),
  mockDelay: document.querySelector('#mock-delay'),
  mockBody: document.querySelector('#mock-body'),
  mockStatusError: document.querySelector('#mock-status-error'),
  mockUrlError: document.querySelector('#mock-url-error'),
  mockDelayError: document.querySelector('#mock-delay-error'),
  mockBodyError: document.querySelector('#mock-body-error'),
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const formatBody = (value) => {
  if (value == null || value === '') return '';
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return String(value); }
};
const asJson = (value) => JSON.stringify(value ?? {}, null, 2);
const statusClass = (log) => {
  if (log.state === 'error' || Number(log.status) >= 400) return 'error';
  if (Number(log.status) >= 300) return 'warn';
  if (log.state === 'done') return 'ok';
  return '';
};
const durationText = (log) => log.duration == null ? '-' : log.duration + 'ms';
const requestTime = (log) => log.startTime ? new Date(log.startTime).toLocaleTimeString() : '-';
const methodClass = (method) => 'method-' + String(method || '').toLowerCase();
const searchableText = (log) => [
  log.url,
  log.method,
  log.status,
  log.state,
].filter((value) => value != null).join(' ').toLowerCase();
const visibleLogs = () => {
  const q = els.search.value.trim().toLowerCase();
  return logs.filter((log) => {
    if (els.method.value && log.method !== els.method.value) return false;
    if (els.state.value && log.state !== els.state.value) return false;
    return !q || searchableText(log).includes(q);
  });
};
const updateMethodOptions = () => {
  const current = els.method.value;
  const methods = [...new Set(logs.map((log) => log.method).filter(Boolean))].sort();
  els.method.innerHTML = '<option value="">All methods</option>' + methods.map((method) => '<option value="' + escapeHtml(method) + '">' + escapeHtml(method) + '</option>').join('');
  if (methods.includes(current)) els.method.value = current;
};
const showToast = (message) => {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 1200);
};
const renderRange = (shown) => {
  els.range.textContent = shown.length ? 'Showing ' + shown.length + ' of ' + logs.length + ' requests' : (logs.length ? 'No requests match filters' : 'Waiting for app traffic');
};
const statusBadgeClass = (status) => Number(status) >= 400 ? 'error' : Number(status) >= 300 ? 'warn' : 'ok';
const prettyBody = (value) => {
  if (value == null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
};
const responseBodyForMock = (log) => {
  const body = prettyBody(log.responseBody);
  return body.trim() ? body : '{}';
};
const mockPrefillFromLog = (log) => ({
  method: log.method || 'GET',
  status: Number(log.status) || 200,
  urlPattern: log.url || '',
  matchType: 'exact',
  responseBody: responseBodyForMock(log),
});
const dispatchAction = async (type, payload) => {
  await fetch(withDevice('/actions'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, payload }),
  });
};
const deviceQuery = () => selectedDeviceId ? 'deviceId=' + encodeURIComponent(selectedDeviceId) : '';
const withDevice = (path) => {
  const query = deviceQuery();
  if (!query) return path;
  return path + (path.includes('?') ? '&' : '?') + query;
};
const setDevices = (nextDevices) => {
  devices = Array.isArray(nextDevices) ? nextDevices : [];
  if (!devices.length) {
    selectedDeviceId = '';
    els.device.innerHTML = '<option value="">Waiting for devices</option>';
    setLogs([]);
    setAppState({ mocks: [], isFabVisible: true });
    return;
  }
  if (!selectedDeviceId || !devices.some((device) => device.id === selectedDeviceId)) {
    selectedDeviceId = devices[0].id;
    localStorage.setItem('network-inspector-device-id', selectedDeviceId);
    connectEvents();
    refreshDeviceData();
  }
  els.device.innerHTML = devices.map((device) => {
    const details = [device.entryCount + ' logs', device.mockCount + ' mocks'].join(', ');
    return '<option value="' + escapeHtml(device.id) + '">' + escapeHtml(device.name) + ' (' + escapeHtml(details) + ')</option>';
  }).join('');
  els.device.value = selectedDeviceId;
};
const sortedMocks = (source) => {
  const filtered = mocks.filter((mock) => source === 'preset' ? mock.source === 'preset' : mock.source !== 'preset');
  return filtered.filter((mock) => mock.pinned).concat(filtered.filter((mock) => !mock.pinned));
};
const renderMockRow = (mock) => {
  const variants = Array.isArray(mock.variants) && mock.variants.length > 1
    ? '<div class="variant-chips">' + mock.variants.map((variant) => '<button class="variant-chip ' + (variant.id === mock.activeVariantId ? 'active' : '') + '" type="button" data-action="variant" data-mock-id="' + escapeHtml(mock.id) + '" data-variant-id="' + escapeHtml(variant.id) + '">' + escapeHtml(variant.name) + '</button>').join('') + '</div>'
    : '';
  return '<article class="mock-row ' + (mock.pinned ? 'pinned' : '') + '">'
    + '<div class="mock-info">'
    + '<div class="mock-badges">'
    + '<span class="method-badge">' + escapeHtml(mock.method || '-') + '</span>'
    + '<span class="status-badge ' + statusBadgeClass(mock.status) + '">' + escapeHtml(mock.status || '-') + '</span>'
    + (mock.source === 'preset' ? '<span class="preset-badge">PRESET</span>' : '')
    + (!mock.enabled ? '<span class="disabled-badge">DISABLED</span>' : '')
    + '</div>'
    + '<div class="mock-url">' + escapeHtml(mock.urlPattern || '-') + '</div>'
    + variants
    + '</div>'
    + '<div class="mock-actions">'
    + '<button class="button small" type="button" data-action="edit" data-mock-id="' + escapeHtml(mock.id) + '">Edit</button>'
    + '<button class="button small" type="button" data-action="pin" data-mock-id="' + escapeHtml(mock.id) + '">' + (mock.pinned ? 'Unpin' : 'Pin') + '</button>'
    + '<button class="switch ' + (mock.enabled ? 'on' : '') + '" type="button" aria-label="Toggle mock" data-action="toggle" data-mock-id="' + escapeHtml(mock.id) + '"></button>'
    + (mock.source === 'preset' ? '' : '<button class="button danger small" type="button" data-action="remove" data-mock-id="' + escapeHtml(mock.id) + '">Delete</button>')
    + '</div></article>';
};
const renderMocks = () => {
  const userMocks = sortedMocks('user');
  const presetMocks = sortedMocks('preset');
  const activeCount = mocks.filter((mock) => mock.enabled).length;
  els.toggleController.textContent = isFabVisible ? 'Hide controller' : 'Show controller';
  els.toggleController.classList.toggle('danger', isFabVisible);
  els.toggleController.classList.toggle('primary', !isFabVisible);
  els.mockRange.textContent = mocks.length ? mocks.length + ' mocks, ' + activeCount + ' active' : 'Waiting for app mock state';
  if (!mocks.length) {
    els.mocks.innerHTML = '<div class="empty">Waiting for app mock state...</div>';
    return;
  }
  els.mocks.innerHTML = '<div class="mock-section-title">My Mocks (' + userMocks.length + ')</div>'
    + (userMocks.length ? userMocks.map(renderMockRow).join('') : '<div class="empty">No user mocks yet</div>')
    + '<div class="mock-section-title">Presets (' + presetMocks.length + ')</div>'
    + (presetMocks.length ? presetMocks.map(renderMockRow).join('') : '<div class="empty">No presets loaded</div>');
};
const renderTabs = () => {
  const showLogs = activePanel === 'logs';
  els.logsPanel.classList.toggle('hidden', !showLogs);
  els.mocksPanel.classList.toggle('hidden', showLogs);
  els.logsTab.classList.toggle('active', showLogs);
  els.mocksTab.classList.toggle('active', !showLogs);
};
const renderEntry = (log) => {
  const open = expanded.has(log.id);
  const status = log.status ?? log.state;
  const metadata = {
    id: log.id,
    deviceId: log.deviceId,
    deviceName: log.deviceName,
    url: log.url,
    method: log.method,
    status: log.status,
    state: log.state,
    duration: log.duration,
    isMocked: log.isMocked,
    startTime: log.startTime ? new Date(log.startTime).toISOString() : undefined,
    endTime: log.endTime ? new Date(log.endTime).toISOString() : undefined,
    receivedAt: log.receivedAt ? new Date(log.receivedAt).toISOString() : undefined,
  };

  return '<article class="entry ' + (open ? 'open' : '') + '" data-id="' + escapeHtml(log.id) + '">'
    + '<div class="summary" role="button" tabindex="0" aria-expanded="' + (open ? 'true' : 'false') + '">'
    + '<span class="chevron">›</span>'
    + '<span class="method-wrap"><span class="method ' + escapeHtml(methodClass(log.method)) + '">' + escapeHtml(log.method) + '</span>' + (log.isMocked ? '<span class="mock-dot" title="Mocked response">M</span>' : '') + '</span>'
    + '<span class="pill ' + statusClass(log) + '">' + escapeHtml(status) + '</span>'
    + '<span class="url" title="' + escapeHtml(log.url) + '">' + escapeHtml(log.url) + '</span>'
    + '<button class="button primary small" type="button" data-action="mock-log" data-log-id="' + escapeHtml(log.id) + '">Mock</button>'
    + '<span class="duration">' + escapeHtml(durationText(log)) + '</span>'
    + '<span class="time">' + escapeHtml(requestTime(log)) + '</span>'
    + '</div>'
    + '<div class="details">'
    + '<div class="detail-grid">'
    + sectionHtml('Request headers', asJson(log.requestHeaders), asJson(log.requestHeaders))
    + sectionHtml('Response headers', asJson(log.responseHeaders), asJson(log.responseHeaders))
    + sectionHtml('Request body', formatBody(log.requestBody), formatBody(log.requestBody))
    + sectionHtml('Response body', formatBody(log.responseBody), formatBody(log.responseBody))
    + sectionHtml('Metadata', asJson(metadata), asJson(metadata), true)
    + '</div></div></article>';
};
const sectionHtml = (title, displayValue, copyValue, full) => '<div class="section ' + (full ? 'full' : '') + '">'
  + '<div class="section-head"><span class="section-title">' + escapeHtml(title) + '</span><button class="copy" type="button" data-copy="' + escapeHtml(copyValue) + '">Copy</button></div>'
  + '<pre>' + escapeHtml(displayValue) + '</pre></div>';
const render = () => {
  updateMethodOptions();
  const shown = visibleLogs();
  renderRange(shown);
  if (!shown.length) {
    els.entries.innerHTML = '<div class="empty">' + (logs.length ? 'No requests match the current filters' : 'Waiting for app traffic...') + '</div>';
  } else {
    els.entries.innerHTML = shown.map(renderEntry).join('');
  }
  renderMocks();
  renderTabs();
};
const setLogs = (nextLogs) => {
  logs = Array.isArray(nextLogs) ? nextLogs : [];
  const ids = new Set(logs.map((log) => log.id));
  for (const id of expanded) {
    if (!ids.has(id)) expanded.delete(id);
  }
  render();
};
const setMocks = (nextMocks) => {
  mocks = Array.isArray(nextMocks) ? nextMocks : [];
  renderMocks();
};
const setAppState = (data) => {
  setMocks(data?.mocks);
  if (typeof data?.isFabVisible === 'boolean') isFabVisible = data.isFabVisible;
  renderMocks();
};
const setFormErrors = (errors = {}) => {
  els.mockUrlError.textContent = errors.url ?? '';
  els.mockStatusError.textContent = errors.status ?? '';
  els.mockDelayError.textContent = errors.delay ?? '';
  els.mockBodyError.textContent = errors.body ?? '';
};
const openMockModal = (mock) => {
  editingMockId = mock?.id ?? null;
  els.mockModalTitle.textContent = editingMockId ? 'Edit mock' : 'Add mock';
  els.mockMethod.value = mock?.method || 'GET';
  els.mockStatus.value = String(mock?.status ?? 200);
  els.mockUrl.value = mock?.urlPattern ?? '';
  els.mockMatch.value = mock?.matchType ?? 'contains';
  els.mockDelay.value = mock?.delay && mock.delay > 0 ? String(mock.delay / 1000) : '';
  els.mockBody.value = prettyBody(mock?.responseBody ?? '');
  setFormErrors();
  els.mockModal.classList.remove('hidden');
  els.mockUrl.focus();
};
const closeMockModal = () => {
  editingMockId = null;
  els.mockModal.classList.add('hidden');
  setFormErrors();
};
const validateMockForm = () => {
  const errors = {};
  const url = els.mockUrl.value.trim();
  const status = Number.parseInt(els.mockStatus.value.trim(), 10);
  const delayText = els.mockDelay.value.trim();
  const body = els.mockBody.value.trim();
  if (!url) errors.url = 'URL pattern is required.';
  if (els.mockMatch.value === 'regex') {
    try { new RegExp(url); } catch { errors.url = 'Invalid regular expression.'; }
  }
  if (!els.mockStatus.value.trim()) errors.status = 'Status code is required.';
  else if (!Number.isFinite(status) || status < 100 || status > 599) errors.status = 'Status code must be between 100 and 599.';
  if (delayText) {
    const delay = Number.parseFloat(delayText);
    if (!Number.isFinite(delay) || delay < 0) errors.delay = 'Delay must be a positive number.';
    else if (delay > 60) errors.delay = 'Maximum delay is 60 seconds.';
  }
  if (!body) errors.body = 'Response body is required.';
  setFormErrors(errors);
  return Object.keys(errors).length ? null : { url, status, delayText, body };
};
const saveMockForm = async () => {
  const values = validateMockForm();
  if (!values) return;
  const delaySeconds = values.delayText ? Number.parseFloat(values.delayText) : 0;
  const delayMs = delaySeconds > 0 ? Math.round(delaySeconds * 1000) : undefined;
  const patch = {
    urlPattern: values.url,
    matchType: els.mockMatch.value,
    method: els.mockMethod.value,
    status: values.status,
    responseBody: values.body,
    delay: delayMs,
  };
  if (editingMockId) {
    await dispatchAction('UPDATE_MOCK', { id: editingMockId, patch });
  } else {
    await dispatchAction('ADD_MOCK', {
      id: 'mock-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      ...patch,
      enabled: true,
    });
  }
  closeMockModal();
  showToast('Sent to app');
};

els.entries.addEventListener('click', async (event) => {
  const copyButton = event.target.closest('.copy');
  if (copyButton) {
    event.stopPropagation();
    await navigator.clipboard.writeText(copyButton.dataset.copy ?? '');
    showToast('Copied');
    return;
  }
  const actionButton = event.target.closest('[data-action="mock-log"]');
  if (actionButton) {
    event.stopPropagation();
    const log = logs.find((item) => item.id === actionButton.dataset.logId);
    if (log) {
      activePanel = 'mocks';
      renderTabs();
      openMockModal(mockPrefillFromLog(log));
    }
    return;
  }
  const summary = event.target.closest('.summary');
  if (!summary) return;
  const id = summary.closest('.entry').dataset.id;
  if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
  render();
});
els.entries.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const summary = event.target.closest('.summary');
  if (!summary) return;
  event.preventDefault();
  const id = summary.closest('.entry').dataset.id;
  if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
  render();
});
els.search.addEventListener('input', render);
els.clearSearch.addEventListener('click', () => { els.search.value = ''; render(); els.search.focus(); });
els.device.addEventListener('change', () => {
  selectedDeviceId = els.device.value;
  localStorage.setItem('network-inspector-device-id', selectedDeviceId);
  expanded.clear();
  connectEvents();
  refreshDeviceData();
});
els.method.addEventListener('change', render);
els.state.addEventListener('change', render);
els.logsTab.addEventListener('click', () => { activePanel = 'logs'; renderTabs(); });
els.mocksTab.addEventListener('click', () => { activePanel = 'mocks'; renderTabs(); });
els.addMock.addEventListener('click', () => openMockModal());
els.toggleController.addEventListener('click', async () => {
  await dispatchAction('SET_FAB_VISIBLE', !isFabVisible);
  showToast('Sent to app');
});
els.mocks.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const mockId = target.dataset.mockId;
  if (!mockId) return;
  if (target.dataset.action === 'edit') {
    const mock = mocks.find((item) => item.id === mockId);
    if (mock) openMockModal(mock);
    return;
  }
  if (target.dataset.action === 'toggle') await dispatchAction('TOGGLE_MOCK', mockId);
  if (target.dataset.action === 'pin') await dispatchAction('TOGGLE_MOCK_PIN', mockId);
  if (target.dataset.action === 'remove') await dispatchAction('REMOVE_MOCK', mockId);
  if (target.dataset.action === 'variant') await dispatchAction('SET_MOCK_VARIANT', { mockId, variantId: target.dataset.variantId });
  showToast('Sent to app');
});
document.querySelector('#mock-cancel').addEventListener('click', closeMockModal);
document.querySelector('#mock-cancel-x').addEventListener('click', closeMockModal);
els.mockModal.addEventListener('click', (event) => { if (event.target === els.mockModal) closeMockModal(); });
els.mockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await saveMockForm();
});
document.querySelector('#expand-all').addEventListener('click', () => { visibleLogs().forEach((log) => expanded.add(log.id)); render(); });
document.querySelector('#collapse-all').addEventListener('click', () => { expanded.clear(); render(); });
document.querySelector('#clear').addEventListener('click', async () => {
  await fetch(withDevice('/logs'), { method: 'DELETE' });
  await dispatchAction('CLEAR_ENTRIES');
  expanded.clear();
});
document.querySelector('#download').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(visibleLogs(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'network-inspector-logs.json';
  link.click();
  URL.revokeObjectURL(url);
});

let source;
const connectEvents = () => {
  if (source) source.close();
  if (!selectedDeviceId) return;
  source = new EventSource(withDevice('/events'));
  source.onmessage = (event) => setLogs(JSON.parse(event.data));
};
const refreshDevices = () => fetch('/devices').then((res) => res.json()).then((data) => setDevices(data.devices)).catch(() => {});
const refreshDeviceData = () => {
  if (!selectedDeviceId) return;
  fetch(withDevice('/logs')).then((res) => res.json()).then((data) => setLogs(data.entries)).catch(() => {});
  fetch(withDevice('/mocks')).then((res) => res.json()).then(setAppState).catch(() => {});
};
refreshDevices().then(refreshDeviceData);
setInterval(() => {
  refreshDevices();
  if (selectedDeviceId) {
    fetch(withDevice('/mocks')).then((res) => res.json()).then(setAppState).catch(() => {});
  }
}, 1000);
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/logs') {
    const device = getDevice(url);
    json(res, 200, { entries: allEntries(device) });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/devices') {
    json(res, 200, { devices: listDevices() });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/mocks') {
    const device = getDevice(url);
    json(res, 200, { mocks: device.mocks, isFabVisible: device.isFabVisible });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/mocks') {
    try {
      const device = getDevice(url);
      const payload = JSON.parse(await readBody(req));
      device.mocks = Array.isArray(payload?.mocks) ? payload.mocks : [];
      if (typeof payload?.isFabVisible === 'boolean') device.isFabVisible = payload.isFabVisible;
      json(res, 202, { ok: true });
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : 'Invalid payload' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/actions') {
    const device = getDevice(url);
    const since = Number(url.searchParams.get('since') ?? 0);
    json(res, 200, { actions: device.actions.filter((action) => action.id > since) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/actions') {
    try {
      queueAction(getDevice(url), JSON.parse(await readBody(req)));
      json(res, 202, { ok: true });
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : 'Invalid payload' });
    }
    return;
  }

  if (req.method === 'DELETE' && url.pathname === '/logs') {
    const device = getDevice(url);
    device.entries.clear();
    broadcast(device);
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    const device = getDevice(url);
    res.writeHead(200, {
      'access-control-allow-origin': '*',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'content-type': 'text/event-stream',
    });
    device.clients.add(res);
    res.write(`data: ${JSON.stringify(allEntries(device))}\n\n`);
    req.on('close', () => device.clients.delete(res));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/logs') {
    try {
      const device = getDevice(url);
      upsertEntry(device, JSON.parse(await readBody(req)));
      broadcast(device);
      json(res, 202, { ok: true });
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : 'Invalid payload' });
    }
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(port, host, () => {
  console.log(`Network inspector dashboard: http://localhost:${port}`);
  console.log(`Collector endpoint: http://localhost:${port}/logs`);
});
