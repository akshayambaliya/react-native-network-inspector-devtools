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
  BlacklistRule,
} from "../types";
import { pickMock } from "./mockMatcher";
import { isBlacklisted } from "./blacklistMatcher";

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

export const installInterceptors = (
  axiosInstance: AxiosInstance,
  dispatchRef: { current: Dispatch<NetworkLoggerAction> },
  activeMocksRef: { current: NetworkMock[] },
  blacklistRef?: { current: BlacklistRule[] },
): (() => void) => {
  /** Correlates a config object → { id, startTime } without injecting custom headers. */
  const reqMeta = new Map<object, { id: string; startTime: number }>();

  const reqId = axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
      const requestUrl = resolveUrl(config);
      const requestMethod = (config.method ?? "GET").toUpperCase();

      // Blacklist short-circuit — drop before logging or mock matching.
      // The response interceptor's reqMeta lookup will miss naturally,
      // so this single check is sufficient to make the request invisible.
      if (isBlacklisted(blacklistRef?.current, requestUrl, requestMethod)) {
        return config;
      }

      const id = nextId();
      const startTime = Date.now();

      reqMeta.set(config, { id, startTime });

      const entry: NetworkLogEntry = {
        id,
        url: requestUrl,
        method: requestMethod,
        requestHeaders: headersToRecord(config.headers),
        requestBody: safeStringify(config.data),
        startTime,
        state: "pending",
        isMocked: false,
      };

      dispatchRef.current({ type: "ADD_ENTRY", payload: entry });

      // Split active mocks by source so each tier is searched independently.
      // Within each tier the highest-specificity match wins (not first-array-order).
      // User mocks are tried first; presets serve as fallback.
      const matchedMock = pickMock(
        activeMocksRef.current,
        requestUrl,
        requestMethod,
      );

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
