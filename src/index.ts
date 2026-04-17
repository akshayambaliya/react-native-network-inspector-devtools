// Provider & hook
export { NetworkLoggerProvider, useNetworkLogger } from './context/NetworkLoggerContext';
export type { NetworkLoggerContextValue, NetworkLoggerProviderProps } from './context/NetworkLoggerContext';

// All-in-one setup (recommended)
export { NetworkLogger } from './components/NetworkLogger';
export type { NetworkLoggerProps } from './components/NetworkLogger';

// Components
export { NetworkLoggerAxiosInterceptor } from './components/NetworkLoggerAxiosInterceptor';
export { NetworkLoggerFAB } from './components/NetworkLoggerFAB';
export { NetworkLoggerPanel } from './components/NetworkLoggerPanel';
export { LogDetailView } from './components/LogDetailView';
export { MockEditor } from './components/MockEditor';
export type { MockPrefill } from './components/MockEditor';
export { MockListView } from './components/MockListView';
export { MockDetailView } from './components/MockDetailView';
export { PresetImporter } from './components/PresetImporter';

// Low-level API (for manual interceptor installation)
export { installInterceptors } from './utils/interceptor';

// Theme (for consumers who want to match the logger's color palette)
export { DARK, LIGHT, METHOD_COLORS, useTheme } from './theme';
export type { Theme } from './theme';

// Types
export type {
  HttpMethod,
  MockPreset,
  MockPresetVariant,
  MockUrlMatchType,
  MockVariant,
  NetworkLogEntry,
  NetworkLoggerAction,
  NetworkLoggerState,
  NetworkLogState,
  NetworkMock,
} from './types';
