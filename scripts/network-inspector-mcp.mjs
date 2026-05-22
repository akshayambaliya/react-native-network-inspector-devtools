#!/usr/bin/env node

import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_DASHBOARD_URL = 'http://127.0.0.1:8765';
const SERVER_NAME = 'react-native-network-inspector-devtools';
const SERVER_VERSION = '0.1.6';
const SUPPORTED_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18'];

const latestProtocolVersion = SUPPORTED_PROTOCOL_VERSIONS[SUPPORTED_PROTOCOL_VERSIONS.length - 1];

const normalizeDashboardUrl = (value) => {
  const url = new URL(value || DEFAULT_DASHBOARD_URL);
  url.pathname = url.pathname.replace(/\/(?:logs|mocks|actions|devices|events)\/?$/, '/');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.search = '';
  url.hash = '';
  return url;
};

const dashboardBaseUrl = normalizeDashboardUrl(process.env.NETWORK_INSPECTOR_URL);

const tools = [
  {
    name: 'list_devices',
    description: 'List React Native devices connected to the network inspector dashboard.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get_traffic',
    description: 'Read captured network traffic for a device, with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Device ID from list_devices. Defaults to the most recently updated device.' },
        limit: { type: 'integer', minimum: 1, maximum: 1000, default: 50 },
        method: { type: 'string', description: 'HTTP method filter, e.g. GET or POST.' },
        state: { type: 'string', enum: ['pending', 'done', 'error'] },
        urlContains: { type: 'string', description: 'Case-insensitive URL substring filter.' },
        mocked: { type: 'boolean', description: 'When set, only include mocked or non-mocked entries.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'wait_for_request',
    description: 'Wait for a new matching network request after this tool is called.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Device ID from list_devices. Defaults to the most recently updated device.' },
        timeoutMs: { type: 'integer', minimum: 100, maximum: 120000, default: 10000 },
        intervalMs: { type: 'integer', minimum: 100, maximum: 5000, default: 500 },
        method: { type: 'string', description: 'HTTP method filter, e.g. GET or POST.' },
        state: { type: 'string', enum: ['pending', 'done', 'error'] },
        urlContains: { type: 'string', description: 'Case-insensitive URL substring filter.' },
        mocked: { type: 'boolean', description: 'When set, only match mocked or non-mocked entries.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_mocks',
    description: 'Read mock rules and controller visibility for a device.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Device ID from list_devices. Defaults to the most recently updated device.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'add_mock',
    description: 'Add a user mock in the running app through the dashboard action queue.',
    inputSchema: {
      type: 'object',
      required: ['method', 'urlPattern', 'status', 'responseBody'],
      properties: {
        deviceId: { type: 'string', description: 'Device ID from list_devices. Defaults to the most recently updated device.' },
        method: { type: 'string', description: 'HTTP method, e.g. GET or POST.' },
        urlPattern: { type: 'string', description: 'URL pattern to match.' },
        matchType: { type: 'string', enum: ['contains', 'exact', 'regex'], default: 'contains' },
        status: { type: 'integer', minimum: 100, maximum: 599 },
        responseBody: {
          description: 'Response body as a string or JSON value. Non-string values are JSON-stringified.',
        },
        responseHeaders: {
          type: 'object',
          description: 'Optional response headers.',
          additionalProperties: { type: 'string' },
        },
        delayMs: { type: 'integer', minimum: 0, maximum: 60000, description: 'Optional artificial response delay in milliseconds.' },
        enabled: { type: 'boolean', default: true },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'update_mock',
    description: 'Update an existing mock rule. Identity fields are protected.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        deviceId: { type: 'string', description: 'Device ID from list_devices. Defaults to the most recently updated device.' },
        id: { type: 'string', description: 'Mock ID from get_mocks.' },
        method: { type: 'string', description: 'HTTP method, e.g. GET or POST.' },
        urlPattern: { type: 'string' },
        matchType: { type: 'string', enum: ['contains', 'exact', 'regex'] },
        status: { type: 'integer', minimum: 100, maximum: 599 },
        responseBody: {
          description: 'Response body as a string or JSON value. Non-string values are JSON-stringified.',
        },
        responseHeaders: {
          type: 'object',
          description: 'Optional response headers.',
          additionalProperties: { type: 'string' },
        },
        delayMs: { type: 'integer', minimum: 0, maximum: 60000 },
        enabled: { type: 'boolean' },
        pinned: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'remove_mock',
    description: 'Remove a user mock from the running app.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        deviceId: { type: 'string', description: 'Device ID from list_devices. Defaults to the most recently updated device.' },
        id: { type: 'string', description: 'Mock ID from get_mocks.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'toggle_mock',
    description: 'Toggle a mock rule on or off in the running app.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        deviceId: { type: 'string', description: 'Device ID from list_devices. Defaults to the most recently updated device.' },
        id: { type: 'string', description: 'Mock ID from get_mocks.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'set_mock_variant',
    description: 'Switch a multi-variant mock to a specific variant.',
    inputSchema: {
      type: 'object',
      required: ['mockId', 'variantId'],
      properties: {
        deviceId: { type: 'string', description: 'Device ID from list_devices. Defaults to the most recently updated device.' },
        mockId: { type: 'string', description: 'Mock ID from get_mocks.' },
        variantId: { type: 'string', description: 'Variant ID from get_mocks.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'set_controller_visible',
    description: 'Show or hide the in-app network inspector floating action button/controller.',
    inputSchema: {
      type: 'object',
      required: ['visible'],
      properties: {
        deviceId: { type: 'string', description: 'Device ID from list_devices. Defaults to the most recently updated device.' },
        visible: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'clear_logs',
    description: 'Clear dashboard traffic and queue the app-side clear action for the selected device.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Device ID from list_devices. Defaults to the most recently updated device.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'apply_scenario',
    description: 'Apply a declarative scenario by adding mocks, selecting variants, toggling mocks, clearing logs, or changing controller visibility.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Device ID from list_devices. Defaults to the most recently updated device.' },
        name: { type: 'string', description: 'Optional scenario label for the result.' },
        clearLogs: { type: 'boolean', default: false },
        controllerVisible: { type: 'boolean' },
        addMocks: {
          type: 'array',
          items: {
            type: 'object',
            required: ['method', 'urlPattern', 'status', 'responseBody'],
            properties: {
              method: { type: 'string' },
              urlPattern: { type: 'string' },
              matchType: { type: 'string', enum: ['contains', 'exact', 'regex'] },
              status: { type: 'integer', minimum: 100, maximum: 599 },
              responseBody: { description: 'Response body as a string or JSON value.' },
              responseHeaders: { type: 'object', additionalProperties: { type: 'string' } },
              delayMs: { type: 'integer', minimum: 0, maximum: 60000 },
              enabled: { type: 'boolean' },
            },
            additionalProperties: false,
          },
        },
        enableMockIds: { type: 'array', items: { type: 'string' } },
        disableMockIds: { type: 'array', items: { type: 'string' } },
        variants: {
          type: 'array',
          items: {
            type: 'object',
            required: ['mockId', 'variantId'],
            properties: {
              mockId: { type: 'string' },
              variantId: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  },
];

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeArgs = (args) => (isRecord(args) ? args : {});

const textResult = (text, isError = false) => ({
  content: [{ type: 'text', text }],
  ...(isError ? { isError: true } : {}),
});

const jsonResult = (value) => textResult(JSON.stringify(value, null, 2));

const errorResult = (error) =>
  textResult(error instanceof Error ? error.message : String(error), true);

const requiredString = (args, key) => {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value.trim();
};

const optionalString = (args, key) => {
  const value = args[key];
  if (value == null) return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  const trimmed = value.trim();
  return trimmed || undefined;
};

const optionalBoolean = (args, key) => {
  const value = args[key];
  if (value == null) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean`);
  return value;
};

const integerInRange = (value, key, min, max, fallback) => {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} must be an integer between ${min} and ${max}`);
  }
  return value;
};

const httpMethod = (value, key = 'method') => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} must be a non-empty HTTP method`);
  }
  return value.trim().toUpperCase();
};

const matchType = (value) => {
  if (value == null) return 'contains';
  if (!['contains', 'exact', 'regex'].includes(value)) {
    throw new Error('matchType must be one of: contains, exact, regex');
  }
  return value;
};

const responseBody = (value, key = 'responseBody') => {
  if (value == null) throw new Error(`${key} is required`);
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const responseHeaders = (value) => {
  if (value == null) return undefined;
  if (!isRecord(value)) throw new Error('responseHeaders must be an object');
  return Object.fromEntries(
    Object.entries(value).map(([key, headerValue]) => [key, String(headerValue)])
  );
};

const validateRegexPattern = (pattern, type) => {
  if (type !== 'regex') return;
  try {
    new RegExp(pattern);
  } catch (error) {
    throw new Error(`urlPattern is not a valid regular expression: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const toolPath = (path) => path.replace(/^\//, '');

const requestJson = async (path, options = {}) => {
  const url = new URL(toolPath(path), dashboardBaseUrl);
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: options.body == null ? undefined : { 'content-type': 'application/json' },
    body: options.body == null ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`${options.method ?? 'GET'} ${url.href} returned non-JSON response`);
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error ?? `${options.method ?? 'GET'} ${url.href} failed with ${response.status}`);
  }

  return payload;
};

const withDevice = (path, deviceId) => {
  const cleanPath = toolPath(path);
  const separator = cleanPath.includes('?') ? '&' : '?';
  return `${cleanPath}${separator}deviceId=${encodeURIComponent(deviceId)}`;
};

const getDevices = async () => {
  const data = await requestJson('/devices');
  return Array.isArray(data?.devices) ? data.devices : [];
};

const sortDevicesByRecency = (devices) =>
  [...devices].sort(
    (a, b) =>
      Number(b?.updatedAt ?? 0) - Number(a?.updatedAt ?? 0) ||
      String(a?.name ?? '').localeCompare(String(b?.name ?? '')) ||
      String(a?.id ?? '').localeCompare(String(b?.id ?? ''))
  );

const resolveDevice = async (args) => {
  const deviceId = optionalString(args, 'deviceId');
  const devices = await getDevices();

  if (deviceId) {
    const device = devices.find((candidate) => candidate?.id === deviceId);
    if (!device) {
      throw new Error(`Device "${deviceId}" is not connected. Use list_devices to choose an active device.`);
    }
    return { deviceId, device };
  }

  const [device] = sortDevicesByRecency(devices);
  if (!device?.id) {
    throw new Error('No devices connected to the network inspector dashboard. Start the app with dashboardUrl configured first.');
  }

  return { deviceId: device.id, device };
};

const getLogs = async (deviceId) => {
  const data = await requestJson(withDevice('/logs', deviceId));
  return Array.isArray(data?.entries) ? data.entries : [];
};

const getMockState = async (deviceId) => {
  const data = await requestJson(withDevice('/mocks', deviceId));
  return {
    mocks: Array.isArray(data?.mocks) ? data.mocks : [],
    isFabVisible: Boolean(data?.isFabVisible),
  };
};

const queueAction = async (deviceId, type, payload) => {
  await requestJson(withDevice('/actions', deviceId), {
    method: 'POST',
    body: { type, payload },
  });
};

const matchesTrafficFilters = (entry, args) => {
  const method = optionalString(args, 'method');
  const state = optionalString(args, 'state');
  const urlContains = optionalString(args, 'urlContains');
  const mocked = optionalBoolean(args, 'mocked');

  if (method && String(entry?.method ?? '').toUpperCase() !== method.toUpperCase()) {
    return false;
  }
  if (state && entry?.state !== state) {
    return false;
  }
  if (urlContains && !String(entry?.url ?? '').toLowerCase().includes(urlContains.toLowerCase())) {
    return false;
  }
  if (mocked != null && Boolean(entry?.isMocked) !== mocked) {
    return false;
  }
  return true;
};

const buildMockPayload = (args) => {
  const type = matchType(args.matchType);
  const urlPattern = requiredString(args, 'urlPattern');
  validateRegexPattern(urlPattern, type);

  const delay = integerInRange(args.delayMs, 'delayMs', 0, 60000, undefined);

  return {
    id: `mcp-mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method: httpMethod(args.method),
    urlPattern,
    matchType: type,
    status: integerInRange(args.status, 'status', 100, 599),
    responseBody: responseBody(args.responseBody),
    responseHeaders: responseHeaders(args.responseHeaders),
    delay: delay && delay > 0 ? delay : undefined,
    enabled: args.enabled !== false,
  };
};

const buildMockPatch = (args) => {
  const patch = {};

  if (hasOwn(args, 'method')) patch.method = httpMethod(args.method);
  if (hasOwn(args, 'urlPattern')) patch.urlPattern = requiredString(args, 'urlPattern');
  if (hasOwn(args, 'matchType')) patch.matchType = matchType(args.matchType);
  if (hasOwn(args, 'status')) patch.status = integerInRange(args.status, 'status', 100, 599);
  if (hasOwn(args, 'responseBody')) patch.responseBody = responseBody(args.responseBody);
  if (hasOwn(args, 'responseHeaders')) patch.responseHeaders = responseHeaders(args.responseHeaders);
  if (hasOwn(args, 'delayMs')) {
    const delay = integerInRange(args.delayMs, 'delayMs', 0, 60000);
    patch.delay = delay > 0 ? delay : undefined;
  }
  if (hasOwn(args, 'enabled')) patch.enabled = optionalBoolean(args, 'enabled');
  if (hasOwn(args, 'pinned')) patch.pinned = optionalBoolean(args, 'pinned');

  if (patch.urlPattern && patch.matchType === 'regex') {
    validateRegexPattern(patch.urlPattern, 'regex');
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('update_mock requires at least one field to update');
  }

  return patch;
};

const setMockEnabled = async (deviceId, mockId, enabled) => {
  const { mocks } = await getMockState(deviceId);
  const mock = mocks.find((candidate) => candidate?.id === mockId);
  if (!mock) throw new Error(`Mock "${mockId}" was not found`);
  if (Boolean(mock.enabled) === enabled) return false;
  await queueAction(deviceId, 'TOGGLE_MOCK', mockId);
  return true;
};

const requireMock = async (deviceId, mockId) => {
  const { mocks } = await getMockState(deviceId);
  const mock = mocks.find((candidate) => candidate?.id === mockId);
  if (!mock) throw new Error(`Mock "${mockId}" was not found`);
  return mock;
};

const handlers = {
  async list_devices() {
    const devices = await getDevices();
    return {
      dashboardUrl: dashboardBaseUrl.href,
      devices: sortDevicesByRecency(devices),
    };
  },

  async get_traffic(rawArgs) {
    const args = normalizeArgs(rawArgs);
    const { deviceId, device } = await resolveDevice(args);
    const limit = integerInRange(args.limit, 'limit', 1, 1000, 50);
    const entries = (await getLogs(deviceId)).filter((entry) => matchesTrafficFilters(entry, args));

    return {
      device,
      totalMatches: entries.length,
      returned: Math.min(entries.length, limit),
      entries: entries.slice(0, limit),
    };
  },

  async wait_for_request(rawArgs) {
    const args = normalizeArgs(rawArgs);
    const { deviceId, device } = await resolveDevice(args);
    const timeoutMs = integerInRange(args.timeoutMs, 'timeoutMs', 100, 120000, 10000);
    const intervalMs = integerInRange(args.intervalMs, 'intervalMs', 100, 5000, 500);
    const startedAt = Date.now();
    const existingIds = new Set((await getLogs(deviceId)).map((entry) => entry?.id).filter(Boolean));

    while (Date.now() - startedAt <= timeoutMs) {
      const entries = await getLogs(deviceId);
      const match = entries.find(
        (entry) => !existingIds.has(entry?.id) && matchesTrafficFilters(entry, args)
      );
      if (match) {
        return {
          device,
          waitedMs: Date.now() - startedAt,
          entry: match,
        };
      }

      await sleep(Math.min(intervalMs, Math.max(0, timeoutMs - (Date.now() - startedAt))));
    }

    throw new Error(`Timed out after ${timeoutMs}ms waiting for a new matching request`);
  },

  async get_mocks(rawArgs) {
    const args = normalizeArgs(rawArgs);
    const { deviceId, device } = await resolveDevice(args);
    return {
      device,
      ...(await getMockState(deviceId)),
    };
  },

  async add_mock(rawArgs) {
    const args = normalizeArgs(rawArgs);
    const { deviceId, device } = await resolveDevice(args);
    const mock = buildMockPayload(args);
    await queueAction(deviceId, 'ADD_MOCK', mock);
    return {
      device,
      queued: true,
      mock,
    };
  },

  async update_mock(rawArgs) {
    const args = normalizeArgs(rawArgs);
    const { deviceId, device } = await resolveDevice(args);
    const id = requiredString(args, 'id');
    const patch = buildMockPatch(args);
    const current = await requireMock(deviceId, id);
    if ((patch.matchType ?? current.matchType) === 'regex') {
      validateRegexPattern(patch.urlPattern ?? current.urlPattern, 'regex');
    }
    await queueAction(deviceId, 'UPDATE_MOCK', { id, patch });
    return {
      device,
      queued: true,
      id,
      patch,
    };
  },

  async remove_mock(rawArgs) {
    const args = normalizeArgs(rawArgs);
    const { deviceId, device } = await resolveDevice(args);
    const id = requiredString(args, 'id');
    await requireMock(deviceId, id);
    await queueAction(deviceId, 'REMOVE_MOCK', id);
    return {
      device,
      queued: true,
      id,
    };
  },

  async toggle_mock(rawArgs) {
    const args = normalizeArgs(rawArgs);
    const { deviceId, device } = await resolveDevice(args);
    const id = requiredString(args, 'id');
    await requireMock(deviceId, id);
    await queueAction(deviceId, 'TOGGLE_MOCK', id);
    return {
      device,
      queued: true,
      id,
    };
  },

  async set_mock_variant(rawArgs) {
    const args = normalizeArgs(rawArgs);
    const { deviceId, device } = await resolveDevice(args);
    const mockId = requiredString(args, 'mockId');
    const variantId = requiredString(args, 'variantId');
    const mock = await requireMock(deviceId, mockId);
    if (!Array.isArray(mock.variants) || !mock.variants.some((variant) => variant?.id === variantId)) {
      throw new Error(`Variant "${variantId}" was not found on mock "${mockId}"`);
    }
    await queueAction(deviceId, 'SET_MOCK_VARIANT', { mockId, variantId });
    return {
      device,
      queued: true,
      mockId,
      variantId,
    };
  },

  async set_controller_visible(rawArgs) {
    const args = normalizeArgs(rawArgs);
    const { deviceId, device } = await resolveDevice(args);
    const visible = optionalBoolean(args, 'visible');
    if (visible == null) throw new Error('visible must be a boolean');
    await queueAction(deviceId, 'SET_FAB_VISIBLE', visible);
    return {
      device,
      queued: true,
      visible,
    };
  },

  async clear_logs(rawArgs) {
    const args = normalizeArgs(rawArgs);
    const { deviceId, device } = await resolveDevice(args);
    await requestJson(withDevice('/logs', deviceId), { method: 'DELETE' });
    await queueAction(deviceId, 'CLEAR_ENTRIES');
    return {
      device,
      cleared: true,
    };
  },

  async apply_scenario(rawArgs) {
    const args = normalizeArgs(rawArgs);
    const { deviceId, device } = await resolveDevice(args);
    const applied = [];

    if (args.clearLogs === true) {
      await requestJson(withDevice('/logs', deviceId), { method: 'DELETE' });
      await queueAction(deviceId, 'CLEAR_ENTRIES');
      applied.push({ type: 'clear_logs' });
    }

    if (hasOwn(args, 'controllerVisible')) {
      const visible = optionalBoolean(args, 'controllerVisible');
      if (visible == null) throw new Error('controllerVisible must be a boolean');
      await queueAction(deviceId, 'SET_FAB_VISIBLE', visible);
      applied.push({ type: 'set_controller_visible', visible });
    }

    for (const addMockArgs of Array.isArray(args.addMocks) ? args.addMocks : []) {
      const mock = buildMockPayload(addMockArgs);
      await queueAction(deviceId, 'ADD_MOCK', mock);
      applied.push({ type: 'add_mock', mock });
    }

    for (const mockId of Array.isArray(args.enableMockIds) ? args.enableMockIds : []) {
      const changed = await setMockEnabled(deviceId, mockId, true);
      applied.push({ type: 'enable_mock', mockId, changed });
    }

    for (const mockId of Array.isArray(args.disableMockIds) ? args.disableMockIds : []) {
      const changed = await setMockEnabled(deviceId, mockId, false);
      applied.push({ type: 'disable_mock', mockId, changed });
    }

    for (const variant of Array.isArray(args.variants) ? args.variants : []) {
      if (!isRecord(variant)) throw new Error('variants entries must be objects');
      const mockId = requiredString(variant, 'mockId');
      const variantId = requiredString(variant, 'variantId');
      const mock = await requireMock(deviceId, mockId);
      if (!Array.isArray(mock.variants) || !mock.variants.some((item) => item?.id === variantId)) {
        throw new Error(`Variant "${variantId}" was not found on mock "${mockId}"`);
      }
      await queueAction(deviceId, 'SET_MOCK_VARIANT', { mockId, variantId });
      applied.push({ type: 'set_mock_variant', mockId, variantId });
    }

    return {
      device,
      scenario: optionalString(args, 'name'),
      queued: applied.length,
      applied,
    };
  },
};

const initializeResult = (params) => {
  const requested = params?.protocolVersion;
  const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : latestProtocolVersion;

  return {
    protocolVersion,
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
  };
};

const callTool = async (params) => {
  const name = params?.name;
  const args = params?.arguments ?? {};
  const handler = handlers[name];
  if (!handler) return textResult(`Unknown tool: ${String(name)}`, true);

  try {
    return jsonResult(await handler(args));
  } catch (error) {
    return errorResult(error);
  }
};

const writeMessage = (message) => {
  process.stdout.write(`${JSON.stringify(message)}\n`);
};

const writeResponse = (id, result) => {
  writeMessage({ jsonrpc: '2.0', id, result });
};

const writeError = (id, code, message, data) => {
  writeMessage({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  });
};

const handleRequest = async (message) => {
  if (!isRecord(message)) {
    writeError(null, -32600, 'Invalid Request');
    return;
  }

  const hasId = hasOwn(message, 'id');

  try {
    switch (message.method) {
      case 'initialize':
        if (hasId) writeResponse(message.id, initializeResult(message.params));
        return;
      case 'ping':
        if (hasId) writeResponse(message.id, {});
        return;
      case 'tools/list':
        if (hasId) writeResponse(message.id, { tools });
        return;
      case 'tools/call':
        if (hasId) writeResponse(message.id, await callTool(message.params));
        return;
      default:
        if (!hasId || String(message.method ?? '').startsWith('notifications/')) return;
        writeError(message.id, -32601, `Method not found: ${String(message.method)}`);
    }
  } catch (error) {
    if (hasId) {
      writeError(
        message.id,
        -32603,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
};

let buffer = '';
let pendingRequests = 0;
let stdinEnded = false;

const maybeExit = () => {
  if (stdinEnded && pendingRequests === 0) process.exit(0);
};

const runRequest = (message) => {
  pendingRequests += 1;
  Promise.resolve(handleRequest(message))
    .catch((error) => {
      process.stderr.write(`Unhandled MCP request error: ${error instanceof Error ? error.message : String(error)}\n`);
    })
    .finally(() => {
      pendingRequests -= 1;
      maybeExit();
    });
};

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newlineIndex = buffer.indexOf('\n');
  while (newlineIndex !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) {
      try {
        const message = JSON.parse(line);
        if (Array.isArray(message)) {
          for (const item of message) runRequest(item);
        } else {
          runRequest(message);
        }
      } catch (error) {
        writeError(null, -32700, 'Parse error', error instanceof Error ? error.message : String(error));
      }
    }
    newlineIndex = buffer.indexOf('\n');
  }
});

process.stdin.on('end', () => {
  stdinEnded = true;
  maybeExit();
});

process.on('SIGINT', () => {
  process.exit(0);
});

process.stdin.resume();
