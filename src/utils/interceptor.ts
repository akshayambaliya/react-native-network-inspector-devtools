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
import { isBlacklisted } from "./blacklistMatcher";
import { withDashboardDevice } from "./dashboardDevice";
import { pickMock } from "./mockMatcher";

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

const sendDashboardLog = (
  dashboardUrlRef: { current?: string } | undefined,
  entry: NetworkLogEntry,
) => {
  const dashboardUrl = dashboardUrlRef?.current;
  if (!dashboardUrl || typeof fetch !== "function") return;

  fetch(withDashboardDevice(dashboardUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entry),
  }).catch(() => {});
};

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
  dashboardUrlRef?: { current?: string },
  blacklistRef?: { current: BlacklistRule[] },
): (() => void) => {
  const reqMeta = new Map<object, NetworkLogEntry>();

  const reqId = axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
      const requestUrl = resolveUrl(config);
      const requestMethod = (config.method ?? "GET").toUpperCase();

      if (isBlacklisted(blacklistRef?.current, requestUrl, requestMethod)) {
        return config;
      }

      const id = nextId();
      const startTime = Date.now();

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

      reqMeta.set(config, entry);
      dispatchRef.current({ type: "ADD_ENTRY", payload: entry });
      sendDashboardLog(dashboardUrlRef, entry);

      const matchedMock = pickMock(
        activeMocksRef.current,
        requestUrl,
        requestMethod,
      );

      if (matchedMock) {
        const patch: Partial<NetworkLogEntry> = { isMocked: true };
        dispatchRef.current({
          type: "UPDATE_ENTRY",
          payload: { id, patch },
        });
        reqMeta.set(config, { ...entry, ...patch });
        sendDashboardLog(dashboardUrlRef, { ...entry, ...patch });

        config.adapter = async () => {
          const rawBody = matchedMock.responseBody ?? "";
          let parsedBody: unknown;
          try {
            parsedBody = rawBody.trim() ? JSON.parse(rawBody) : {};
          } catch {
            parsedBody = rawBody;
          }

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
        const patch: Partial<NetworkLogEntry> = {
          status: response.status,
          responseHeaders: headersToRecord(response.headers),
          responseBody: safeStringify(response.data),
          endTime,
          duration: endTime - startTime,
          state: "done",
        };
        dispatchRef.current({
          type: "UPDATE_ENTRY",
          payload: { id, patch },
        });
        sendDashboardLog(dashboardUrlRef, { ...meta, ...patch });
      }
      return response;
    },
    (error: AxiosError) => {
      const meta = error.config ? reqMeta.get(error.config) : undefined;
      if (meta) {
        const { id, startTime } = meta;
        if (error.config) reqMeta.delete(error.config);
        const endTime = Date.now();
        const patch: Partial<NetworkLogEntry> = {
          status: error.response?.status,
          responseHeaders: error.response
            ? headersToRecord(error.response.headers)
            : undefined,
          responseBody: error.response
            ? safeStringify(error.response.data)
            : error.message,
          endTime,
          duration: endTime - startTime,
          state: "error",
        };
        dispatchRef.current({
          type: "UPDATE_ENTRY",
          payload: { id, patch },
        });
        sendDashboardLog(dashboardUrlRef, { ...meta, ...patch });
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
