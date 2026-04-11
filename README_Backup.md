<div align="center">

<h1>react-native-network-inspector-devtools</h1>

<p>In-app network request logger and response mocker for React Native built for QA and debug builds.</p>

[![npm version](https://img.shields.io/npm/v/react-native-network-inspector-devtools?style=flat-square&color=blue)](https://www.npmjs.com/package/react-native-network-inspector-devtools)
[![npm downloads](https://img.shields.io/npm/dm/react-native-network-inspector-devtools?style=flat-square&color=green)](https://www.npmjs.com/package/react-native-network-inspector-devtools)
[![license](https://img.shields.io/npm/l/react-native-network-inspector-devtools?style=flat-square&color=brightgreen)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-native-network-inspector-devtools?style=flat-square&label=minzipped)](https://bundlephobia.com/package/react-native-network-inspector-devtools)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/akshayambaliya/react-native-network-inspector-devtools/pulls)

</div>

---

Tap the floating button inside your app to inspect every outgoing axios request URL, method, headers, request body, response body, status code, and duration all without leaving your device or opening a desktop DevTools window. Mock any endpoint at runtime, switch between response variants on the fly, and test your UI under edge-case conditions without changing a single line of server code.

---

## Demo

<div align="center">
<table>
  <tr>
    <td align="center" width="50%">
      <h3>🔍&nbsp; Request Logs</h3>
      <p>Inspect every axios request in real time — URL, method, status, headers, request &amp; response bodies, and duration. Filter by method or search by URL.</p>
      <video src="https://raw.githubusercontent.com/akshayambaliya/images/ca1005b8190ecde445bfe033525e50ca03552b3c/Logs_Final.mov" width="320" controls muted></video>
    </td>
    <td align="center" width="50%">
      <h3>🎭&nbsp; Mock from Existing API</h3>
      <p>Tap <strong>Mock</strong> on any live log row to instantly pre-fill the mock editor with its URL, method, and response — no copy-pasting required.</p>
      <video src="https://raw.githubusercontent.com/akshayambaliya/images/refs/heads/main/Mock_From_Exiting_Api.mov" width="320" controls muted></video>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <h3>✏️&nbsp; Add Mock</h3>
      <p>Manually create a mock rule for any endpoint. Choose URL match type (<code>contains</code>, <code>exact</code>, or <code>regex</code>), set the status code, body, and optional delay.</p>
      <video src="https://raw.githubusercontent.com/akshayambaliya/images/refs/heads/main/Add%20Mock.mov" width="320" controls muted></video>
    </td>
    <td align="center" width="50%">
      <h3>🔄&nbsp; Presets with Variants</h3>
      <p>Pre-load mock rules at startup via <code>initialMocks</code>. Each rule can carry multiple named variants (Success, Unauthorized, Server Error…) — switch between them at runtime with one tap.</p>
      <video src="https://raw.githubusercontent.com/akshayambaliya/images/refs/heads/main/Presets_With_Varients_High.mov" width="320" controls muted></video>
    </td>
  </tr>
</table>
</div>

---

## Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Installation](#installation)
  - [Peer Dependencies](#peer-dependencies)
  - [Optional — Clipboard Support](#optional--clipboard-support)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
  - [Multiple Axios Instances](#1-multiple-axios-instances)
  - [Pre-loading Mock Rules for QA Builds](#2-pre-loading-mock-rules-for-qa-builds)
  - [Always-on QA Build with Increased Log Buffer](#3-always-on-qa-build-with-increased-log-buffer)
  - [Manual Setup for Full Rendering Control](#4-manual-setup-for-full-rendering-control)
- [URL Match Types](#url-match-types)
- [Configuration](#configuration)
  - [\<NetworkLogger\> Props](#networklogger-props)
  - [\<NetworkLoggerProvider\> Props](#networkloggerprovider-props)
  - [\<NetworkLoggerFAB\> Props](#networkloggerfab-props)
  - [MockPreset Options](#mockpreset-options)
- [API Reference](#api-reference)
- [TypeScript](#typescript)
- [How Mock Variants Work](#how-mock-variants-work)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)

---

## Features

| | |
|---|---|
| **One-component setup** | A single `<NetworkLogger>` wrapper replaces all manual wiring. |
| **Live request inspector** | View URL, method, headers, request body, response body, status, and duration for every request. |
| **Search & filter** | Filter logs by URL or HTTP method in real time. |
| **Export logs** | Share any request/response as formatted JSON via the native share sheet — on every field, section header, and from the detail screen header. |
| **Response mocking** | Force any endpoint to return a custom response without touching the server. |
| **Mock variants** | Each rule carries multiple response scenarios; QA switches between them instantly at runtime without restarting the app. |
| **Developer preset mocks** | Pass `initialMocks` to pre-load rules at startup — they appear with a **PRESET** badge in the panel. |
| **Smart match priority** | `exact` beats `regex` beats `contains`; longer patterns beat shorter within the same type; user mocks always beat presets. |
| **Correct 4xx/5xx behaviour** | Mocked error responses throw an `AxiosError` with `error.response` populated, so your `catch` blocks fire exactly as they would with a real server. |
| **One-tap mock prefill** | Tap any log row → **Mock** to pre-fill the editor instantly. |
| **4-tab panel** | Logs / Add Mock / My Mocks / Presets. The **My Mocks** and **Presets** tabs each show a green ping dot when at least one mock in that category is currently enabled — a quick in-panel signal that requests are being intercepted. |
| **Mock active indicator** | A **green dot** appears on the FAB corner whenever one or more mocks are enabled, so you can see interception is active without opening the panel at all. |
| **Draggable FAB** | Drag the floating button to any corner of the screen at runtime. |
| **Dark mode** | Follows the device color scheme automatically. |
| **Multiple axios instances** | Intercept as many clients as you need. |
| **Zero production overhead** | Pass `enabled={__DEV__}` to strip everything in release builds. |
| **Zero non-peer dependencies** | Only `react`, `react-native`, and `axios`. |
| **Fully typed** | Complete TypeScript definitions bundled — no `@types/` package needed. |

---

## Installation

```bash
# npm
npm install react-native-network-inspector-devtools

# yarn
yarn add react-native-network-inspector-devtools

# pnpm
pnpm add react-native-network-inspector-devtools
```

### Peer Dependencies

These packages are almost certainly already in your project:

```bash
npm install axios react react-native
```

| Package | Required version |
|---|---|
| `react` | `>=18.0.0` |
| `react-native` | `>=0.73.0` |
| `axios` | `>=1.0.0` |

### Optional — Clipboard Support

Copy buttons use `@react-native-clipboard/clipboard` when available. If the package is absent, tapping copy falls back to the native share sheet — so **copy always works with zero extra configuration**.

```bash
npm install @react-native-clipboard/clipboard
```

---

## Quick Start

Wrap your app root with `<NetworkLogger>` and you are done. A floating 🌐 button appears in dev builds.

```tsx
// App.tsx
import React from 'react';
import { NetworkLogger } from 'react-native-network-inspector-devtools';

import { apiClient } from './src/api'; // your axios instance
import { RootNavigator } from './src/navigation';

export default function App() {
  return (
    <NetworkLogger enabled={__DEV__} instance={apiClient}>
      <RootNavigator />
    </NetworkLogger>
  );
}
```

> **That is the entire setup.** Tap the floating button → inspect any request → tap **Mock** on a row to intercept it → toggle it on.

---

## Usage Examples

### 1. Multiple Axios Instances

Intercept every client your app uses by passing an array. `instance` and `instances` can be combined.

```tsx
import { NetworkLogger } from 'react-native-network-inspector-devtools';
import { apiClient, legacyClient, uploadClient } from './src/api';

export default function App() {
  return (
    <NetworkLogger
      enabled={__DEV__}
      instances={[apiClient, legacyClient, uploadClient]}
    >
      <RootNavigator />
    </NetworkLogger>
  );
}
```

---

### 2. Pre-loading Mock Rules for QA Builds

Seed the **Presets** tab with predefined responses at startup no UI interaction needed. The mocks are ready the moment the app opens.

```tsx
import { NetworkLogger } from 'react-native-network-inspector-devtools';
import type { MockPreset } from 'react-native-network-inspector-devtools';

const devMocks: MockPreset[] = [
  // Simple single-response mock
  {
    urlPattern: '/api/v1/user',
    method: 'GET',
    status: 200,
    responseBody: JSON.stringify({ id: 1, name: 'QA User', role: 'admin' }),
  },

  // Multi-variant mock — QA can switch between Default / Unauthorized / Server Error at runtime
  {
    urlPattern: '/api/v1/auth/login',
    method: 'POST',
    status: 200,
    responseBody: JSON.stringify({ token: 'dev-token-abc' }),
    defaultVariant: 'Unauthorized',
    variants: [
      {
        name: 'Unauthorized',
        status: 401,
        responseBody: JSON.stringify({ error: 'Invalid credentials' }),
      },
      {
        name: 'Server Error',
        status: 503,
        responseBody: JSON.stringify({ error: 'Service unavailable' }),
      },
    ],
  },

  // Regex match — intercepts /api/v1/user/42 but NOT /api/v1/users
  {
    urlPattern: '/api/v1/user/\\d+$',
    method: 'GET',
    matchType: 'regex',
    status: 200,
    responseBody: JSON.stringify({ id: 42, name: 'User by ID' }),
  },

  // Starts disabled — QA toggles it on from the Presets tab when needed
  {
    urlPattern: '/api/v1/feature-flag',
    method: 'GET',
    status: 200,
    responseBody: JSON.stringify({ enabled: false }),
    enabled: false,
  },
];

export default function App() {
  return (
    <NetworkLogger
      enabled={__DEV__}
      instance={apiClient}
      initialMocks={devMocks}
    >
      <RootNavigator />
    </NetworkLogger>
  );
}
```

---

### 3. Always-on QA Build with Increased Log Buffer

Keep the logger active in internal QA builds without enabling it in production.

```tsx
import Constants from 'expo-constants';

const isQA = Constants.expoConfig?.extra?.appVariant === 'qa';

export default function App() {
  return (
    <NetworkLogger
      enabled={__DEV__ || isQA}
      instance={apiClient}
      maxEntries={500}
      fabPosition={{ bottom: 140, right: 20 }}
    >
      <RootNavigator />
    </NetworkLogger>
  );
}
```

---

### 4. Manual Setup for Full Rendering Control

Use the individual primitives when you need the panel in a specific position, inside a portal, or wrapped in a feature flag gate.

```tsx
import {
  NetworkLoggerProvider,
  NetworkLoggerAxiosInterceptor,
  NetworkLoggerFAB,
  NetworkLoggerPanel,
} from 'react-native-network-inspector-devtools';
import { apiClient, uploadClient } from './src/api';

export default function App() {
  return (
    <NetworkLoggerProvider maxEntries={300}>
      <NetworkLoggerAxiosInterceptor instance={apiClient} />
      <NetworkLoggerAxiosInterceptor instance={uploadClient} />

      <RootNavigator />

      {__DEV__ && <NetworkLoggerFAB position={{ bottom: 90, right: 16 }} />}
      {__DEV__ && <NetworkLoggerPanel />}
    </NetworkLoggerProvider>
  );
}
```

---

## URL Match Types

Every mock rule has a `matchType` that controls how its `urlPattern` is compared to outgoing request URLs.

| `matchType` | Behaviour | Default | When to use |
|---|---|---|---|
| `'contains'` | URL contains the pattern as a case-insensitive substring | ✅ | Quick path-segment mocking — `/user` matches `/api/v1/user` and `/api/v1/user/123` |
| `'exact'` | Full URL must equal the pattern exactly (case-insensitive) | — | Mock one specific endpoint without touching similar paths |
| `'regex'` | Pattern is a JavaScript `RegExp` string | — | Precise matching — differentiate `/user/42` from `/users`, catch dynamic IDs, query strings |

**Match priority when multiple patterns hit the same URL:**

`exact` (score 3M+) → `regex` (score 2M+) → `contains` (score 1M+)

Within the same type, the longer pattern wins. User-added mocks always beat presets at every tier. This means a short `contains` pattern like `/users` never shadows a more specific regex like `/users/[^/]+/details`.

---

## Configuration

### `<NetworkLogger>` Props

All-in-one wrapper component. Recommended for most use cases.

| Prop | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | When `false`, renders children only — zero library overhead. Use `enabled={__DEV__}`. |
| `instance` | `AxiosInstance` | — | A single axios instance to intercept. |
| `instances` | `AxiosInstance[]` | — | Multiple axios instances. Can be combined with `instance`. |
| `initialMocks` | `MockPreset[]` | — | Pre-load mock rules at startup. Appear in the **Presets** tab with a badge. |
| `fabPosition` | `{ bottom?, top?, left?, right? }` | `{ bottom: 90, right: 16 }` | Starting position of the floating button. Draggable at runtime. |
| `maxEntries` | `number` | `200` | Maximum log entries to retain. Oldest are dropped when the cap is reached. |
| `children` | `ReactNode` | — | Your app tree. |

> **Note:** The `showMockIndicator` prop (green dot on the FAB corner) is not forwarded through `<NetworkLogger>`. If you need to control it, use the [manual setup](#4-manual-setup-for-full-rendering-control) and pass `showMockIndicator` directly to `<NetworkLoggerFAB>`.

---

### `<NetworkLoggerProvider>` Props

Context provider for the manual setup pattern.

| Prop | Type | Default | Description |
|---|---|---|---|
| `initialMocks` | `MockPreset[]` | — | Pre-load mock rules at startup. |
| `maxEntries` | `number` | `200` | Maximum log entries to retain. |
| `children` | `ReactNode` | — | Your app tree. |

---

### `<NetworkLoggerFAB>` Props

The floating 🌐 button that opens the panel.

| Prop | Type | Default | Description |
|---|---|---|---|
| `position` | `{ bottom?, top?, left?, right? }` | `{ bottom: 90, right: 16 }` | Initial absolute position (before any dragging). |
| `draggable` | `boolean` | `true` | Enable / disable drag-and-drop repositioning at runtime. |
| `showMockIndicator` | `boolean` | `true` | Show a green dot on the FAB corner when at least one mock is enabled. Pass `false` to hide it. |

---

### `MockPreset` Options

| Field | Type | Required | Description |
|---|---|---|---|
| `urlPattern` | `string` | ✅ | The pattern to match against outgoing request URLs. |
| `method` | `HttpMethod` | ✅ | HTTP method (`'GET'`, `'POST'`, `'PUT'`, …). |
| `matchType` | `MockUrlMatchType` | — | `'contains'` (default), `'exact'`, or `'regex'`. |
| `status` | `number` | ✅ (if no `variants`) | HTTP status code for the implicit Default variant. |
| `responseBody` | `string` | ✅ (if no `variants`) | Response body for the Default variant (JSON string or plain text). |
| `responseHeaders` | `Record<string, string>` | — | Response headers to include. |
| `delay` | `number` | — | Artificial delay in milliseconds before the Default variant responds. |
| `enabled` | `boolean` | — | Whether the mock starts active. Defaults to `true`. |
| `variants` | `MockPresetVariant[]` | — | Additional named response scenarios. |
| `defaultVariant` | `string` | — | Name of the variant to activate on first load. Defaults to the first variant. |

---

## API Reference

### `<NetworkLogger>`

All-in-one component. Renders the provider, interceptor(s), FAB, and panel in one step. Recommended for the vast majority of use cases.

```tsx
import { NetworkLogger } from 'react-native-network-inspector-devtools';
```

---

### `<NetworkLoggerProvider>`

Context provider. Use directly only when you need the [manual setup](#4-manual-setup-for-full-rendering-control) pattern.

```tsx
import { NetworkLoggerProvider } from 'react-native-network-inspector-devtools';
```

---

### `<NetworkLoggerAxiosInterceptor>`

Attaches axios request/response interceptors for a single instance. Must be rendered inside `<NetworkLoggerProvider>`. Cleans up automatically on unmount.

```tsx
import { NetworkLoggerAxiosInterceptor } from 'react-native-network-inspector-devtools';
// Props: instance: AxiosInstance
```

---

### `<NetworkLoggerFAB>`

The floating 🌐 button that opens the panel. Draggable by default.

```tsx
import { NetworkLoggerFAB } from 'react-native-network-inspector-devtools';
```

---

### `<NetworkLoggerPanel>`

The full-screen modal panel. Controlled by the context's `isVisible` state; opened/closed by the FAB or `dispatch({ type: 'SET_VISIBLE', payload: true })`. Accepts no props.

```tsx
import { NetworkLoggerPanel } from 'react-native-network-inspector-devtools';
```

---

### `useNetworkLogger()`

Access the full logger state and dispatch function from any component inside the provider tree. Throws a descriptive error when called outside the provider.

```ts
import { useNetworkLogger } from 'react-native-network-inspector-devtools';

const {
  entries,        // NetworkLogEntry[]             — all captured log entries
  mocks,          // NetworkMock[]                 — all mock rules (presets + user-added)
  activeMocks,    // NetworkMock[]                 — only enabled mocks (used by the interceptor)
  isVisible,      // boolean                       — panel open/close state
  selectedEntry,  // NetworkLogEntry | null         — currently selected log entry
  dispatch,       // Dispatch<NetworkLoggerAction>  — reducer dispatch
} = useNetworkLogger();
```

---

### `installInterceptors(axiosInstance, dispatchRef, activeMocksRef)`

Low-level programmatic interceptor installation. Use **only** when you cannot render `<NetworkLoggerAxiosInterceptor>` — for example when the axios instance lives outside the React tree. Returns a cleanup function.

```ts
import { installInterceptors } from 'react-native-network-inspector-devtools';

const cleanup = installInterceptors(axiosInstance, dispatchRef, activeMocksRef);
// call cleanup() to eject interceptors and clear internal state
```

---

## TypeScript

Types are bundled — **no `@types/` package needed**. Import them directly:

```ts
import type {
  // Log entries
  NetworkLogEntry,
  NetworkLogState,           // 'pending' | 'done' | 'error'

  // Mock rules (runtime)
  NetworkMock,
  MockVariant,

  // Developer preset input types
  MockPreset,
  MockPresetVariant,

  // Config
  MockUrlMatchType,          // 'contains' | 'exact' | 'regex'
  HttpMethod,                // 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | ...

  // State & actions (custom integrations)
  NetworkLoggerState,
  NetworkLoggerAction,

  // Component props
  NetworkLoggerProps,
  NetworkLoggerProviderProps,

  // Theme
  Theme,
} from 'react-native-network-inspector-devtools';
```

**Key type distinctions:**

| Type | Purpose |
|---|---|
| `MockPreset` | Developer-facing **input** type for `initialMocks`. Supports `variants[]` and `defaultVariant`. |
| `MockPresetVariant` | A single variant entry in `MockPreset.variants[]`. |
| `NetworkMock` | Internal **runtime** type. Includes `id`, `source`, resolved `status` / `responseBody`, `variants`, `activeVariantId`. |
| `MockVariant` | A single runtime variant inside `NetworkMock.variants[]`. Always has an `id`. |
| `MockUrlMatchType` | `'contains' \| 'exact' \| 'regex'` |
| `HttpMethod` | `'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE' \| 'HEAD' \| 'OPTIONS' \| string` |

> The library is compiled with TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`). You benefit from accurate autocomplete on all props and types.

---

## How Mock Variants Work

| What you define in `MockPreset` | Variants shown in the panel |
|---|---|
| Root `status` only | `Default` (1 variant) |
| Root `status` + 2 `variants[]` entries | `Default`, Variant A, Variant B (3 total) |
| `variants[]` only, no root `status` | Only the named variants — no implicit Default |

**Rules:**

- Variant IDs are position-based (`v0`, `v1`, `v2`…) — never derived from name, so duplicate variant names are fully supported and never cause selection conflicts.
- `defaultVariant` is matched by name; when duplicates exist the **first match** wins.
- Switching a variant takes effect on the **next matching request** — no restart required.
- User-added mocks (from the Add Mock tab) always have a single `Default` variant.

---

## FAQ

<details>
<summary><strong>Does this affect production builds?</strong></summary>

No. Pass `enabled={__DEV__}` and the entire library is a no-op in production — no context, no interceptors, no floating button, and no bundle cost (the tree-shaker eliminates it).

</details>

<details>
<summary><strong>I set status 400 on a mock but my catch block never fires. Why?</strong></summary>

Some network logger libraries use a custom axios adapter that bypasses `validateStatus`, meaning 4xx/5xx responses resolve instead of rejecting. `react-native-network-inspector-devtools` correctly throws an `axios.AxiosError` with `error.response` fully populated for any mocked error status, so your catch block fires exactly as it would with a real server error.

</details>

<details>
<summary><strong>Two of my mocks both match the same URL — which one wins?</strong></summary>

The most specific match wins. Scoring order: `exact` > `regex` > `contains`. Within the same match type, the longer pattern wins. If scores are still equal, user-added mocks beat presets.

</details>

<details>
<summary><strong>Can I have a user mock and a preset mock for the same endpoint at the same time?</strong></summary>

Yes. They coexist in state independently. When both are enabled the user mock wins. Disable the user mock and the preset becomes active again — no deletion needed.

</details>

<details>
<summary><strong>Does the interceptor work with multiple axios instances?</strong></summary>

Yes. Pass all instances via `instances={[client1, client2]}` on `<NetworkLogger>`, or render one `<NetworkLoggerAxiosInterceptor instance={client} />` per instance in the manual setup.

</details>

<details>
<summary><strong>Can I use this library without Expo?</strong></summary>

Yes, it is framework-agnostic React Native. No Expo SDK is required.

</details>

---

## Roadmap

- [ ] Persist logs across app restarts (optional AsyncStorage adapter)
- [ ] Export logs as HAR (HTTP Archive) format for importing into browser DevTools
- [ ] GraphQL request support — query name extraction and variable display
- [ ] Pin / star individual log entries
- [ ] Shareable mock rule presets via JSON import/export
- [ ] REST API to control mocks from CI/test runner (e.g. Detox integration)
- [ ] Gesture-based panel open (swipe edge trigger)

---

## Contributing

Contributions are welcome. Please open an issue to discuss a change before submitting a PR for large features.

```bash
# 1. Clone the repository
git clone https://github.com/akshayambaliya/react-native-network-inspector-devtools.git
cd react-native-network-inspector-devtools

# 2. Install dependencies
npm install

# 3. Build the library
npm run build

# 4. Check types
npm run check-types

# 5. Lint
npm run lint
```

**Submitting a pull request:**

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes in `src/`
3. Run `npm run build` and confirm it exits cleanly
4. Open a PR against `main` with a clear description of what changed and why

---

## Changelog

**v0.1.1** — Initial release

- Full axios request/response logging panel
- Response mocking with URL match types (`contains`, `exact`, `regex`)
- Mock variants with runtime switching
- Developer preset mocks via `initialMocks`
- Specificity-based match scoring (`exact` > `regex` > `contains`)
- Correct 4xx/5xx throw behaviour from the custom axios adapter
- 4-tab panel: Logs / Add Mock / My Mocks / Presets
- Active ping-dot indicator on mock tabs
- Draggable FAB
- Dark mode support
- Full TypeScript definitions

---

## License

MIT © [Akshay Ambaliya](https://github.com/akshayambaliya)

See [LICENSE](./LICENSE) for the full license text.
