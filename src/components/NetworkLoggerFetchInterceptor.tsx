import { useEffect, useRef, type Dispatch } from 'react';

import { useNetworkLogger } from '../context/NetworkLoggerContext';
import type { NetworkLoggerAction, NetworkMock } from '../types';
import { installFetchInterceptor } from '../utils/fetchInterceptor';

export interface NetworkLoggerFetchInterceptorProps {
  /**
   * Optional custom target object holding a `fetch` property. Defaults to
   * `globalThis`. Most apps should leave this unset — React Native's global
   * `fetch` is what every library (including `axios` with the fetch adapter)
   * ends up calling.
   */
  target?: { fetch: typeof fetch };
}

/**
 * Patches the global `fetch` while mounted so every request shows up in the
 * Network Logger panel and respects all configured mock rules. Cleans up the
 * patch on unmount.
 *
 * Must be rendered inside `<NetworkLoggerProvider>`. Mount only **once** per
 * app — mounting twice would chain two patched fetches.
 */
export const NetworkLoggerFetchInterceptor = ({
  target,
}: NetworkLoggerFetchInterceptorProps = {}) => {
  const { dispatch, activeMocks } = useNetworkLogger();

  const dispatchRef = useRef<Dispatch<NetworkLoggerAction>>(dispatch);
  const activeMocksRef = useRef<NetworkMock[]>(activeMocks);
  const targetRef = useRef<{ fetch: typeof fetch } | undefined>(target);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    activeMocksRef.current = activeMocks;
  }, [activeMocks]);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    return installFetchInterceptor(dispatchRef, activeMocksRef, {
      target: targetRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- install once on mount only
  }, []);

  return null;
};
