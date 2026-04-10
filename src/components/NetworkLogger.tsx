import React from "react";

import {
  NetworkLoggerProvider,
  type NetworkLoggerProviderProps,
} from "../context/NetworkLoggerContext";
import { NetworkLoggerAxiosInterceptor } from "./NetworkLoggerAxiosInterceptor";
import { NetworkLoggerFAB } from "./NetworkLoggerFAB";
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
  /** Override the FAB's default position (bottom: 90, right: 16). */
  fabPosition?: {
    bottom?: number;
    right?: number;
    top?: number;
    left?: number;
  };
  // initialMocks is inherited from NetworkLoggerProviderProps and forwarded to
  // NetworkLoggerProvider via the ...providerProps spread — no extra wiring needed.
}

/**
 * All-in-one setup component.  Replaces the four-step manual setup with a
 * single wrapper around your app root.
 *
 * @example
 * ```tsx
 * import { NetworkLogger } from 'rn-network-logger';
 * import { apiClient } from './api';
 *
 * export default function App() {
 *   return (
 *     <NetworkLogger
 *       enabled={__DEV__}
 *       instance={apiClient}
 *     >
 *       <RootNavigator />
 *     </NetworkLogger>
 *   );
 * }
 * ```
 */
export const NetworkLogger = ({
  instance,
  instances,
  enabled = true,
  fabPosition,
  children,
  ...providerProps
}: NetworkLoggerProps) => {
  // When disabled, render children with zero overhead.
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
        <NetworkLoggerAxiosInterceptor key={i} instance={inst} />
      ))}
      {children}
      <NetworkLoggerFAB position={fabPosition} />
      <NetworkLoggerPanel />
    </NetworkLoggerProvider>
  );
};
