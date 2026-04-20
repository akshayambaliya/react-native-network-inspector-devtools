export type NetworkLogState = 'pending' | 'done' | 'error';

/** HTTP method, uppercase. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | (string & {});

/**
 * Controls how `urlPattern` is matched against the outgoing request URL.
 *
 * | Value | Behaviour | Example pattern | Matches |
 * |---|---|---|---|
 * | `'contains'` | Pattern is a substring of the URL (default, case-insensitive) | `/user` | `/api/v1/user`, `/api/user/123` **and** `/superuser` |
 * | `'exact'` | Full URL must equal the pattern exactly (case-insensitive) | `https://api.example.com/v1/user` | Only that exact URL |
 * | `'regex'` | Pattern is treated as a JavaScript `RegExp` | `/\/user\/\d+$/` | `/api/user/42`, not `/api/users` |
 */
export type MockUrlMatchType = 'contains' | 'exact' | 'regex';

export interface NetworkLogEntry {
  id: string;
  url: string;
  method: HttpMethod;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  status?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  duration?: number;
  startTime: number;
  endTime?: number;
  state: NetworkLogState;
  isMocked: boolean;
}

/**
 * A single response variant for a mock rule.
 * Each mock can carry multiple variants (success, error, empty…) and the
 * QA user can switch between them at runtime from the Mocks tab.
 */
export interface MockVariant {
  /** Unique ID generated internally — do not set manually. */
  id: string;
  /** Display name shown in the Mocks tab (e.g. "Success", "Not Found"). */
  name: string;
  /** HTTP status code this variant returns. */
  status: number;
  /** Response body string — JSON or plain text. */
  responseBody: string;
  /** Optional response headers to return for this variant. */
  responseHeaders?: Record<string, string>;
  /**
   * Artificial delay in **milliseconds** before the mocked response is returned.
   * Defaults to `0` (immediate). Use this to simulate slow network conditions
   * or timeout scenarios. Maximum recommended value is 60 000 (60 s).
   */
  delay?: number;
}

export interface NetworkMock {
  id: string;
  /** Optional display name for the mock. Shown in the mocks list if provided, otherwise urlPattern is used. */
  name?: string;
  urlPattern: string;
  method: HttpMethod;
  /**
   * How `urlPattern` is matched against the request URL. Defaults to `'contains'`.
   * See `MockUrlMatchType` for the full description of each mode.
   */
  matchType?: MockUrlMatchType;
  /** Resolved status from the active variant. Updated by `SET_MOCK_VARIANT`. */
  status: number;
  /** Resolved response body from the active variant. Updated by `SET_MOCK_VARIANT`. */
  responseBody: string;
  responseHeaders?: Record<string, string>;
  enabled: boolean;
  source?: 'preset' | 'user';
  /**
   * All available variants for this mock rule. Always contains at least one entry
   * ("Default") after the rule is created or loaded from presets.
   */
  variants?: MockVariant[];
  /** ID of the currently active variant. Set automatically; updated by `SET_MOCK_VARIANT`. */
  activeVariantId?: string;
  /**
   * Resolved delay in **milliseconds** from the active variant.
   * `0` or `undefined` means respond immediately.
   */
  delay?: number;
}

/**
 * A single variant definition inside a `MockPreset`.
 * If a preset has multiple variants, QA can switch between them at runtime.
 */
export interface MockPresetVariant {
  /** Display name shown in the Mocks tab (e.g. "Success", "Not Found"). */
  name: string;
  /** HTTP status code this variant returns. */
  status: number;
  /** Response body string — JSON or plain text. */
  responseBody: string;
  /** Optional response headers to return for this variant. */
  responseHeaders?: Record<string, string>;
  /**
   * Artificial delay in **milliseconds** before this variant's response is returned.
   * Defaults to `0` (immediate).
   */
  delay?: number;
}

/**
 * A mock rule pre-loaded by the developer at initialisation time.
 * Pass an array of these as `initialMocks` to `<NetworkLogger />` or
 * `<NetworkLoggerProvider />`.
 *
 * ### Single response
 * Root-level `status` + `responseBody` form a single **"Default"** variant.
 * ```tsx
 * { urlPattern: '/api/user', method: 'GET', status: 200, responseBody: JSON.stringify({ id: 1 }) }
 * ```
 *
 * ### Root + extra variants (most common multi-scenario setup)
 * The root fields always become the **"Default"** variant shown first. Explicit
 * `variants` are appended after it. QA always has a baseline to return to.
 * ```tsx
 * {
 *   urlPattern: '/api/auth/login',
 *   method: 'POST',
 *   status: 200,
 *   responseBody: JSON.stringify({ token: 'abc' }),  // → Default variant
 *   variants: [
 *     { name: 'Wrong Credentials', status: 401, responseBody: JSON.stringify({ error: 'Unauthorized' }) },
 *     { name: 'Server Error',      status: 503, responseBody: JSON.stringify({ error: 'Unavailable' }) },
 *   ],
 * }
 * // UI shows 3 variants: Default (200) | Wrong Credentials (401) | Server Error (503)
 * ```
 *
 * ### Variants only (no implicit Default)
 * Omit root `status` to skip the implicit Default and show only the named variants.
 * ```tsx
 * {
 *   urlPattern: '/api/user',
 *   method: 'GET',
 *   defaultVariant: 'Not Found',
 *   variants: [
 *     { name: 'Success',   status: 200, responseBody: JSON.stringify({ id: 1, name: 'QA User' }) },
 *     { name: 'Not Found', status: 404, responseBody: JSON.stringify({ error: 'Not found' }) },
 *   ],
 * }
 * ```
 */
export interface MockPreset {
  /** Optional display name for the preset. Shown in the mocks list if provided, otherwise urlPattern is used. */
  name?: string;
  /** URL pattern to match. How it is interpreted depends on `matchType`. */
  urlPattern: string;
  method: HttpMethod;
  /**
   * How `urlPattern` is matched against the request URL. Defaults to `'contains'`.
   * See `MockUrlMatchType` for the full description of each mode.
   */
  matchType?: MockUrlMatchType;
  /**
   * HTTP status code the mock returns (100–599).
   * Required when `variants` is not provided.
   */
  status?: number;
  /**
   * Response body string — JSON or plain text.
   * Required when `variants` is not provided.
   */
  responseBody?: string;
  /** Optional response headers to return with the mocked response. */
  responseHeaders?: Record<string, string>;
  /**
   * Artificial delay in **milliseconds** applied to the implicit "Default" variant
   * (the one built from root-level `status` + `responseBody`). Defaults to `0`.
   */
  delay?: number;
  /**
   * Whether the mock is initially active. Defaults to `true`.
   * The QA user can also toggle it at runtime from the Mocks tab.
   */
  enabled?: boolean;
  /**
   * When provided alongside root-level `status` + `responseBody`, the root
   * fields form an implicit **"Default"** variant (listed first) and these
   * variants are appended after it — giving QA a baseline to return to at any
   * time. When root `status` is omitted, only these variants are shown.
   *
   * Variant IDs are assigned by position (v0, v1, v2…), never by name, so
   * duplicate names are fully supported and never cause selection conflicts.
   */
  variants?: MockPresetVariant[];
  /**
   * Name of the variant that should be active on first load.
   * When multiple variants share the same `name`, the **first match** wins.
   * Defaults to the first variant in the list (which is the implicit "Default"
   * when root-level `status` is defined).
   */
  defaultVariant?: string;
}

export interface NetworkLoggerState {
  entries: NetworkLogEntry[];
  mocks: NetworkMock[];
  isVisible: boolean;
  selectedEntryId: string | null;
  maxEntries: number;
}

export type NetworkLoggerAction =
  | { type: 'ADD_ENTRY'; payload: NetworkLogEntry }
  | { type: 'UPDATE_ENTRY'; payload: { id: string; patch: Partial<NetworkLogEntry> } }
  | { type: 'CLEAR_ENTRIES' }
  | { type: 'SET_VISIBLE'; payload: boolean }
  | { type: 'SET_SELECTED_ENTRY'; payload: string | null }
  | { type: 'HYDRATE_MOCKS'; payload: NetworkMock[] }
  | { type: 'ADD_MOCK'; payload: NetworkMock }
  | { type: 'UPDATE_MOCK'; payload: { id: string; patch: Partial<NetworkMock> } }
  | { type: 'REMOVE_MOCK'; payload: string }
  | { type: 'TOGGLE_MOCK'; payload: string }
  | { type: 'SET_MOCK_VARIANT'; payload: { mockId: string; variantId: string } }
  | { type: 'ADD_PRESETS'; payload: MockPreset[] };
