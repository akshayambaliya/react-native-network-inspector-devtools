import type { ConsoleEntry, ConsoleLogLevel } from '../types';

type ConsoleSubscriber = (entry: ConsoleEntry) => void;
type ConsoleMethod = (...args: unknown[]) => void;

const CONSOLE_METHODS: ConsoleLogLevel[] = ['log', 'info', 'warn', 'error'];
const subscribers = new Set<ConsoleSubscriber>();

let patchRefCount = 0;
let sequence = 0;
let originalConsole: Partial<Record<ConsoleLogLevel, ConsoleMethod>> | null = null;

const noop: ConsoleMethod = () => {};

const createCircularReplacer = (seen: WeakSet<object>) =>
  (_key: string, value: unknown) => {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    if (typeof value === 'bigint') return `${value}n`;
    if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
    if (typeof value === 'symbol') return value.toString();
    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  };

const formatConsoleArg = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value === 'object') {
    try {
      const result = JSON.stringify(value, createCircularReplacer(new WeakSet<object>()), 2);
      return typeof result === 'string' ? result : String(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const buildConsolePayload = (args: unknown[]) => {
  const detail = args.length > 0
    ? args.map((arg) => formatConsoleArg(arg)).join('\n\n')
    : '(empty)';
  const message = detail.replace(/\s+/g, ' ').trim() || '(empty)';

  return {
    message: message.length > 180 ? `${message.slice(0, 177)}...` : message,
    detail,
  };
};

const emitConsoleEntry = (level: ConsoleLogLevel, args: unknown[]) => {
  if (subscribers.size === 0) return;

  const now = Date.now();
  const { message, detail } = buildConsolePayload(args);
  const entry: ConsoleEntry = {
    id: `console-${now}-${sequence++}`,
    level,
    message,
    detail,
    timestamp: now,
  };

  for (const subscriber of subscribers) {
    try {
      subscriber(entry);
    } catch {
      // Never let a logging subscriber break the app's console calls.
    }
  }
};

const installGlobalConsolePatch = () => {
  if (patchRefCount > 0) {
    patchRefCount += 1;
    return;
  }

  const runtimeConsole = globalThis.console;
  if (!runtimeConsole) return;

  originalConsole = {
    log: runtimeConsole.log?.bind(runtimeConsole) ?? noop,
    info: runtimeConsole.info?.bind(runtimeConsole) ?? noop,
    warn: runtimeConsole.warn?.bind(runtimeConsole) ?? noop,
    error: runtimeConsole.error?.bind(runtimeConsole) ?? noop,
  };

  for (const method of CONSOLE_METHODS) {
    runtimeConsole[method] = (...args: unknown[]) => {
      originalConsole?.[method]?.(...args);
      emitConsoleEntry(method, args);
    };
  }

  patchRefCount = 1;
};

const uninstallGlobalConsolePatch = () => {
  if (patchRefCount === 0) return;

  patchRefCount -= 1;
  if (patchRefCount > 0) return;

  const runtimeConsole = globalThis.console;
  if (runtimeConsole && originalConsole) {
    for (const method of CONSOLE_METHODS) {
      runtimeConsole[method] = originalConsole[method] ?? noop;
    }
  }

  originalConsole = null;
};

export const subscribeToConsoleEntries = (subscriber: ConsoleSubscriber) => {
  installGlobalConsolePatch();
  subscribers.add(subscriber);

  return () => {
    subscribers.delete(subscriber);
    uninstallGlobalConsolePatch();
  };
};