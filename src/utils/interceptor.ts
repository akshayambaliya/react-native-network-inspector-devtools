import axios from "axios";
import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import type { Dispatch } from "react";

import type {
  NetworkLogEntry,
  NetworkLoggerAction,
  NetworkMock,
} from "../types";

/** Monotonic counter — no collision risk, no custom header injected into real requests. */
let _reqCounter = 0;
const nextId = (): string => (++_reqCounter).toString(36);

const safeStringify = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const headersToRecord = (headers: unknown): Record<string, string> => {
  if (!headers || typeof headers !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof val === "string") result[key] = val;
  }
  return result;
};

/** Resolves the full URL from an axios config, combining baseURL and url. */
const resolveUrl = (config: InternalAxiosRequestConfig): string => {
  const base = config.baseURL ?? "";
  const path = config.url ?? "";
  if (!base || path.startsWith("http")) return path;
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
};

/**
 * Returns a **specificity score** when `url` matches `mock`, or `null` when it does not.
 *
 * Score = (matchTypeWeight × 1_000_000) + urlPattern.length
 *
 * Match-type weights:
 *   `exact`    → 3  — always beats regex and contains
 *   `regex`    → 2  — always beats contains
 *   `contains` → 1  — broadest, least specific
 *
 * Within the same match type, a longer pattern has a higher score because it
 * constrains the URL more tightly (e.g. `/payments/[^/]+/execution` is more
 * specific than `/payments`).
 *
 * This prevents a short `contains` pattern such as `/payments` from shadowing a
 * longer regex such as `/payments/[^/]+/execution` that is clearly a better fit.
 */
const urlMatchScore = (url: string, mock: NetworkMock): number | null => {
  const pattern = mock.urlPattern ?? "";
  switch (mock.matchType) {
    case "exact":
      if (url.toLowerCase() !== pattern.toLowerCase()) return null;
      return 3_000_000 + pattern.length;
    case "regex": {
      try {
        if (!new RegExp(pattern).test(url)) return null;
        return 2_000_000 + pattern.length;
      } catch {
        // Invalid regex — treat as no match rather than crashing.
        return null;
      }
    }
    case "contains":
    default:
      if (!url.toLowerCase().includes(pattern.toLowerCase())) return null;
      return 1_000_000 + pattern.length;
  }
};

/**
 * Among `candidates` that are enabled and match `url`+`method`, returns the one
 * with the highest specificity score. Ties are broken by array order (first wins).
 */
const findBestMock = (
  candidates: NetworkMock[],
  url: string,
  method: string,
): NetworkMock | undefined => {
  let best: NetworkMock | undefined;
  let bestScore = -1;
  for (const mock of candidates) {
    if ((mock.method ?? '').toUpperCase() !== method) continue;
    const score = urlMatchScore(url, mock);
    if (score !== null && score > bestScore) {
      bestScore = score;
      best = mock;
    }
  }
  return best;
};

export const installInterceptors = (
  axiosInstance: AxiosInstance,
  dispatchRef: { current: Dispatch<NetworkLoggerAction> },
  activeMocksRef: { current: NetworkMock[] },
): (() => void) => {
  /** Correlates a config object → { id, startTime } without injecting custom headers. */
  const reqMeta = new Map<object, { id: string; startTime: number }>();

  const reqId = axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
      const id = nextId();
      const startTime = Date.now();

      reqMeta.set(config, { id, startTime });

      const entry: NetworkLogEntry = {
        id,
        url: resolveUrl(config),
        method: (config.method ?? "GET").toUpperCase(),
        requestHeaders: headersToRecord(config.headers),
        requestBody: safeStringify(config.data),
        startTime,
        state: "pending",
        isMocked: false,
      };

      dispatchRef.current({ type: "ADD_ENTRY", payload: entry });

      const requestUrl = resolveUrl(config);
      const requestMethod = (config.method ?? "").toUpperCase();

      // Split active mocks by source so each tier is searched independently.
      // Within each tier the highest-specificity match wins (not first-array-order).
      // User mocks are tried first; presets serve as fallback.
      const userMocks = activeMocksRef.current.filter(
        (m) => m.source !== "preset",
      );
      const presetMocks = activeMocksRef.current.filter(
        (m) => m.source === "preset",
      );
      const matchedMock =
        findBestMock(userMocks, requestUrl, requestMethod) ??
        findBestMock(presetMocks, requestUrl, requestMethod);

      if (matchedMock) {
        dispatchRef.current({
          type: "UPDATE_ENTRY",
          payload: { id, patch: { isMocked: true } },
        });
        config.adapter = async () => {
          const rawBody = matchedMock.responseBody ?? "";
          let parsedBody: unknown;
          try {
            parsedBody = rawBody.trim() ? JSON.parse(rawBody) : {};
          } catch {
            parsedBody = rawBody;
          }

          // Honour per-variant (or per-mock) delay before resolving.
          const delayMs = matchedMock.delay ?? 0;
          if (delayMs > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
          }

          const mockedResponse: AxiosResponse = {
            data: parsedBody,
            status: matchedMock.status,
            statusText: `${matchedMock.status} (mocked)`,
            headers: matchedMock.responseHeaders ?? {},
            config,
            request: {},
          };

          // Axios's built-in adapters (XHR/HTTP) call validateStatus to decide
          // whether to resolve or reject. Custom adapters bypass this check, so
          // we must enforce it manually — otherwise 4xx/5xx mocks always resolve
          // and the caller's catch block never fires.
          //
          // validateStatus defaults to: status >= 200 && status < 300
          // It can be overridden per-request or at the axios instance level.
          const validateStatus =
            config.validateStatus ?? ((s: number) => s >= 200 && s < 300);

          if (!validateStatus(matchedMock.status)) {
            const err = new axios.AxiosError(
              `Request failed with status code ${matchedMock.status}`,
              String(matchedMock.status),
              config,
              {},
              mockedResponse,
            );
            throw err;
          }

          return mockedResponse;
        };
      }

      return config;
    },
  );

  const resId = axiosInstance.interceptors.response.use(
    (response: AxiosResponse): AxiosResponse => {
      const meta = response.config ? reqMeta.get(response.config) : undefined;
      if (meta) {
        const { id, startTime } = meta;
        reqMeta.delete(response.config);
        const endTime = Date.now();
        dispatchRef.current({
          type: "UPDATE_ENTRY",
          payload: {
            id,
            patch: {
              status: response.status,
              responseHeaders: headersToRecord(response.headers),
              responseBody: safeStringify(response.data),
              endTime,
              duration: endTime - startTime,
              state: "done",
            },
          },
        });
      }
      return response;
    },
    (error: AxiosError) => {
      const meta = error.config ? reqMeta.get(error.config) : undefined;
      if (meta) {
        const { id, startTime } = meta;
        if (error.config) reqMeta.delete(error.config);
        const endTime = Date.now();
        dispatchRef.current({
          type: "UPDATE_ENTRY",
          payload: {
            id,
            patch: {
              status: error.response?.status,
              responseHeaders: error.response
                ? headersToRecord(error.response.headers)
                : undefined,
              // Prefer the actual server response body; fall back to the
              // axios error message only when there is no response at all
              // (e.g. network timeout, DNS failure, CORS block).
              responseBody: error.response
                ? safeStringify(error.response.data)
                : error.message,
              endTime,
              duration: endTime - startTime,
              state: "error",
            },
          },
        });
      }
      throw error;
    },
  );

  return () => {
    axiosInstance.interceptors.request.eject(reqId);
    axiosInstance.interceptors.response.eject(resId);
    reqMeta.clear();
  };
};
