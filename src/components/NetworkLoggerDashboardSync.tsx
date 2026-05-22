import { useEffect, useMemo, useRef } from 'react';

import { useNetworkLogger } from '../context/NetworkLoggerContext';
import type { NetworkLoggerAction } from '../types';
import { withDashboardDevice } from '../utils/dashboardDevice';

interface Props {
  dashboardUrl?: string;
}

interface DashboardAction {
  id: number;
  type: NetworkLoggerAction['type'];
  payload?: unknown;
}

const actionTypes = new Set<NetworkLoggerAction['type']>([
  'ADD_MOCK',
  'REMOVE_MOCK',
  'TOGGLE_MOCK',
  'SET_MOCK_VARIANT',
  'CLEAR_ENTRIES',
  'SET_FAB_VISIBLE',
]);

const getDashboardBaseUrl = (dashboardUrl?: string) => {
  if (!dashboardUrl) return undefined;
  return dashboardUrl.replace(/\/logs\/?$/, '');
};

const sendJson = (url: string, body: unknown) => {
  if (typeof fetch !== 'function') return;
  fetch(withDashboardDevice(url), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    // Dashboard sync is best-effort and must never affect app behavior.
  });
};

export const NetworkLoggerDashboardSync = ({ dashboardUrl }: Props) => {
  const { mocks, isFabVisible, dispatch } = useNetworkLogger();
  const baseUrl = useMemo(() => getDashboardBaseUrl(dashboardUrl), [dashboardUrl]);
  const lastActionIdRef = useRef(0);
  const dispatchRef = useRef(dispatch);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    if (!baseUrl) return;
    sendJson(`${baseUrl}/mocks`, { mocks, isFabVisible });
  }, [baseUrl, mocks, isFabVisible]);

  useEffect(() => {
    if (!baseUrl || typeof fetch !== 'function') return;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(withDashboardDevice(`${baseUrl}/actions?since=${lastActionIdRef.current}`));
        const data = await response.json();
        const actions = Array.isArray(data?.actions) ? data.actions as DashboardAction[] : [];
        for (const action of actions) {
          if (typeof action.id === 'number') {
            lastActionIdRef.current = Math.max(lastActionIdRef.current, action.id);
          }
          if (!actionTypes.has(action.type)) continue;
          dispatchRef.current({ type: action.type, payload: action.payload } as NetworkLoggerAction);
        }
      } catch {
        // Keep polling; dashboard may not be running yet.
      }
    };

    poll();
    const interval = setInterval(() => {
      if (!cancelled) poll();
    }, 800);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [baseUrl]);

  return null;
};
