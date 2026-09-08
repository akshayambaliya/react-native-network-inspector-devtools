import { NativeModules, Platform } from 'react-native';

import type { NetworkLoggerAction, NetworkLoggerState } from '../types';

const DEFAULT_PORT = 8973;
const RECONNECT_DELAY_MS = 2000;
const SEND_DEBOUNCE_MS = 150;

/**
 * Best-effort discovery of the machine running the web panel server.
 * Reuses the Metro dev server host embedded in the JS bundle URL so the
 * feature works out of the box on physical devices, not just simulators.
 */
function resolveDefaultHost(): string {
  try {
    const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
    const match = scriptURL?.match(/https?:\/\/([^/:]+)/);
    if (match?.[1]) return match[1];
  } catch {
    // Fall through to the platform default below.
  }
  // Android emulators map the host loopback address to 10.0.2.2.
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

export interface WebSyncOptions {
  /** Host of the machine running `npx network-inspector-web`. */
  host?: string;
  /** Port the web panel server is listening on. Defaults to `8973`. */
  port?: number;
  /** Called whenever the web panel dispatches an action (e.g. toggling a mock). */
  onAction: (action: NetworkLoggerAction) => void;
}

export interface WebSyncHandle {
  /** Queues the latest state to be sent to the web panel (debounced). */
  sendState: (state: NetworkLoggerState) => void;
  /** Closes the connection and stops reconnect attempts. */
  disconnect: () => void;
}

/**
 * Opens a `WebSocket` connection to the companion web panel relay server and
 * keeps it alive with simple reconnect-with-delay behaviour. Not part of the
 * public API — used internally by `NetworkLoggerProvider` when `enableWebSync`
 * is set.
 */
export function connectWebSync(options: WebSyncOptions): WebSyncHandle {
  const host = options.host ?? resolveDefaultHost();
  const port = options.port ?? DEFAULT_PORT;
  const url = `ws://${host}:${port}`;

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let sendTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingState: NetworkLoggerState | null = null;
  let closedByCaller = false;

  const flushState = () => {
    if (!pendingState || socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'state', payload: pendingState }));
    pendingState = null;
  };

  const scheduleReconnect = () => {
    if (closedByCaller || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_DELAY_MS);
  };

  const connect = () => {
    try {
      socket = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      socket?.send(JSON.stringify({ type: 'hello', role: 'mobile' }));
      flushState();
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as {
          type?: string;
          payload?: NetworkLoggerAction;
        };
        if (message?.type === 'action' && message.payload) {
          options.onAction(message.payload);
        }
      } catch {
        // Ignore malformed messages from the relay.
      }
    };

    socket.onclose = () => {
      socket = null;
      scheduleReconnect();
    };

    // onerror is always followed by onclose, which handles reconnection.
    socket.onerror = () => {};
  };

  connect();

  return {
    sendState: (state) => {
      pendingState = state;
      if (sendTimer) return;
      sendTimer = setTimeout(() => {
        sendTimer = null;
        flushState();
      }, SEND_DEBOUNCE_MS);
    },
    disconnect: () => {
      closedByCaller = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (sendTimer) clearTimeout(sendTimer);
      socket?.close();
      socket = null;
    },
  };
}
