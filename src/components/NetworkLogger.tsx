import React from "react";

import {
  NetworkLoggerProvider,
  type NetworkLoggerProviderProps,
} from "../context/NetworkLoggerContext";
import { NetworkLoggerAxiosInterceptor } from "./NetworkLoggerAxiosInterceptor";
import { NetworkLoggerDashboardSync } from "./NetworkLoggerDashboardSync";
import { NetworkLoggerFAB } from "./NetworkLoggerFAB";
import { NetworkLoggerFetchInterceptor } from "./NetworkLoggerFetchInterceptor";
import { NetworkLoggerPanel } from "./NetworkLoggerPanel";
import type { AxiosInstance } from "axios";

export interface NetworkLoggerProps extends NetworkLoggerProviderProps {
  /**
   * The axios instance(s) to intercept. Accepts a single instance or an array
   * for apps that use multiple axios clients.
   */
  instance?: AxiosInstance;
  /**
   * Convenience alias when you have multiple axios instances to intercept.
   * If both `instance` and `instances` are provided, both are intercepted.
   */
  instances?: AxiosInstance[];
  /**
   * Whether the logger is active. Defaults to `true`.
   * Set to `__DEV__` to automatically disable in production builds:
   * ```tsx
   * <NetworkLogger enabled={__DEV__} instance={api}>
   * ```
   */
  enabled?: boolean;
  /** Optional collector endpoint that receives every log update as JSON. */
  dashboardUrl?: string;
  /**
   * Intercept the global `fetch` (in addition to any provided axios instances).
   * **Defaults to `true`** — every `fetch(...)` call (including ones made by
   * third-party libraries that use fetch internally) is captured in the panel
   * and matched against your mock rules.
   *
   * Set to `false` to opt out — useful if you have your own fetch wrapper or
   * want to limit interception to axios only:
   *
   * ```tsx
   * <NetworkLogger enabled={__DEV__} enableFetch={false} instance={api}>
   * ```
   *
   * @default true
   */
  enableFetch?: boolean;
  /**
   * Automatically capture JS console output and show it in the Console tab.
   * Defaults to `true`. Set to `false` to disable interception and hide the tab.
   */
  enableConsoleCapture?: boolean;
  /** Override the FAB's default position (bottom: 90, right: 16). */
  fabPosition?: {
    bottom?: number;
    right?: number;
    top?: number;
    left?: number;
  };
}

export const NetworkLogger = ({
  instance,
  instances,
  enabled = true,
  dashboardUrl,
  enableFetch = true,
  fabPosition,
  children,
  ...providerProps
}: NetworkLoggerProps) => {
  if (!enabled) {
    return <>{children}</>;
  }

  const allInstances: AxiosInstance[] = [
    ...(instance ? [instance] : []),
    ...(instances ?? []),
  ];

  return (
    <NetworkLoggerProvider {...providerProps}>
      {allInstances.map((inst, i) => (
        <NetworkLoggerAxiosInterceptor
          key={i}
          instance={inst}
          dashboardUrl={dashboardUrl}
        />
      ))}
      <NetworkLoggerDashboardSync dashboardUrl={dashboardUrl} />
      {enableFetch && <NetworkLoggerFetchInterceptor />}
      {children}
      <NetworkLoggerFAB position={fabPosition} />
      <NetworkLoggerPanel />
    </NetworkLoggerProvider>
  );
};
