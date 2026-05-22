import { useEffect, useRef, type Dispatch } from 'react';

import type { AxiosInstance } from 'axios';

import { useNetworkLogger } from '../context/NetworkLoggerContext';
import type { NetworkLoggerAction, NetworkMock } from '../types';
import { installInterceptors } from '../utils/interceptor';

interface Props {
  instance: AxiosInstance;
  dashboardUrl?: string;
}

export const NetworkLoggerAxiosInterceptor = ({ instance, dashboardUrl }: Props) => {
  const { dispatch, activeMocks } = useNetworkLogger();

  const dispatchRef = useRef<Dispatch<NetworkLoggerAction>>(dispatch);
  const activeMocksRef = useRef<NetworkMock[]>(activeMocks);
  const instanceRef = useRef<AxiosInstance>(instance);
  const dashboardUrlRef = useRef<string | undefined>(dashboardUrl);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    activeMocksRef.current = activeMocks;
  }, [activeMocks]);

  useEffect(() => {
    instanceRef.current = instance;
  }, [instance]);

  useEffect(() => {
    dashboardUrlRef.current = dashboardUrl;
  }, [dashboardUrl]);

  useEffect(() => {
    return installInterceptors(instanceRef.current, dispatchRef, activeMocksRef, dashboardUrlRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- install once on mount only
  }, []);

  return null;
};
