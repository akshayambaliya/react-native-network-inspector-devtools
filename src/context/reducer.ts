import type { NetworkLoggerAction, NetworkLoggerState } from '../types';

export const initialState: NetworkLoggerState = {
  entries: [],
  mocks: [],
  isVisible: false,
  selectedEntryId: null,
  maxEntries: 200,
};

export function reducer(
  state: NetworkLoggerState,
  action: NetworkLoggerAction
): NetworkLoggerState {
  switch (action.type) {
    case 'ADD_ENTRY': {
      const entries = [action.payload, ...state.entries];
      return { ...state, entries: entries.slice(0, state.maxEntries) };
    }
    case 'UPDATE_ENTRY':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.payload.id ? { ...e, ...action.payload.patch } : e
        ),
      };
    case 'CLEAR_ENTRIES':
      return { ...state, entries: [], selectedEntryId: null };
    case 'SET_VISIBLE':
      return { ...state, isVisible: action.payload };
    case 'SET_SELECTED_ENTRY':
      return { ...state, selectedEntryId: action.payload };
    case 'HYDRATE_MOCKS':
      return { ...state, mocks: action.payload };
    case 'ADD_MOCK': {
      // Deduplicate only within user-added mocks.
      // Preset mocks with the same URL+method are intentionally kept — the
      // interceptor checks user mocks first, so the user rule takes priority
      // without destroying the developer's preset for the session.
      const incomingKey = `${action.payload.urlPattern.toLowerCase()}||${action.payload.method.toUpperCase()}`;
      const filtered = state.mocks.filter(
        (m) =>
          m.source === 'preset' ||
          `${m.urlPattern.toLowerCase()}||${m.method.toUpperCase()}` !== incomingKey
      );
      // User-added mocks always have a single "Default" variant.
      // ID is index-based (v0) for consistency with the preset ID scheme.
      const defaultVariantId = `${action.payload.id}__v0`;
      const withData = {
        ...action.payload,
        source: 'user' as const,
        delay: action.payload.delay,
        variants: [
          {
            id: defaultVariantId,
            name: 'Default',
            status: action.payload.status,
            responseBody: action.payload.responseBody,
            responseHeaders: action.payload.responseHeaders,
            delay: action.payload.delay,
          },
        ],
        activeVariantId: defaultVariantId,
      };
      return { ...state, mocks: [...filtered, withData] };
    }
    case 'UPDATE_MOCK': {
      return {
        ...state,
        mocks: state.mocks.map((m) => {
          if (m.id !== action.payload.id) return m;
          const patched = { ...m, ...action.payload.patch };
          // Keep the active variant in sync with the top-level fields that were
          // patched. This prevents SET_MOCK_VARIANT from reverting to stale data
          // after the user edits a mock through MockEditor.
          const { patch } = action.payload;
          if (patched.variants?.length && patched.activeVariantId) {
            patched.variants = patched.variants.map((v) =>
              v.id === patched.activeVariantId
                ? {
                    ...v,
                    ...('status' in patch && { status: patch.status }),
                    ...('responseBody' in patch && { responseBody: patch.responseBody }),
                    ...('delay' in patch && { delay: patch.delay }),
                    ...('responseHeaders' in patch && { responseHeaders: patch.responseHeaders }),
                  }
                : v
            );
          }
          return patched;
        }),
      };
    }
    case 'REMOVE_MOCK':
      return { ...state, mocks: state.mocks.filter((m) => m.id !== action.payload) };
    case 'TOGGLE_MOCK':
      return {
        ...state,
        mocks: state.mocks.map((m) =>
          m.id === action.payload ? { ...m, enabled: !m.enabled } : m
        ),
      };
    case 'TOGGLE_MOCK_PIN':
      return {
        ...state,
        mocks: state.mocks.map((m) =>
          m.id === action.payload ? { ...m, pinned: !m.pinned } : m
        ),
      };
    case 'SET_MOCK_VARIANT': {
      const { mockId, variantId } = action.payload;
      return {
        ...state,
        mocks: state.mocks.map((m) => {
          if (m.id !== mockId) return m;
          const variant = (m.variants ?? []).find((v) => v.id === variantId);
          if (!variant) return m;
          return {
            ...m,
            activeVariantId: variantId,
            status: variant.status,
            responseBody: variant.responseBody,
            // Only override headers when the variant explicitly sets them
            ...(variant.responseHeaders != null && { responseHeaders: variant.responseHeaders }),
            // Carry delay from the chosen variant (undefined means no delay)
            delay: variant.delay,
          };
        }),
      };
    }
    default:
      return state;
  }
}
