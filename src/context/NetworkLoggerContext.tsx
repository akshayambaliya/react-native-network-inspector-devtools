import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
} from "react";

import type {
  MockPreset,
  MockVariant,
  NetworkLogEntry,
  NetworkLoggerAction,
  NetworkMock,
} from "../types";
import { initialState, reducer } from "./reducer";

const MOCKS_STORAGE_KEY = 'react-native-network-inspector-devtools:mocks';
const PRESETS_STORAGE_KEY = 'react-native-network-inspector-devtools:presets';

function getMockKey(mock: Pick<NetworkMock, 'urlPattern' | 'method'>) {
  return `${mock.method.toUpperCase()}||${mock.urlPattern.toLowerCase()}`;
}

function mergeUserMocks(
  presetMocks: NetworkMock[],
  savedUserMocks: NetworkMock[]
) {
  const presetKeys = new Set(presetMocks.map((mock) => getMockKey(mock)));
  const newUserMocks = savedUserMocks.filter(
    (mock) => !presetKeys.has(getMockKey(mock))
  );
  return [...presetMocks, ...newUserMocks];
}

const persistPresets = async (presets: NetworkMock[]) => {
  await AsyncStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
};

function isNetworkMockArray(value: unknown): value is NetworkMock[] {
  return Array.isArray(value) && value.every((mock) => {
    if (!mock || typeof mock !== 'object') return false;

    const candidate = mock as Partial<NetworkMock>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.urlPattern === 'string' &&
      typeof candidate.method === 'string' &&
      typeof candidate.status === 'number' &&
      typeof candidate.responseBody === 'string' &&
      typeof candidate.enabled === 'boolean'
    );
  });
}

/**
 * Converts developer-provided MockPreset definitions to internal NetworkMock records.
 * - Generates a deterministic ID from method + urlPattern so the same preset always
 *   gets the same ID across renders.
 * - Last definition wins when two presets share the same method + urlPattern.
 */
export function presetsToMocks(presets: MockPreset[]): NetworkMock[] {
  // Deduplicate: last entry for a given method+urlPattern wins.
  const seen = new Map<string, MockPreset>();
  for (const p of presets) {
    // Guard against callers passing malformed preset objects (e.g. from JS)
    if (!p || !p.urlPattern || !p.method) continue;
    seen.set(`${p.method.toUpperCase()}||${p.urlPattern}`, p);
  }
  return Array.from(seen.values()).map((p) => {
    const presetId = `preset__${p.method.toUpperCase()}__${p.urlPattern}`;

    // Sequential index used as the sole source of truth for variant IDs.
    // We deliberately never embed the variant name in the ID so that:
    //  • duplicate names never cause ID collisions
    //  • renaming a variant (future) doesn't orphan saved selection state
    let index = 0;
    const variants: MockVariant[] = [];

    // ── Step 1: Root-level status + responseBody → implicit "Default" variant ──
    // This is ALWAYS included when root-level `status` is defined, even when
    // explicit variants are also provided. QA always has a baseline to return to.
    if (p.status != null) {
      variants.push({
        id: `${presetId}__v${index++}`,
        name: 'Default',
        status: p.status,
        responseBody: p.responseBody ?? '',
        responseHeaders: p.responseHeaders,
        delay: p.delay,
      });
    }

    // ── Step 2: Append explicit variants. IDs are index-based only. ──
    // Duplicate names are legal — selection is always done by ID, never by name.
    for (const v of p.variants ?? []) {
      variants.push({
        id: `${presetId}__v${index++}`,
        name: v.name,
        status: v.status,
        responseBody: v.responseBody,
        responseHeaders: v.responseHeaders,
        delay: v.delay,
      });
    }

    // ── Step 3: Fallback ──
    // Neither root fields nor explicit variants were provided. Create a bare
    // Default so the mock is always operational and the UI never shows 0 variants.
    if (variants.length === 0) {
      variants.push({
        id: `${presetId}__v0`,
        name: 'Default',
        status: 200,
        responseBody: '',
        responseHeaders: p.responseHeaders,
      });
    }

    // ── Determine the initially active variant ──
    // `defaultVariant` is matched by name; when duplicates exist the first match
    // wins. Falls back to the first variant in the list (always the root Default
    // when root fields are defined).
    const activeVariant =
      (p.defaultVariant
        ? variants.find((v) => v.name === p.defaultVariant)
        : undefined) ?? variants[0]!;

    return {
      id: presetId,
      urlPattern: p.urlPattern,
      method: p.method.toUpperCase(),
      matchType: p.matchType ?? 'contains',
      // Resolved top-level fields always mirror the active variant so the
      // interceptor never needs to know about the variants structure.
      status: activeVariant.status,
      responseBody: activeVariant.responseBody,
      responseHeaders: activeVariant.responseHeaders,
      delay: activeVariant.delay,
      enabled: p.enabled ?? true,
      source: 'preset' as const,
      variants,
      activeVariantId: activeVariant.id,
    };
  });
}

export interface NetworkLoggerContextValue {
  entries: NetworkLogEntry[];
  mocks: NetworkMock[];
  /** Mocks that are currently enabled and will intercept matching requests. */
  activeMocks: NetworkMock[];
  isVisible: boolean;
  maxEntries: number;
  /** The currently selected log entry, or `null` if none selected. */
  selectedEntry: NetworkLogEntry | null;
  /** Writes the current mock list to persistent storage (AsyncStorage). */
  persistMocks: () => Promise<void>;
  dispatch: Dispatch<NetworkLoggerAction>;
}

const NetworkLoggerContext = createContext<NetworkLoggerContextValue | null>(
  null,
);

export interface NetworkLoggerProviderProps {
  children: React.ReactNode;
  /** Maximum number of log entries to retain. Oldest are dropped. Defaults to 200. */
  maxEntries?: number;
  /**
   * Pre-load a set of mock rules at startup. These appear immediately in the
   * Mocks tab with a **PRESET** badge, are active by default, and can be
   * toggled or removed by the QA user at runtime.
   *
   * Adding a new mock from the "Add Mock" tab with the same URL + method
   * automatically replaces the preset, giving the user a way to override
   * developer-defined responses without restarting the app.
   *
   * @example
   * ```tsx
   * <NetworkLogger
   *   initialMocks={[
   *     {
   *       urlPattern: '/api/v1/user',
   *       method: 'GET',
   *       status: 200,
   *       responseBody: JSON.stringify({ id: 1, name: 'QA User' }),
   *     },
   *   ]}
   * >
   * ```
   */
  initialMocks?: MockPreset[];
}

export const NetworkLoggerProvider = ({
  children,
  maxEntries = 200,
  initialMocks,
}: NetworkLoggerProviderProps) => {
  const initialPresetMocks = useMemo(
    () => presetsToMocks(initialMocks ?? []),
    [initialMocks],
  );

  // Lazy initializer: presetsToMocks() runs only once on mount, not on every render.
  const [state, dispatch] = useReducer(
    reducer,
    { initialPresetMocks, maxEntries },
    ({ initialPresetMocks: ipm, maxEntries: me }) => ({
      ...initialState,
      maxEntries: me,
      mocks: ipm,
    }),
  );

  const hasRestoredRef = useRef(false);
  // Holds latest mocks for persistMocks callback.
  const mocksRef = useRef(state.mocks);
  useEffect(() => { mocksRef.current = state.mocks; });

  // Holds latest presets for separate persistence.
  const presetsRef = useRef<NetworkMock[]>([]);

  const persistMocks = useCallback(async () => {
    // Save only user mocks (non-preset) to the mocks storage key.
    const userMocks = mocksRef.current.filter((m) => m.source !== 'preset');
    await AsyncStorage.setItem(MOCKS_STORAGE_KEY, JSON.stringify(userMocks));
  }, []); // stable — reads from ref, never needs to change

  // Separate useEffect to watch and persist presets independently.
  useEffect(() => {
    const currentPresets = state.mocks.filter((m) => m.source === 'preset');
    const hasChanged =
      currentPresets.length !== presetsRef.current.length ||
      JSON.stringify(currentPresets) !== JSON.stringify(presetsRef.current);
    if (hasChanged) {
      presetsRef.current = currentPresets;
      persistPresets(currentPresets).catch(() => {
        // Ignore persistence failures.
      });
    }
  }, [state.mocks]);

  useEffect(() => {
    let isMounted = true;

    const restoreMocks = async () => {
      try {
        const storedPresets = await AsyncStorage.getItem(PRESETS_STORAGE_KEY);
        let restoredPresets: NetworkMock[] = initialPresetMocks;
        if (storedPresets && isMounted) {
          try {
            const parsedPresets = JSON.parse(storedPresets) as unknown;
            if (isNetworkMockArray(parsedPresets)) {
              if (initialPresetMocks.length > 0) {
                restoredPresets = initialPresetMocks.map((preset) => {
                  const savedPreset = parsedPresets.find(
                    (saved) =>
                      saved.id === preset.id ||
                      getMockKey(saved) === getMockKey(preset)
                  );
                  if (!savedPreset) return preset;

                  const activeVariant = preset.variants?.find(
                    (v) => v.id === savedPreset.activeVariantId
                  ) ?? preset.variants?.[0];

                  return {
                    ...preset,
                    enabled: savedPreset.enabled,
                    activeVariantId: activeVariant?.id ?? preset.activeVariantId,
                    status: activeVariant?.status ?? preset.status,
                    responseBody: activeVariant?.responseBody ?? preset.responseBody,
                    responseHeaders: activeVariant?.responseHeaders ?? preset.responseHeaders,
                    delay: activeVariant?.delay ?? preset.delay,
                  };
                });
              } else {
                restoredPresets = parsedPresets;
              }
            }
          } catch {
            // Ignore malformed stored presets, use initialPresetMocks.
          }
        }

        // Load user mocks, merge with restored presets.
        const storedUserMocks = await AsyncStorage.getItem(MOCKS_STORAGE_KEY);
        let userMocks: NetworkMock[] = [];
        if (storedUserMocks && isMounted) {
          try {
            const parsed = JSON.parse(storedUserMocks) as unknown;
            if (isNetworkMockArray(parsed)) {
              userMocks = parsed.filter((m) => m.source !== 'preset');
            }
          } catch {
            // Ignore malformed stored mocks.
          }
        }

        const mergedMocks = mergeUserMocks(restoredPresets, userMocks);
        dispatch({ type: 'HYDRATE_MOCKS', payload: mergedMocks });
      } catch {
        // Ignore persistence failures and continue with in-memory mocks.
      } finally {
        if (isMounted) {
          hasRestoredRef.current = true;
        }
      }
    };

    restoreMocks();

    return () => {
      isMounted = false;
    };
  }, [initialPresetMocks]);

  useEffect(() => {
    if (!hasRestoredRef.current) return;

    persistMocks().catch(() => {
      // Ignore persistence failures and keep the logger usable.
    });
  }, [state.mocks, persistMocks]);

  const value = useMemo<NetworkLoggerContextValue>(() => {
    const selectedEntry = state.selectedEntryId
      ? (state.entries.find((e) => e.id === state.selectedEntryId) ?? null)
      : null;
    const activeMocks = state.mocks.filter((m) => m.enabled);

    return {
      entries: state.entries,
      mocks: state.mocks,
      activeMocks,
      isVisible: state.isVisible,
      maxEntries: state.maxEntries,
      selectedEntry,
      persistMocks,
      dispatch,
    };
  }, [state, dispatch, persistMocks]);

  return (
    <NetworkLoggerContext.Provider value={value}>
      {children}
    </NetworkLoggerContext.Provider>
  );
};

export const useNetworkLogger = (): NetworkLoggerContextValue => {
  const ctx = useContext(NetworkLoggerContext);
  if (!ctx) {
    throw new Error(
      "useNetworkLogger must be used within a NetworkLoggerProvider",
    );
  }
  return ctx;
};
