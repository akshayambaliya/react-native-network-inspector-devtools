import type { Dispatch } from 'react';

import type {
  NetworkLogEntry,
  NetworkLoggerAction,
  NetworkMock,
} from '../types';
import { pickMock } from './mockMatcher';

/** Monotonic counter — prefixed so fetch IDs never collide with axios IDs. */
let _reqCounter = 0;
const nextId = (): string => `f${(++_reqCounter).toString(36)}`;

/**
 * Marker property set on our wrapped fetch so we can detect (and refuse to
 * double-wrap) an already-installed interceptor. Without this, mounting
 * `<NetworkLogger>` twice — or mixing `<NetworkLogger enableFetch>` with a
 * manual `<NetworkLoggerFetchInterceptor />` — would chain two patches and
 * every request would produce duplicate log rows.
 */
const PATCHED_MARKER = '__rnNetworkInspectorPatched__';

type AnyHeadersInit =
  | Headers
  | Record<string, string | string[]>
  | Array<[string, string]>
  | null
  | undefined;

const requestHeadersToRecord = (
  headers: AnyHeadersInit,
): Record<string, string> => {
  if (!headers) return {};
  const out: Record<string, string> = {};
  try {
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
      headers.forEach((value: string, key: string) => {
        out[key] = value;
      });
      return out;
    }
    if (Array.isArray(headers)) {
      for (const pair of headers) {
        if (Array.isArray(pair) && pair.length === 2) {
          const [k, v] = pair;
          if (typeof k === 'string' && typeof v === 'string') out[k] = v;
        }
      }
      return out;
    }
    if (typeof headers === 'object') {
      for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
        if (typeof v === 'string') out[k] = v;
        else if (Array.isArray(v)) out[k] = v.join(', ');
      }
    }
  } catch {
    // ignore — best-effort header capture
  }
  return out;
};

const responseHeadersToRecord = (headers: Headers): Record<string, string> => {
  const out: Record<string, string> = {};
  try {
    headers.forEach((value: string, key: string) => {
      out[key] = value;
    });
  } catch {
    // ignore
  }
  return out;
};

const safeRequestBodyToString = async (
  body: unknown,
): Promise<string | undefined> => {
  if (body == null) return undefined;
  try {
    if (typeof body === 'string') return body;
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
      return body.toString();
    }
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      return '[FormData]';
    }
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
      return `[Blob ${body.size} bytes]`;
    }
    if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) {
      return `[ArrayBuffer ${body.byteLength} bytes]`;
    }
    return String(body);
  } catch {
    return undefined;
  }
};

export interface InstallFetchInterceptorOptions {
  /**
   * Object whose `fetch` property is patched. Defaults to `globalThis`.
   * Provide a custom target if your app routes fetch through a non-global
   * holder (rare in React Native).
   */
  target?: { fetch: typeof fetch };
}

/**
 * Patches `globalThis.fetch` (or `options.target.fetch`) to log every request
 * into the NetworkLogger panel and apply any matching mock rules. Returns a
 * cleanup function that restores the original fetch.
 *
 * Behaviour matches the axios interceptor:
 *  - Mocks use the same priority rules (exact > regex > contains; longer wins;
 *    user mocks beat presets).
 *  - Non-2xx mocked statuses produce a real `Response` object — callers' own
 *    `if (!res.ok)` branches fire exactly as they would with a real server.
 *  - Per-variant delay is honoured.
 */
export const installFetchInterceptor = (
  dispatchRef: { current: Dispatch<NetworkLoggerAction> },
  activeMocksRef: { current: NetworkMock[] },
  options: InstallFetchInterceptorOptions = {},
): (() => void) => {
  const scope = (options.target ?? (globalThis as unknown)) as {
    fetch?: typeof fetch & { [PATCHED_MARKER]?: boolean };
  };

  if (typeof scope.fetch !== 'function') {
    return () => {};
  }

  // Bail out if a Response constructor isn't available (extremely old RN
  // runtimes). Without it we can't safely synthesise mocked responses.
  if (typeof Response === 'undefined') {
    return () => {};
  }

  // Idempotency: refuse to wrap a fetch that's already ours. Returns a no-op
  // cleanup so React's unmount path still works without restoring anything.
  if (scope.fetch[PATCHED_MARKER]) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        '[react-native-network-inspector-devtools] fetch is already patched ' +
          '— skipping the second install. Mount <NetworkLogger> or <NetworkLoggerFetchInterceptor> only once.',
      );
    }
    return () => {};
  }

  const originalFetch = scope.fetch.bind(scope);

  const patched: typeof fetch = async (input, init) => {
    const id = nextId();
    const startTime = Date.now();

    let url: string;
    let method: string;
    let requestHeaders: Record<string, string>;
    let requestBody: string | undefined;

    try {
      if (typeof Request !== 'undefined' && input instanceof Request) {
        url = input.url;
        method = (init?.method ?? input.method ?? 'GET').toUpperCase();
        // init.headers (if supplied) overrides the Request's headers when fetch runs.
        requestHeaders = init?.headers
          ? requestHeadersToRecord(init.headers as AnyHeadersInit)
          : requestHeadersToRecord(input.headers as unknown as AnyHeadersInit);
        if (init?.body != null) {
          requestBody = await safeRequestBodyToString(init.body);
        } else {
          try {
            const text = await input.clone().text();
            requestBody = text.length ? text : undefined;
          } catch {
            requestBody = undefined;
          }
        }
      } else {
        url =
          typeof input === 'string'
            ? input
            : typeof URL !== 'undefined' && input instanceof URL
              ? input.toString()
              : String(input);
        method = (init?.method ?? 'GET').toUpperCase();
        requestHeaders = requestHeadersToRecord(
          init?.headers as AnyHeadersInit,
        );
        requestBody = await safeRequestBodyToString(init?.body);
      }
    } catch {
      url = typeof input === 'string' ? input : String(input);
      method = (init?.method ?? 'GET').toUpperCase();
      requestHeaders = {};
      requestBody = undefined;
    }

    const entry: NetworkLogEntry = {
      id,
      url,
      method,
      requestHeaders,
      requestBody,
      startTime,
      state: 'pending',
      isMocked: false,
    };
    dispatchRef.current({ type: 'ADD_ENTRY', payload: entry });

    const matchedMock = pickMock(activeMocksRef.current, url, method);

    if (matchedMock) {
      dispatchRef.current({
        type: 'UPDATE_ENTRY',
        payload: { id, patch: { isMocked: true } },
      });

      const delayMs = matchedMock.delay ?? 0;
      if (delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }

      const body = matchedMock.responseBody ?? '';
      const headers = new Headers(matchedMock.responseHeaders ?? {});
      // Best-effort content-type when not provided — keeps callers'
      // `response.json()` working without forcing devs to set headers.
      if (!headers.has('content-type') && body.trim().length > 0) {
        try {
          JSON.parse(body);
          headers.set('content-type', 'application/json');
        } catch {
          // leave unset — body isn't JSON
        }
      }

      const mockedResponse = new Response(body, {
        status: matchedMock.status,
        statusText: `${matchedMock.status} (mocked)`,
        headers,
      });

      const endTime = Date.now();
      dispatchRef.current({
        type: 'UPDATE_ENTRY',
        payload: {
          id,
          patch: {
            status: matchedMock.status,
            responseHeaders: responseHeadersToRecord(headers),
            responseBody: body,
            endTime,
            duration: endTime - startTime,
            // Mirror axios: any non-2xx status surfaces as `error` in the
            // panel even when mocked, so QA can spot failure scenarios at a
            // glance. The caller still receives a real `Response` and its
            // own `if (!res.ok)` branch fires normally.
            state:
              matchedMock.status >= 200 && matchedMock.status < 300
                ? 'done'
                : 'error',
          },
        },
      });

      return mockedResponse;
    }

    try {
      const response = await originalFetch(input as RequestInfo, init);

      // Clone first so the caller can still consume the body once.
      let responseBody: string | undefined;
      try {
        responseBody = await response.clone().text();
      } catch {
        responseBody = undefined;
      }

      const endTime = Date.now();
      dispatchRef.current({
        type: 'UPDATE_ENTRY',
        payload: {
          id,
          patch: {
            status: response.status,
            responseHeaders: responseHeadersToRecord(response.headers),
            responseBody,
            endTime,
            duration: endTime - startTime,
            // fetch only rejects on network failure; HTTP error statuses still
            // resolve. Mirror axios's panel semantics by marking >=400 as error.
            state: response.status >= 400 ? 'error' : 'done',
          },
        },
      });

      return response;
    } catch (err: unknown) {
      const endTime = Date.now();
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
      dispatchRef.current({
        type: 'UPDATE_ENTRY',
        payload: {
          id,
          patch: {
            responseBody: message,
            endTime,
            duration: endTime - startTime,
            state: 'error',
          },
        },
      });
      throw err;
    }
  };

  scope.fetch = patched;
  // Stamp the marker so a re-install (e.g. accidental double-mount) is a no-op
  // instead of chaining patches and producing duplicate log rows.
  (patched as typeof fetch & { [PATCHED_MARKER]?: boolean })[PATCHED_MARKER] =
    true;

  return () => {
    if (scope.fetch === patched) {
      scope.fetch = originalFetch;
    }
  };
};
