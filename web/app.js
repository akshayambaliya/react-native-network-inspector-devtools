(() => {
  'use strict';

  const state = {
    entries: [],
    consoleEntries: [],
    mocks: [],
    connected: false,
    mobileConnected: false,
  };

  const ui = {
    tab: 'logs',
    logSearch: '',
    logMethod: 'ALL',
    consoleSearch: '',
    consoleLevel: 'ALL',
    presetSearch: '',
    selectedEntryId: null,
    selectedConsoleId: null,
    selectedMockId: null,
    prefill: null, // pending values for the Add Mock form (from "Mock this" action)
    editMockId: null, // set when the form is editing an existing user mock instead of creating one
  };

  const content = document.querySelector('.content');
  const master = document.getElementById('master');
  const detail = document.getElementById('detail');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  // ---------------------------------------------------------------- socket

  let socket = null;
  function connect() {
    const url = `ws://${location.hostname}:${location.port || 8973}`;
    socket = new WebSocket(url);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'hello', role: 'web' }));
      setConnected(true);
    };
    socket.onclose = () => {
      setConnected(false);
      setTimeout(connect, 1500);
    };
    socket.onerror = () => {};
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === 'state' && message.payload) {
        Object.assign(state, {
          entries: message.payload.entries || [],
          consoleEntries: message.payload.consoleEntries || [],
          mocks: message.payload.mocks || [],
        });
        render();
      } else if (message.type === 'status') {
        state.mobileConnected = !!message.payload?.mobileConnected;
        renderStatus();
      }
    };
  }

  function setConnected(connected) {
    state.connected = connected;
    if (!connected) state.mobileConnected = false;
    renderStatus();
  }

  function renderStatus() {
    const ok = state.connected && state.mobileConnected;
    statusDot.classList.toggle('connected', ok);
    statusText.textContent = !state.connected
      ? 'Connecting…'
      : state.mobileConnected
        ? 'Synced with device'
        : 'Waiting for device…';
  }

  /**
   * Mirrors the subset of reducer logic needed so mock toggles/variant
   * switches/pins feel instant in the browser instead of waiting on the
   * round trip to the device and back. The next authoritative `state`
   * message from the device always overwrites this — it's a pure UI
   * responsiveness optimization, never a second source of truth.
   */
  function applyLocalAction(action) {
    switch (action.type) {
      case 'TOGGLE_MOCK':
        state.mocks = state.mocks.map((m) =>
          m.id === action.payload ? { ...m, enabled: !m.enabled } : m
        );
        break;
      case 'TOGGLE_MOCK_PIN':
        state.mocks = state.mocks.map((m) =>
          m.id === action.payload ? { ...m, pinned: !m.pinned } : m
        );
        break;
      case 'SET_MOCK_VARIANT': {
        const { mockId, variantId } = action.payload;
        state.mocks = state.mocks.map((m) => {
          if (m.id !== mockId) return m;
          const variant = (m.variants || []).find((v) => v.id === variantId);
          if (!variant) return m;
          return {
            ...m,
            activeVariantId: variantId,
            status: variant.status,
            responseBody: variant.responseBody,
            responseHeaders: variant.responseHeaders,
            delay: variant.delay,
          };
        });
        break;
      }
      case 'REMOVE_MOCK':
        state.mocks = state.mocks.filter((m) => m.id !== action.payload);
        break;
      case 'SET_SOURCE_MOCKS_ENABLED':
        state.mocks = state.mocks.map((m) =>
          (action.payload.source === 'preset' ? m.source === 'preset' : m.source !== 'preset')
            ? { ...m, enabled: action.payload.enabled }
            : m
        );
        break;
      case 'SET_PRESET_SECTION_ENABLED':
        state.mocks = state.mocks.map((m) =>
          m.source === 'preset' && m.sectionKey === action.payload.sectionKey
            ? { ...m, enabled: action.payload.enabled }
            : m
        );
        break;
      default:
        break;
    }
  }

  function dispatch(action) {
    applyLocalAction(action);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'action', payload: action }));
    }
    render();
  }

  // ------------------------------------------------------------- helpers

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function statusClass(status) {
    if (!status) return '';
    if (status >= 200 && status < 300) return 'status-2xx';
    if (status >= 400 && status < 500) return 'status-4xx';
    if (status >= 500) return 'status-5xx';
    return '';
  }

  function genId() {
    return `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function prettyBody(body) {
    if (!body) return '(empty)';
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }

  function headersBlock(headers) {
    if (!headers || Object.keys(headers).length === 0) return '(none)';
    return Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
  }

  // ------------------------------------------------------- json validation

  // Smart quotes / non-breaking spaces that OS keyboards silently paste in,
  // which otherwise produce confusing "Unexpected token" JSON errors.
  const SMART_CHAR_RE = /[\u201C\u201D\u201E\u201F\u00AB\u00BB\u2018\u2019\u2039\u203A\u00A0\u2028\u2029]/g;
  const SMART_CHAR_MAP = {
    '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u201F': '"', '\u00AB': '"', '\u00BB': '"',
    '\u2018': "'", '\u2019': "'", '\u2039': "'", '\u203A': "'",
    '\u00A0': ' ', '\u2028': '\n', '\u2029': '\n',
  };
  function sanitizeJsonInput(text) {
    return text.replace(SMART_CHAR_RE, (ch) => SMART_CHAR_MAP[ch] ?? ch);
  }

  function prettyPrintJson(value) {
    const str = sanitizeJsonInput(value ?? '');
    if (!str.trim()) return str;
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  }

  /** 'empty' | 'plain' | 'valid' | 'invalid' */
  function getJsonStatus(value) {
    const trimmed = sanitizeJsonInput(value ?? '').trim();
    if (!trimmed) return 'empty';
    if (trimmed[0] !== '{' && trimmed[0] !== '[' && trimmed[0] !== '"') return 'plain';
    try {
      JSON.parse(trimmed);
      return 'valid';
    } catch {
      return 'invalid';
    }
  }

  /** Short human hint about *why* JSON failed to parse, or undefined if valid/not-JSON. */
  function getJsonHint(value) {
    const trimmed = sanitizeJsonInput(value ?? '').trim();
    if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[' && trimmed[0] !== '"')) return undefined;
    try {
      JSON.parse(trimmed);
      return undefined;
    } catch (err) {
      if (/,\s*[}\]]/.test(trimmed)) return 'Trailing comma';
      if (/'[^']*'\s*:|:\s*'[^']*'/.test(trimmed)) return 'Use double quotes';
      if (/^\s*\{[^{]*(?:^|[{,])\s*[a-zA-Z_$][\w$]*\s*:/.test(trimmed)) return 'Keys must be quoted';
      return err instanceof Error ? err.message : 'Invalid JSON';
    }
  }

  function jsonBadgeHtml(value) {
    const status = getJsonStatus(value);
    const hint = status === 'invalid' ? getJsonHint(value) : undefined;
    const label = {
      empty: 'Empty',
      plain: 'Plain text',
      valid: 'Valid JSON',
      invalid: `Invalid JSON${hint ? ` — ${hint}` : ''}`,
    }[status];
    return `<span class="json-badge ${status}">${escapeHtml(label)}</span>`;
  }

  function validateUrl(value, matchType) {
    if (!value.trim()) return 'URL pattern is required.';
    if (matchType === 'regex') {
      try {
        // eslint-disable-next-line no-new
        new RegExp(value.trim());
      } catch {
        return 'Invalid regular expression.';
      }
    }
    return undefined;
  }

  function validateStatus(value) {
    if (!String(value).trim()) return 'Status code is required.';
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return 'Status code must be a whole number.';
    if (parsed < 100 || parsed > 599) return 'Status code must be between 100 and 599.';
    return undefined;
  }

  function validateDelay(value) {
    if (!String(value).trim()) return undefined; // optional
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) return 'Delay must be a positive number of milliseconds.';
    if (parsed > 60000) return 'Maximum delay is 60000 ms (60s).';
    return undefined;
  }

  function validateBody(value) {
    if (!value.trim()) return 'Response body is required.';
    return undefined;
  }

  const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

  /** Parses + validates the headers textarea. Returns { headers } or { error }. */
  function parseResponseHeadersInput(value) {
    const trimmed = sanitizeJsonInput(value ?? '').trim();
    if (!trimmed) return { headers: undefined };

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { error: 'Headers must be valid JSON, e.g. {"content-type":"application/json"}.' };
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return { error: 'Headers must be a JSON object.' };
    }

    const normalized = {};
    const seen = new Set();
    for (const [rawKey, rawValue] of Object.entries(parsed)) {
      if (!rawKey || rawKey !== rawKey.trim()) {
        return { error: 'Header names cannot be empty or have leading/trailing spaces.' };
      }
      if (!HEADER_NAME_RE.test(rawKey)) {
        return { error: `Invalid header name "${rawKey}". Use standard HTTP token characters only.` };
      }
      const lower = rawKey.toLowerCase();
      if (seen.has(lower)) return { error: `Duplicate header name (case-insensitive): ${rawKey}` };
      seen.add(lower);

      if (rawValue !== null && typeof rawValue === 'object') {
        return { error: `Header value for "${rawKey}" must be a string, number, or boolean.` };
      }
      if (rawValue == null) {
        return { error: `Header value for "${rawKey}" cannot be null.` };
      }
      normalized[rawKey] = String(rawValue);
    }
    return { headers: Object.keys(normalized).length > 0 ? normalized : undefined };
  }

  // ---------------------------------------------------------------- tabs

  function switchTab(tab) {
    ui.tab = tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    render();
  }

  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    // Clicking the Add Mock tab from the nav (as opposed to "Mock this" / "Edit")
    // always starts a fresh blank form.
    if (btn.dataset.tab === 'add-mock' && ui.tab !== 'add-mock') {
      ui.prefill = null;
      ui.editMockId = null;
    }
    switchTab(btn.dataset.tab);
  });

  function render() {
    detail.innerHTML = '<div class="empty-state">Select an item to see details</div>';
    content.classList.toggle('full-width-tab', ui.tab === 'add-mock');
    switch (ui.tab) {
      case 'logs': return renderLogs();
      case 'add-mock': return renderAddMock();
      case 'my-mocks': return renderMocks('user');
      case 'presets': return renderMocks('preset');
      case 'console': return renderConsole();
    }
  }

  // ---------------------------------------------------------------- logs

  function renderLogs() {
    const filtered = state.entries.filter((e) => {
      if (ui.logMethod !== 'ALL' && e.method !== ui.logMethod) return false;
      if (ui.logSearch && !e.url.toLowerCase().includes(ui.logSearch.toLowerCase())) return false;
      return true;
    });

    master.innerHTML = `
      <div class="toolbar">
        <input type="text" placeholder="Search URL…" value="${escapeHtml(ui.logSearch)}" id="logSearchInput" />
        <select id="logMethodSelect">
          ${['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => `<option value="${m}" ${m === ui.logMethod ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <button class="action danger" id="clearLogsBtn">Clear</button>
      </div>
      <div id="logList"></div>
    `;
    document.getElementById('logSearchInput').oninput = (e) => { ui.logSearch = e.target.value; renderLogs(); };
    document.getElementById('logMethodSelect').onchange = (e) => { ui.logMethod = e.target.value; renderLogs(); };
    document.getElementById('clearLogsBtn').onclick = () => dispatch({ type: 'CLEAR_ENTRIES' });

    const list = document.getElementById('logList');
    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state">No requests yet</div>';
    } else {
      list.innerHTML = filtered.map((e) => `
        <div class="list-item ${e.id === ui.selectedEntryId ? 'selected' : ''}" data-id="${e.id}">
          <div class="row">
            <span class="method-badge ${e.method}">${e.method}</span>
            <span class="status-code ${statusClass(e.status)}">${e.status ?? (e.state === 'pending' ? '…' : '—')}</span>
            ${e.isMocked ? '<span class="badge-mocked">MOCK</span>' : ''}
          </div>
          <div class="url-text">${escapeHtml(e.url)}</div>
          <div class="meta-text">${e.duration != null ? `${e.duration} ms` : ''}</div>
        </div>
      `).join('');
      list.querySelectorAll('.list-item').forEach((el) => {
        el.onclick = () => { ui.selectedEntryId = el.dataset.id; renderLogs(); renderLogDetail(el.dataset.id); };
      });
    }

    if (ui.selectedEntryId && filtered.some((e) => e.id === ui.selectedEntryId)) {
      renderLogDetail(ui.selectedEntryId);
    }
  }

  function renderLogDetail(id) {
    const entry = state.entries.find((e) => e.id === id);
    if (!entry) return;
    detail.innerHTML = `
      <div class="row" style="justify-content: space-between;">
        <div class="row">
          <span class="method-badge ${entry.method}">${entry.method}</span>
          <span class="status-code ${statusClass(entry.status)}">${entry.status ?? '—'}</span>
        </div>
        <button class="action ghost" id="mockThisBtn">Mock this</button>
      </div>
      <div class="section-title">URL</div>
      <pre class="code-block">${escapeHtml(entry.url)}</pre>
      <div class="section-title">Request Headers</div>
      <pre class="code-block">${escapeHtml(headersBlock(entry.requestHeaders))}</pre>
      <div class="section-title">Request Body</div>
      <pre class="code-block">${escapeHtml(prettyBody(entry.requestBody))}</pre>
      <div class="section-title">Response Headers</div>
      <pre class="code-block">${escapeHtml(headersBlock(entry.responseHeaders))}</pre>
      <div class="section-title">Response Body</div>
      <pre class="code-block">${escapeHtml(prettyBody(entry.responseBody))}</pre>
      <div class="section-title">Timing</div>
      <pre class="code-block">Duration: ${entry.duration ?? '—'} ms</pre>
    `;
    document.getElementById('mockThisBtn').onclick = () => {
      ui.editMockId = null;
      ui.prefill = {
        urlPattern: entry.url,
        method: entry.method,
        status: entry.status || 200,
        responseBody: entry.responseBody || '',
        responseHeaders: entry.responseHeaders,
      };
      switchTab('add-mock');
    };
  }

  // ------------------------------------------------------------ add mock

  function renderAddMock() {
    const editing = ui.editMockId ? state.mocks.find((m) => m.id === ui.editMockId) : null;
    // Falls back to prefill (from "Mock this") or a blank form.
    const p = editing || ui.prefill || {};
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const matchTypes = [
      { value: 'contains', hint: 'URL contains this substring' },
      { value: 'exact', hint: 'URL must match exactly' },
      { value: 'regex', hint: 'Pattern is a JavaScript RegExp' },
    ];
    const selectedMethod = p.method || 'GET';
    const selectedMatchType = p.matchType || 'contains';

    master.innerHTML = `
      <div class="mock-form">
        <div class="mock-form-header">
          <div>
            <div class="mock-form-title">${editing ? 'Edit Mock Rule' : 'New Mock Rule'}</div>
          </div>
          ${editing ? '<button class="action ghost" id="cancelEditBtn">New mock</button>' : ''}
        </div>
        <div class="mock-form-subtitle">
          ${editing ? `Editing a user mock. Changes save to this exact rule.` : 'Define a URL pattern and the response it should return — same rule your device will use to intercept matching requests.'}
        </div>

        <div class="field">
          <label>Method</label>
          <div class="chip-row" id="mockMethodChips">
            ${methods.map((m) => `<button type="button" class="chip-btn ${m === selectedMethod ? 'active' : ''}" data-method="${m}">${m}</button>`).join('')}
          </div>
        </div>

        <div class="field">
          <label>Match type</label>
          <div class="chip-row" id="mockMatchTypeChips">
            ${matchTypes.map((t) => `<button type="button" class="chip-btn ${t.value === selectedMatchType ? 'active' : ''}" data-match-type="${t.value}" title="${t.hint}">${t.value}</button>`).join('')}
          </div>
        </div>

        <div class="field">
          <label>URL pattern</label>
          <input type="text" id="mockUrl" value="${escapeHtml(p.urlPattern || '')}" placeholder="/api/v1/user" />
          <span class="field-error" id="mockUrlError"></span>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Status code</label>
            <input type="text" inputmode="numeric" id="mockStatus" value="${p.status || 200}" />
            <span class="field-error" id="mockStatusError"></span>
          </div>
          <div class="field">
            <label>Delay (ms, optional)</label>
            <input type="text" inputmode="numeric" id="mockDelay" value="${p.delay || 0}" />
            <span class="field-error" id="mockDelayError"></span>
          </div>
        </div>

        <div class="field">
          <div class="json-toolbar">
            <label style="margin: 0;">Response body</label>
            <div class="row" style="gap: 8px;">
              <span class="json-char-count" id="mockBodyCount"></span>
              <span id="mockBodyBadge"></span>
              <button type="button" class="action ghost" id="formatBodyBtn" style="padding: 2px 10px;">Format JSON</button>
            </div>
          </div>
          <textarea id="mockBody" class="json-editor" spellcheck="false" placeholder='{&#10;  "id": 1,&#10;  "name": "QA User"&#10;}'>${escapeHtml(p.responseBody || '')}</textarea>
          <span class="field-error" id="mockBodyError"></span>
        </div>

        <div class="field">
          <div class="json-toolbar">
            <label style="margin: 0;">Response headers (optional JSON object)</label>
            <div class="row" style="gap: 8px;">
              <span id="mockHeadersBadge"></span>
              <button type="button" class="action ghost" id="formatHeadersBtn" style="padding: 2px 10px;">Format JSON</button>
            </div>
          </div>
          <textarea id="mockHeaders" spellcheck="false" placeholder='{&#10;  "content-type": "application/json"&#10;}'>${p.responseHeaders ? escapeHtml(JSON.stringify(p.responseHeaders, null, 2)) : ''}</textarea>
          <span class="field-error" id="mockHeadersError"></span>
        </div>

        <div class="form-actions">
          <button class="action" id="createMockBtn">${editing ? 'Save changes' : 'Add mock'}</button>
          ${editing ? '<button class="action danger" id="deleteFromFormBtn">Delete mock</button>' : ''}
          <span class="field-error" id="mockFormError"></span>
        </div>
      </div>
    `;

    let method = selectedMethod;
    let matchType = selectedMatchType;

    const urlInput = document.getElementById('mockUrl');
    const statusInput = document.getElementById('mockStatus');
    const delayInput = document.getElementById('mockDelay');
    const bodyInput = document.getElementById('mockBody');
    const headersInput = document.getElementById('mockHeaders');

    function refreshUrlValidity() {
      const err = validateUrl(urlInput.value, matchType);
      document.getElementById('mockUrlError').textContent = err || '';
      urlInput.classList.toggle('has-error', !!err);
      return !err;
    }
    function refreshStatusValidity() {
      const err = validateStatus(statusInput.value);
      document.getElementById('mockStatusError').textContent = err || '';
      statusInput.classList.toggle('has-error', !!err);
      return !err;
    }
    function refreshDelayValidity() {
      const err = validateDelay(delayInput.value);
      document.getElementById('mockDelayError').textContent = err || '';
      delayInput.classList.toggle('has-error', !!err);
      return !err;
    }
    function refreshBodyValidity() {
      document.getElementById('mockBodyBadge').innerHTML = jsonBadgeHtml(bodyInput.value);
      document.getElementById('mockBodyCount').textContent = `${bodyInput.value.length} chars`;
      const err = validateBody(bodyInput.value);
      document.getElementById('mockBodyError').textContent = err || '';
      bodyInput.classList.toggle('has-error', !!err);
      return !err;
    }
    function refreshHeadersValidity() {
      document.getElementById('mockHeadersBadge').innerHTML = headersInput.value.trim()
        ? jsonBadgeHtml(headersInput.value)
        : '';
      const { error } = parseResponseHeadersInput(headersInput.value);
      document.getElementById('mockHeadersError').textContent = error || '';
      headersInput.classList.toggle('has-error', !!error);
      return !error;
    }

    urlInput.oninput = refreshUrlValidity;
    statusInput.oninput = refreshStatusValidity;
    delayInput.oninput = refreshDelayValidity;
    bodyInput.oninput = refreshBodyValidity;
    headersInput.oninput = refreshHeadersValidity;

    refreshUrlValidity();
    refreshStatusValidity();
    refreshDelayValidity();
    refreshBodyValidity();
    refreshHeadersValidity();

    document.getElementById('mockMethodChips').querySelectorAll('.chip-btn').forEach((btn) => {
      btn.onclick = () => {
        method = btn.dataset.method;
        document.querySelectorAll('#mockMethodChips .chip-btn').forEach((b) => b.classList.toggle('active', b === btn));
      };
    });
    document.getElementById('mockMatchTypeChips').querySelectorAll('.chip-btn').forEach((btn) => {
      btn.onclick = () => {
        matchType = btn.dataset.matchType;
        document.querySelectorAll('#mockMatchTypeChips .chip-btn').forEach((b) => b.classList.toggle('active', b === btn));
        refreshUrlValidity();
      };
    });

    document.getElementById('formatBodyBtn').onclick = () => {
      bodyInput.value = prettyPrintJson(bodyInput.value);
      refreshBodyValidity();
    };
    document.getElementById('formatHeadersBtn').onclick = () => {
      headersInput.value = prettyPrintJson(headersInput.value);
      refreshHeadersValidity();
    };

    if (editing) {
      document.getElementById('cancelEditBtn').onclick = () => {
        ui.editMockId = null;
        ui.prefill = null;
        render();
      };
      document.getElementById('deleteFromFormBtn').onclick = () => {
        dispatch({ type: 'REMOVE_MOCK', payload: editing.id });
        ui.editMockId = null;
        ui.selectedMockId = null;
        switchTab('my-mocks');
      };
    }

    document.getElementById('createMockBtn').onclick = () => {
      const errorEl = document.getElementById('mockFormError');
      const validUrl = refreshUrlValidity();
      const validStatus = refreshStatusValidity();
      const validDelay = refreshDelayValidity();
      const validBody = refreshBodyValidity();
      const validHeaders = refreshHeadersValidity();

      if (!validUrl || !validStatus || !validDelay || !validBody || !validHeaders) {
        errorEl.textContent = 'Fix the highlighted fields before saving.';
        return;
      }
      errorEl.textContent = '';

      const urlPattern = sanitizeJsonInput(urlInput.value).trim();
      const status = Number(statusInput.value);
      const delay = Number(delayInput.value) || 0;
      const responseBody = sanitizeJsonInput(bodyInput.value);
      const { headers: responseHeaders } = parseResponseHeadersInput(headersInput.value);

      if (editing) {
        dispatch({
          type: 'UPDATE_MOCK',
          payload: {
            id: editing.id,
            patch: { urlPattern, method, matchType, status, responseBody, responseHeaders, delay },
          },
        });
      } else {
        dispatch({
          type: 'ADD_MOCK',
          payload: {
            id: genId(),
            urlPattern,
            method,
            matchType,
            status,
            responseBody,
            responseHeaders,
            delay,
            enabled: true,
          },
        });
      }

      ui.prefill = null;
      ui.editMockId = null;
      switchTab('my-mocks');
    };
  }

  // ------------------------------------------------------------- mocks

  function renderMocks(source) {
    const mocks = state.mocks.filter((m) => (source === 'preset' ? m.source === 'preset' : m.source !== 'preset'));

    const toolbarExtra = source === 'preset'
      ? `<label class="row" style="gap:6px; font-size:12px;">
          <label class="switch"><input type="checkbox" id="allPresetsToggle" ${mocks.length > 0 && mocks.every((m) => m.enabled) ? 'checked' : ''} /><span class="slider"></span></label>
          All Presets
        </label>`
      : '';

    master.innerHTML = `
      <div class="toolbar">
        <input type="text" placeholder="Search…" value="${escapeHtml(ui.presetSearch)}" id="mockSearchInput" />
        ${toolbarExtra}
      </div>
      <div id="mockList"></div>
    `;
    document.getElementById('mockSearchInput').oninput = (e) => { ui.presetSearch = e.target.value; renderMocks(source); };
    if (source === 'preset') {
      document.getElementById('allPresetsToggle').onchange = (e) =>
        dispatch({ type: 'SET_SOURCE_MOCKS_ENABLED', payload: { source: 'preset', enabled: e.target.checked } });
    }

    const q = ui.presetSearch.toLowerCase();
    const filtered = mocks.filter((m) => !q || m.urlPattern.toLowerCase().includes(q) || m.method.toLowerCase().includes(q));

    const list = document.getElementById('mockList');
    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-state">No ${source === 'preset' ? 'presets' : 'mocks'} yet</div>`;
      return;
    }

    if (source === 'preset') {
      const sections = new Map();
      for (const m of filtered) {
        const key = m.sectionKey || '__ungrouped__';
        if (!sections.has(key)) sections.set(key, { key, title: m.sectionTitle || 'Presets', mocks: [] });
        sections.get(key).mocks.push(m);
      }
      list.innerHTML = Array.from(sections.values()).map((section) => {
        const allEnabled = section.mocks.length > 0 && section.mocks.every((m) => m.enabled);
        const sectionToggle = section.key !== '__ungrouped__'
          ? `<label class="switch" title="Toggle every mock in this section">
              <input type="checkbox" data-section-key="${section.key}" ${allEnabled ? 'checked' : ''} />
              <span class="slider"></span>
            </label>`
          : '';
        return `
          <div class="section-header">
            <span>${escapeHtml(section.title)} <span class="meta-text">(${section.mocks.length})</span></span>
            ${sectionToggle}
          </div>
          ${section.mocks.map((m) => mockRowHtml(m)).join('')}
        `;
      }).join('');
    } else {
      list.innerHTML = filtered.map((m) => mockRowHtml(m)).join('');
    }

    list.querySelectorAll('[data-toggle-id]').forEach((el) => {
      // The visible hit target is the wrapping <label>/<span> (the input itself
      // is 0x0 via CSS), and clicking a label bubbles *before* it fires a
      // synthetic click on its control as a default action. Stopping
      // propagation on the input alone is too late — the label's own click
      // already reached the parent .list-item by then and rebuilt the list
      // from stale state. Stop it at the label so it never bubbles at all.
      const label = el.closest('label.switch');
      if (label) label.onclick = (ev) => ev.stopPropagation();
      el.onchange = (ev) => { ev.stopPropagation(); dispatch({ type: 'TOGGLE_MOCK', payload: el.dataset.toggleId }); };
    });
    list.querySelectorAll('[data-pin-id]').forEach((el) => {
      el.onclick = (ev) => { ev.stopPropagation(); dispatch({ type: 'TOGGLE_MOCK_PIN', payload: el.dataset.pinId }); };
    });
    list.querySelectorAll('[data-remove-id]').forEach((el) => {
      el.onclick = (ev) => { ev.stopPropagation(); dispatch({ type: 'REMOVE_MOCK', payload: el.dataset.removeId }); };
    });
    list.querySelectorAll('[data-edit-id]').forEach((el) => {
      el.onclick = (ev) => {
        ev.stopPropagation();
        ui.editMockId = el.dataset.editId;
        ui.prefill = null;
        switchTab('add-mock');
      };
    });
    list.querySelectorAll('[data-section-key]').forEach((el) => {
      el.onchange = (ev) => {
        ev.stopPropagation();
        dispatch({
          type: 'SET_PRESET_SECTION_ENABLED',
          payload: { sectionKey: el.dataset.sectionKey, enabled: el.checked },
        });
      };
    });
    list.querySelectorAll('.list-item').forEach((el) => {
      el.onclick = () => { ui.selectedMockId = el.dataset.id; renderMocks(source); renderMockDetail(el.dataset.id); };
    });

    // Keep the detail panel in sync after every re-render (search, toggle, variant switch…)
    if (ui.selectedMockId && state.mocks.some((m) => m.id === ui.selectedMockId)) {
      renderMockDetail(ui.selectedMockId);
    }
  }

  function mockRowHtml(m) {
    const variants = m.variants || [];
    const activeVariant = variants.find((v) => v.id === m.activeVariantId);
    return `
      <div class="list-item ${m.id === ui.selectedMockId ? 'selected' : ''}" data-id="${m.id}">
        <div class="row" style="justify-content: space-between;">
          <div class="row">
            <span class="method-badge ${m.method}">${m.method}</span>
            ${m.source === 'preset' ? '<span class="badge-preset">PRESET</span>' : ''}
            <button class="pin-btn ${m.pinned ? 'pinned' : ''}" data-pin-id="${m.id}" title="Pin">📌</button>
          </div>
          <div class="row">
            ${m.source !== 'preset' ? `
              <button class="action ghost" data-edit-id="${m.id}" style="padding:2px 8px;">Edit</button>
              <button class="action danger" data-remove-id="${m.id}" style="padding:2px 8px;">Delete</button>
            ` : ''}
            <label class="switch"><input type="checkbox" data-toggle-id="${m.id}" ${m.enabled ? 'checked' : ''} /><span class="slider"></span></label>
          </div>
        </div>
        <div class="url-text">${escapeHtml(m.urlPattern)}</div>
        <div class="meta-text">
          ${m.matchType || 'contains'} · status ${m.status}${m.delay ? ` · ${m.delay}ms delay` : ''}
          ${variants.length > 1 ? ` · ${variants.length} variants (${escapeHtml(activeVariant ? activeVariant.name : '—')})` : ''}
        </div>
      </div>
    `;
  }

  function renderMockDetail(id) {
    const m = state.mocks.find((mock) => mock.id === id);
    if (!m) {
      detail.innerHTML = '<div class="empty-state">Select an item to see details</div>';
      return;
    }
    const variants = m.variants || [];

    detail.innerHTML = `
      <div class="row" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
        <div class="row" style="flex-wrap: wrap;">
          <span class="method-badge ${m.method}">${m.method}</span>
          ${m.source === 'preset'
            ? '<span class="badge-preset">PRESET</span>'
            : '<span class="badge-preset" style="color: var(--primary); border-color: var(--primary);">USER</span>'}
          <span class="meta-text">${m.matchType || 'contains'} match</span>
        </div>
        <div class="row">
          <button class="pin-btn ${m.pinned ? 'pinned' : ''}" id="detailPinBtn" title="Pin">📌</button>
          <label class="switch"><input type="checkbox" id="detailToggle" ${m.enabled ? 'checked' : ''} /><span class="slider"></span></label>
        </div>
      </div>
      <pre class="code-block" style="margin-top: 8px;">${escapeHtml(m.urlPattern)}</pre>

      ${variants.length > 0 ? `
        <div class="section-title">Variants (${variants.length}) — click to switch the active response</div>
        <div class="variant-switcher" id="variantSwitcher">
          ${variants.map((v) => `
            <button class="variant-card ${v.id === m.activeVariantId ? 'active' : ''}" data-variant-mock="${m.id}" data-variant-id="${v.id}">
              <span class="variant-card-name">${escapeHtml(v.name)}</span>
              <span class="variant-card-status ${statusClass(v.status)}">${v.status}</span>
              ${v.delay ? `<span class="variant-card-delay">${v.delay}ms delay</span>` : ''}
            </button>
          `).join('')}
        </div>
      ` : ''}

      <div class="section-title">Active Response</div>
      <pre class="code-block">Status ${m.status}${m.delay ? ` · delayed ${m.delay}ms` : ''}</pre>
      <div class="section-title">Response Headers</div>
      <pre class="code-block">${escapeHtml(headersBlock(m.responseHeaders))}</pre>
      <div class="section-title">Response Body</div>
      <pre class="code-block">${escapeHtml(prettyBody(m.responseBody))}</pre>

      ${m.source !== 'preset' ? `
        <div class="row" style="gap: 8px; margin-top: 8px;">
          <button class="action" id="detailEditBtn">Edit mock</button>
          <button class="action danger" id="detailDeleteBtn">Delete mock</button>
        </div>
      ` : ''}
    `;

    document.getElementById('detailToggle').onchange = () => dispatch({ type: 'TOGGLE_MOCK', payload: m.id });
    document.getElementById('detailPinBtn').onclick = () => dispatch({ type: 'TOGGLE_MOCK_PIN', payload: m.id });

    const editBtn = document.getElementById('detailEditBtn');
    if (editBtn) {
      editBtn.onclick = () => {
        ui.editMockId = m.id;
        ui.prefill = null;
        switchTab('add-mock');
      };
    }

    const deleteBtn = document.getElementById('detailDeleteBtn');
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        ui.selectedMockId = null;
        dispatch({ type: 'REMOVE_MOCK', payload: m.id });
      };
    }

    const switcher = document.getElementById('variantSwitcher');
    if (switcher) {
      switcher.querySelectorAll('.variant-card').forEach((el) => {
        el.onclick = () => dispatch({
          type: 'SET_MOCK_VARIANT',
          payload: { mockId: el.dataset.variantMock, variantId: el.dataset.variantId },
        });
      });
    }
  }

  // ----------------------------------------------------------- console

  function renderConsole() {
    const filtered = state.consoleEntries.filter((c) => {
      if (ui.consoleLevel !== 'ALL' && c.level !== ui.consoleLevel) return false;
      if (ui.consoleSearch && !c.message.toLowerCase().includes(ui.consoleSearch.toLowerCase())) return false;
      return true;
    });

    master.innerHTML = `
      <div class="toolbar">
        <input type="text" placeholder="Search…" value="${escapeHtml(ui.consoleSearch)}" id="consoleSearchInput" />
        <select id="consoleLevelSelect">
          ${['ALL', 'log', 'info', 'warn', 'error'].map((l) => `<option value="${l}" ${l === ui.consoleLevel ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <button class="action danger" id="clearConsoleBtn">Clear</button>
      </div>
      <div id="consoleList"></div>
    `;
    document.getElementById('consoleSearchInput').oninput = (e) => { ui.consoleSearch = e.target.value; renderConsole(); };
    document.getElementById('consoleLevelSelect').onchange = (e) => { ui.consoleLevel = e.target.value; renderConsole(); };
    document.getElementById('clearConsoleBtn').onclick = () => dispatch({ type: 'CLEAR_CONSOLE_ENTRIES' });

    const list = document.getElementById('consoleList');
    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state">No console output yet</div>';
    } else {
      list.innerHTML = filtered.map((c) => `
        <div class="list-item ${c.id === ui.selectedConsoleId ? 'selected' : ''}" data-id="${c.id}">
          <div class="row">
            <span class="meta-text" style="text-transform: uppercase; font-weight:700;">${c.level}</span>
            <span class="meta-text">${new Date(c.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="url-text">${escapeHtml(c.message)}</div>
        </div>
      `).join('');
      list.querySelectorAll('.list-item').forEach((el) => {
        el.onclick = () => { ui.selectedConsoleId = el.dataset.id; renderConsole(); renderConsoleDetail(el.dataset.id); };
      });
    }

    if (ui.selectedConsoleId && filtered.some((c) => c.id === ui.selectedConsoleId)) {
      renderConsoleDetail(ui.selectedConsoleId);
    }
  }

  function renderConsoleDetail(id) {
    const c = state.consoleEntries.find((entry) => entry.id === id);
    if (!c) return;
    detail.innerHTML = `
      <div class="section-title">${c.level.toUpperCase()} · ${new Date(c.timestamp).toLocaleString()}</div>
      <pre class="code-block">${escapeHtml(c.detail || c.message)}</pre>
    `;
  }

  connect();
  render();
})();
