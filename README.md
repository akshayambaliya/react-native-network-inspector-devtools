<div align="center">

<h1>react-native-network-inspector-devtools</h1>

<p>In-app network request logger and response mocker for React Native built for QA and debug builds. Works out of the box with <strong>axios</strong> and the global <strong>fetch</strong>.</p>

[![npm version](https://img.shields.io/npm/v/react-native-network-inspector-devtools?style=flat-square&color=blue)](https://www.npmjs.com/package/react-native-network-inspector-devtools)
[![npm downloads](https://img.shields.io/npm/dm/react-native-network-inspector-devtools?style=flat-square&color=green)](https://www.npmjs.com/package/react-native-network-inspector-devtools)
[![license](https://img.shields.io/npm/l/react-native-network-inspector-devtools?style=flat-square&color=brightgreen)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-native-network-inspector-devtools?style=flat-square&label=minzipped)](https://bundlephobia.com/package/react-native-network-inspector-devtools)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/akshayambaliya/react-native-network-inspector-devtools/pulls)

</div>

---

Tap the floating button inside your app to inspect every outgoing axios **or fetch** request URL, method, headers, request body, response body, status code, and duration all without leaving your device or opening a desktop DevTools window. Mock any endpoint at runtime regardless of whether it goes through axios or `fetch`, switch between response variants on the fly, and test your UI under edge-case conditions without changing a single line of server code.

---

## Demo

<div align="center">
<table>
  <tr>
    <td align="center" width="50%">
      <h3>🔍&nbsp; Request Logs</h3>
      <p>Inspect every axios <strong>and</strong> fetch request in real time URL, method, status, headers, request &amp; response bodies, and duration. Filter by method or search by URL.</p>
      <a href="https://github.com/user-attachments/assets/eb35178a-deb8-49a4-aac6-e713739a4503">
        <img src="https://raw.githubusercontent.com/akshayambaliya/images/ca1005b8190ecde445bfe033525e50ca03552b3c/Simulator%20Screenshot%20-%20iPhone%2015%20Pro%2018.1%20-%202026-04-10%20at%2022.08.22.png" width="320" alt="Request Logs Demo" />
      </a>
    </td>
    <td align="center" width="50%">
      <h3>🎭&nbsp; Mock from Existing API</h3>
      <p>Tap <strong>Mock</strong> on any live log row to instantly pre-fill the mock editor with its URL, method, and response no copy pasting required.</p>
      <a href="https://github.com/user-attachments/assets/cff80803-1255-4c7f-8f3a-65b1a10bdf87">
        <img src="https://raw.githubusercontent.com/akshayambaliya/images/6f50d59417c5092aa565fb60c5d0704bbf5f51e6/Simulator%20Screenshot%20-%20iPhone%2015%20Pro%2018.1%20-%202026-04-12%20at%2009.54.04.png" width="300" alt="Mock from Existing API Demo 1" />
        <img src="https://raw.githubusercontent.com/akshayambaliya/images/6f50d59417c5092aa565fb60c5d0704bbf5f51e6/Simulator%20Screenshot%20-%20iPhone%2015%20Pro%2018.1%20-%202026-04-12%20at%2009.54.13.png" width="300" alt="Mock from Existing API Demo 2" />
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <h3>✏️&nbsp; Add Mock</h3>
      <p>Manually create a mock rule for any endpoint. Choose URL match type (<code>contains</code>, <code>exact</code>, or <code>regex</code>), set the status code, body, and optional delay.</p>
       <a href="https://github.com/user-attachments/assets/670d4325-e82a-48a2-8a17-3d07cff35c09">
        <img src="https://raw.githubusercontent.com/akshayambaliya/images/ca1005b8190ecde445bfe033525e50ca03552b3c/Simulator%20Screenshot%20-%20iPhone%2015%20Pro%2018.1%20-%202026-04-10%20at%2022.08.29.png" width="320" alt="Mock from Existing API Demo" />
      </a>
    </td>
    <td align="center" width="50%">
      <h3>🔄&nbsp; Presets with Variants</h3>
      <p>Pre-load mock rules at startup via <code>initialMocks</code>. Each rule can carry multiple named variants (Success, Unauthorized, Server Error…) switch between them at runtime with one tap.</p>
      <a href="https://github.com/user-attachments/assets/24ed25d3-57db-4566-8fc3-5b7ab96ba9ae">
        <img src="https://raw.githubusercontent.com/akshayambaliya/images/ca1005b8190ecde445bfe033525e50ca03552b3c/Simulator%20Screenshot%20-%20iPhone%2015%20Pro%2018.1%20-%202026-04-10%20at%2022.08.54.png" width="320" alt="Presets with Variants Demo 1" />
        <img src="https://raw.githubusercontent.com/akshayambaliya/images/ca1005b8190ecde445bfe033525e50ca03552b3c/Simulator%20Screenshot%20-%20iPhone%2015%20Pro%2018.1%20-%202026-04-10%20at%2022.09.04.png" width="320" alt="Presets with Variants Demo 2" />
      </a>
    </td>
  </tr>
</table>
</div>

---

## Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
  - [Multiple Axios Instances](#1-multiple-axios-instances)
  - [Fetch Support (Enabled by Default)](#2-fetch-support-enabled-by-default)
  - [Pre-loading Mock Rules for QA Builds](#3-pre-loading-mock-rules-for-qa-builds)
  - [URL Blacklist (Skip Noisy or Sensitive Endpoints)](#4-url-blacklist-skip-noisy-or-sensitive-endpoints)
  - [Always-on QA Build with Increased Log Buffer](#5-always-on-qa-build-with-increased-log-buffer)
  - [Manual Setup for Full Rendering Control](#6-manual-setup-for-full-rendering-control)
- [URL Match Types](#url-match-types)
- [Configuration](#configuration)
  - [\<NetworkLogger\> Props](#networklogger-props)
  - [\<NetworkLoggerProvider\> Props](#networkloggerprovider-props)
  - [\<NetworkLoggerFAB\> Props](#networkloggerfab-props)
  - [MockPreset Options](#mockpreset-options)
  - [BlacklistRule Options](#blacklistrule-options)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

---

## Features

|                                |                                                                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One-component setup**        | A single `<NetworkLogger>` wrapper replaces all manual wiring.                                                                                                                                                                   |
| **Axios + Fetch support**      | Captures and mocks every `axios` request **and** every global `fetch(...)` call out of the box — including fetch calls made by third-party libraries. Mock rules apply uniformly regardless of which client made the request.   |
| **Live request inspector**     | View URL, method, headers, request body, response body, status, and duration for every request.                                                                                                                                  |
| **Search & filter**            | Filter logs by URL/method, filter console entries by level/content, and search presets by method, URL, or variant name.                                                                                                        |
| **Export logs**                | Share any request/response as formatted JSON via the native share sheet on every field, section header, and from the detail screen header.                                                                                       |
| **Response mocking**           | Force any endpoint to return a custom response without touching the server.                                                                                                                                                      |
| **Mock variants**              | Each rule carries multiple response scenarios; QA switches between them instantly at runtime without restarting the app.                                                                                                         |
| **Developer preset mocks**     | Pass `initialMocks` to pre-load rules at startup they appear with a **PRESET** badge in the panel.                                                                                                                               |
| **URL blacklist**              | Pass `blacklist` to silently skip noisy or sensitive endpoints (analytics, auth, asset downloads). Matching requests are never logged and never mocked — they pass straight through to the real network. Supports `contains`, `exact`, and `regex` matching, with an optional per-method filter. |
| **Smart match priority**       | `exact` beats `regex` beats `contains`; longer patterns beat shorter within the same type; user mocks always beat presets.                                                                                                       |
| **Correct 4xx/5xx behaviour**  | Mocked error responses throw an `AxiosError` (axios) or return a `Response` with the correct `status` so `res.ok === false` (fetch), so your `catch` and `if (!res.ok)` branches fire exactly as they would with a real server. |
| **One-tap mock prefill**       | Tap any log row → **Mock** to pre-fill the editor instantly.                                                                                                                                                                     |
| **Preset controls**            | The Presets tab includes a search box and an **All Presets** switch to enable/disable every preset mock in one action.                                                                                                         |
| **5-tab panel**                | Logs / Add Mock / My Mocks / Presets / Console. The **My Mocks** and **Presets** tabs show a green ping dot when at least one mock in that category is enabled.                                                               |
| **Automatic console capture**  | Captures `console.log`, `console.info`, `console.warn`, and `console.error` after mount and shows them in the Console tab with large-payload-safe rendering.                                                                    |
| **Mock active indicator**      | A **green dot** appears on the FAB corner whenever one or more mocks are enabled, so you can see interception is active without opening the panel at all.                                                                        |
| **Draggable FAB**              | Drag the floating button to any corner of the screen at runtime.                                                                                                                                                                 |
| **Dark mode**                  | Follows the device color scheme automatically.                                                                                                                                                                                   |
| **Multiple axios instances**   | Intercept as many clients as you need.                                                                                                                                                                                           |
| **Global fetch interception**  | The global `fetch` is patched once on mount (idempotent, restored on unmount). Supports string / `URL` / `Request` inputs and `Headers` / array / object headers.                                                                |
| **Zero production overhead**   | Pass `enabled={__DEV__}` to strip everything in release builds.                                                                                                                                                                  |
| **Zero non-peer dependencies** | Only `react`, `react-native`, and `axios`.                                                                                                                                                                                       |
| **Fully typed**                | Complete TypeScript definitions bundled no `@types/` package needed.                                                                                                                                                             |

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

---

## Quick Start

Wrap your app root with `<NetworkLogger>` and you are done. A floating 🌐 button appears in dev builds. Both your axios instance(s) **and** the global `fetch` are intercepted automatically.

```tsx
// App.tsx
import React from "react";
import { NetworkLogger } from "react-native-network-inspector-devtools";

import { apiClient } from "./src/api"; // your axios instance
import { RootNavigator } from "./src/navigation";

export default function App() {
  return (
    <NetworkLogger enabled={__DEV__} instance={apiClient}>
      <RootNavigator />
    </NetworkLogger>
  );
}
```

> **That is the entire setup.** Tap the floating button → inspect any request (axios or fetch) → tap **Mock** on a row to intercept it → toggle it on.

> Want axios-only? Pass `enableFetch={false}` to skip patching the global `fetch`.

---

## Usage Examples

### 1. Multiple Axios Instances

Intercept every client your app uses by passing an array. `instance` and `instances` can be combined.

```tsx
import { NetworkLogger } from "react-native-network-inspector-devtools";
import { apiClient, legacyClient, uploadClient } from "./src/api";

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

### 2. Fetch Support (Enabled by Default)

The global `fetch` is patched automatically when `<NetworkLogger>` mounts. No extra configuration is required — calls made directly by your code, by axios's fetch adapter, or by third-party libraries are all captured.

```tsx
// Any fetch() call in your tree now shows up in the panel
// and respects all configured mock rules.
async function loadDashboard() {
  const res = await fetch("https://api.example.com/dashboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: 42 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

**Mocking a fetch endpoint works exactly like axios** — the same `MockPreset` shape, the same matching rules, the same panel UI:

```tsx
import type { MockPreset } from "react-native-network-inspector-devtools";

const fetchMocks: MockPreset[] = [
  {
    urlPattern: "api.example.com/dashboard",
    method: "POST",
    matchType: "contains",
    status: 200,
    responseBody: JSON.stringify({ widgets: [], cached: true }),
    variants: [
      {
        name: "Unauthorized",
        status: 401,
        responseBody: JSON.stringify({ error: "Token expired" }),
      },
      {
        name: "Slow (3s)",
        status: 200,
        responseBody: JSON.stringify({ widgets: [{ id: 1 }] }),
        delay: 3000,
      },
    ],
  },
];

export default function App() {
  return (
    <NetworkLogger enabled={__DEV__} initialMocks={fetchMocks}>
      <RootNavigator />
    </NetworkLogger>
  );
}
```

**Opt out** if you have your own fetch wrapper or only want axios interception:

```tsx
<NetworkLogger enabled={__DEV__} enableFetch={false} instance={apiClient}>
  <RootNavigator />
</NetworkLogger>
```

> **Why this is safe:**
>
> - The patch is **idempotent** — mounting `<NetworkLogger>` twice (or mixing it with the manual `<NetworkLoggerFetchInterceptor>`) won't double-wrap fetch or produce duplicate log rows.
> - On unmount the original `fetch` is restored.
> - When `enabled={false}` (e.g. production builds) nothing is patched at all.
> - Non-2xx mocked responses produce a real `Response` with the correct status, so `res.ok` and `if (!res.ok)` behave identically to a real server.

---

### 3. Pre-loading Mock Rules for QA Builds

Seed the **Presets** tab with predefined responses at startup no UI interaction needed. The mocks are ready the moment the app opens.

```tsx
import { NetworkLogger } from "react-native-network-inspector-devtools";
import type { MockPreset } from "react-native-network-inspector-devtools";

const devMocks: MockPreset[] = [
  // Simple single-response mock
  {
    urlPattern: "/api/v1/user",
    method: "GET",
    status: 200,
    responseBody: JSON.stringify({ id: 1, name: "QA User", role: "admin" }),
  },

  // Multi-variant mock — QA can switch between Default / Unauthorized / Server Error at runtime
  {
    urlPattern: "/api/v1/auth/login",
    method: "POST",
    status: 200,
    responseBody: JSON.stringify({ token: "dev-token-abc" }),
    defaultVariant: "Unauthorized",
    variants: [
      {
        name: "Unauthorized",
        status: 401,
        responseBody: JSON.stringify({ error: "Invalid credentials" }),
      },
      {
        name: "Server Error",
        status: 503,
        responseBody: JSON.stringify({ error: "Service unavailable" }),
      },
    ],
  },

  // Regex match — intercepts /api/v1/user/42 but NOT /api/v1/users
  {
    urlPattern: "/api/v1/user/\\d+$",
    method: "GET",
    matchType: "regex",
    status: 200,
    responseBody: JSON.stringify({ id: 42, name: "User by ID" }),
  },

  // Starts disabled — QA toggles it on from the Presets tab when needed
  {
    urlPattern: "/api/v1/feature-flag",
    method: "GET",
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

### 4. URL Blacklist (Skip Noisy or Sensitive Endpoints)

Pass a `blacklist` array to silently exclude requests from the panel. Matching requests:

- are **never** added to the Logs tab,
- are **never** mocked — even if a matching preset/user mock is enabled,
- reach the network exactly as the consumer issued them.

Use it for noisy endpoints (analytics beacons, polling health checks, image / asset downloads) and for sensitive endpoints (auth tokens, payments) that must not surface in an in-app inspector — even on internal builds.

```tsx
import { NetworkLogger } from "react-native-network-inspector-devtools";
import type { BlacklistRule } from "react-native-network-inspector-devtools";

const blacklist: BlacklistRule[] = [
  // CONTAINS (default) — case-insensitive substring match on the URL.
  // Hides every analytics beacon regardless of method.
  { urlPattern: "/analytics/" },

  // EXACT + METHOD — block only POST on this specific URL.
  // GET/PUT on the same URL still appear in the panel.
  {
    urlPattern: "https://api.example.com/v1/auth/token",
    matchType: "exact",
    method: "POST",
  },

  // REGEX — hide static image assets (any extension, with or without query).
  { urlPattern: "\\.(png|jpe?g|gif|webp)(\\?|$)", matchType: "regex" },
];

export default function App() {
  return (
    <NetworkLogger
      enabled={__DEV__}
      instance={apiClient}
      blacklist={blacklist}
    >
      <RootNavigator />
    </NetworkLogger>
  );
}
```

> **Blacklist always beats mocks.** If a URL is matched by both the blacklist and a mock rule (preset or user-added), the blacklist wins — the original network request is sent and no log row is created. This is intentional and lets you guarantee certain endpoints never participate in the inspector lifecycle, even when QA enables "All Presets".

> **The blacklist is developer config, not runtime state.** It is read from the `blacklist` prop and never persisted to AsyncStorage. Change the prop value and the next request honours the new list immediately (no remount needed).

---

### 5. Always-on QA Build with Increased Log Buffer

Keep the logger active in internal QA builds without enabling it in production.

```tsx
import Constants from "expo-constants";

const isQA = Constants.expoConfig?.extra?.appVariant === "qa";

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

### 6. Manual Setup for Full Rendering Control

Use the individual primitives when you need the panel in a specific position, inside a portal, or wrapped in a feature flag gate. Add `<NetworkLoggerFetchInterceptor />` when you want fetch coverage in the manual setup.

```tsx
import {
  NetworkLoggerProvider,
  NetworkLoggerAxiosInterceptor,
  NetworkLoggerFetchInterceptor,
  NetworkLoggerFAB,
  NetworkLoggerPanel,
} from "react-native-network-inspector-devtools";
import { apiClient, uploadClient } from "./src/api";

export default function App() {
  return (
    <NetworkLoggerProvider maxEntries={300}>
      <NetworkLoggerAxiosInterceptor instance={apiClient} />
      <NetworkLoggerAxiosInterceptor instance={uploadClient} />
      {/* Mount once — patches global fetch and restores it on unmount. */}
      <NetworkLoggerFetchInterceptor />

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

| `matchType`  | Behaviour                                                  | Default | When to use                                                                               |
| ------------ | ---------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `'contains'` | URL contains the pattern as a case insensitive substring   | ✅      | Quick path-segment mocking `/user` matches `/api/v1/user` and `/api/v1/user/123`          |
| `'exact'`    | Full URL must equal the pattern exactly (case-insensitive) | —       | Mock one specific endpoint without touching similar paths                                 |
| `'regex'`    | Pattern is a JavaScript `RegExp` string                    | —       | Precise matching differentiate `/user/42` from `/users`, catch dynamic IDs, query strings |

**Match priority when multiple patterns hit the same URL:**

`exact` (score 3M+) → `regex` (score 2M+) → `contains` (score 1M+)

Within the same type, the longer pattern wins. User-added mocks always beat presets at every tier. This means a short `contains` pattern like `/users` never shadows a more specific regex like `/users/[^/]+/details`.

---

## Configuration

### `<NetworkLogger>` Props

All-in-one wrapper component. Recommended for most use cases.

| Prop           | Type                               | Default                     | Description                                                                         |
| -------------- | ---------------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `enabled`      | `boolean`                          | `true`                      | When `false`, renders children only zero library overhead. Use `enabled={__DEV__}`. |
| `instance`     | `AxiosInstance`                    | —                           | A single axios instance to intercept.                                               |
| `instances`    | `AxiosInstance[]`                  | —                           | Multiple axios instances. Can be combined with `instance`.                          |
| `enableFetch`  | `boolean`                          | `true`                      | Intercept the global `fetch` (and any fetch calls made by third-party libraries). Pass `false` to opt out and intercept axios only. |
| `initialMocks` | `MockPreset[]`                     | —                           | Pre-load mock rules at startup. Appear in the **Presets** tab with a badge. Mocks apply to both axios and fetch. |
| `blacklist`    | `BlacklistRule[]`                  | —                           | URL patterns to silently skip. Matching requests are not logged and not mocked. See [BlacklistRule Options](#blacklistrule-options). |
| `enableConsoleCapture` | `boolean`                 | `true`                      | Capture JS console output and show the **Console** tab. Set `false` to disable listener setup and hide the tab. |
| `fabPosition`  | `{ bottom?, top?, left?, right? }` | `{ bottom: 90, right: 16 }` | Starting position of the floating button. Draggable at runtime.                     |
| `maxEntries`   | `number`                           | `200`                       | Maximum log entries to retain. Oldest are dropped when the cap is reached.          |
| `children`     | `ReactNode`                        | —                           | Your app tree.                                                                      |

> **Note:** The `showMockIndicator` prop (green dot on the FAB corner) is not forwarded through `<NetworkLogger>`. If you need to control it, use the [manual setup](#5-manual-setup-for-full-rendering-control) and pass `showMockIndicator` directly to `<NetworkLoggerFAB>`.

---

### `<NetworkLoggerProvider>` Props

Context provider for the manual setup pattern.

| Prop                   | Type           | Default | Description                                                                 |
| ---------------------- | -------------- | ------- | --------------------------------------------------------------------------- |
| `initialMocks`         | `MockPreset[]` | —       | Pre-load mock rules at startup.                                             |
| `blacklist`            | `BlacklistRule[]` | —    | URL patterns to silently skip. Matching requests are not logged and not mocked. See [BlacklistRule Options](#blacklistrule-options). |
| `maxEntries`           | `number`       | `200`   | Maximum log entries to retain (applies to network + console entries).       |
| `enableConsoleCapture` | `boolean`      | `true`  | Capture JS console output and expose the Console tab. Set `false` to disable. |
| `children`             | `ReactNode`    | —       | Your app tree.                                                              |

---

### `<NetworkLoggerFAB>` Props

The floating 🌐 button that opens the panel.

| Prop                | Type                               | Default                     | Description                                                                                    |
| ------------------- | ---------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| `position`          | `{ bottom?, top?, left?, right? }` | `{ bottom: 90, right: 16 }` | Initial absolute position (before any dragging).                                               |
| `draggable`         | `boolean`                          | `true`                      | Enable / disable drag-and-drop repositioning at runtime.                                       |
| `showMockIndicator` | `boolean`                          | `true`                      | Show a green dot on the FAB corner when at least one mock is enabled. Pass `false` to hide it. |

---

### `MockPreset` Options

| Field             | Type                     | Required              | Description                                                                   |
| ----------------- | ------------------------ | --------------------- | ----------------------------------------------------------------------------- |
| `urlPattern`      | `string`                 | ✅                    | The pattern to match against outgoing request URLs.                           |
| `method`          | `HttpMethod`             | ✅                    | HTTP method (`'GET'`, `'POST'`, `'PUT'`, …).                                  |
| `matchType`       | `MockUrlMatchType`       | —                     | `'contains'` (default), `'exact'`, or `'regex'`.                              |
| `status`          | `number`                 | ✅ (if no `variants`) | HTTP status code for the implicit Default variant.                            |
| `responseBody`    | `string`                 | ✅ (if no `variants`) | Response body for the Default variant (JSON string or plain text).            |
| `responseHeaders` | `Record<string, string>` | —                     | Response headers to include.                                                  |
| `delay`           | `number`                 | —                     | Artificial delay in milliseconds before the Default variant responds.         |
| `enabled`         | `boolean`                | —                     | Whether the mock starts active. Defaults to `true`.                           |
| `variants`        | `MockPresetVariant[]`    | —                     | Additional named response scenarios.                                          |
| `defaultVariant`  | `string`                 | —                     | Name of the variant to activate on first load. Defaults to the first variant. |

---

### `BlacklistRule` Options

A single rule passed inside the `blacklist` array. Matching requests are skipped before logging and before mock matching — the original request reaches the network unchanged.

| Field        | Type                              | Required | Description                                                                                              |
| ------------ | --------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `urlPattern` | `string`                          | ✅       | The pattern to match against outgoing request URLs.                                                       |
| `matchType`  | `'contains' \| 'exact' \| 'regex'` | —        | How `urlPattern` is interpreted. Defaults to `'contains'`. Shares the same vocabulary as `MockUrlMatchType`. |
| `method`     | `HttpMethod \| 'ALL'`             | —        | Restrict the rule to a single HTTP method (e.g. `'POST'`). Defaults to `'ALL'` — matches any method.     |

**Examples:**

```tsx
// Drop every URL containing "/analytics/", any HTTP method.
{ urlPattern: "/analytics/" }

// Drop only POST requests to one exact URL.
{ urlPattern: "https://api.example.com/v1/auth/token", matchType: "exact", method: "POST" }

// Drop any static image asset (regex).
{ urlPattern: "\\.(png|jpe?g|gif|webp)(\\?|$)", matchType: "regex" }
```

> **Safety:** an invalid regex never throws — the rule simply does not match. Malformed entries (missing `urlPattern`, wrong types from untyped JS callers) are filtered out at the provider boundary and never reach the interceptors.

---

## API Reference

### `<NetworkLogger>`

All-in-one component. Renders the provider, interceptor(s), FAB, and panel in one step. Recommended for the vast majority of use cases.

```tsx
import { NetworkLogger } from "react-native-network-inspector-devtools";
```

---

### `<NetworkLoggerProvider>`

Context provider. Use directly only when you need the [manual setup](#5-manual-setup-for-full-rendering-control) pattern.

```tsx
import { NetworkLoggerProvider } from "react-native-network-inspector-devtools";
```

---

### `<NetworkLoggerAxiosInterceptor>`

Attaches axios request/response interceptors for a single instance. Must be rendered inside `<NetworkLoggerProvider>`. Cleans up automatically on unmount.

```tsx
import { NetworkLoggerAxiosInterceptor } from "react-native-network-inspector-devtools";
// Props: instance: AxiosInstance
```

---

### `<NetworkLoggerFetchInterceptor>`

Patches the global `fetch` while mounted so every fetch call (yours or any third-party library's) shows up in the panel and respects all configured mock rules. The patch is **idempotent** — mounting it more than once is a no-op (a single dev-only warning is logged). On unmount the original `fetch` is restored. Must be rendered inside `<NetworkLoggerProvider>`. Mount **once** per app.

```tsx
import { NetworkLoggerFetchInterceptor } from "react-native-network-inspector-devtools";
// Optional props:
//   target?: { fetch: typeof fetch }  // defaults to globalThis
```

> Already included automatically by `<NetworkLogger>` (controlled by the `enableFetch` prop, default `true`). Use this component directly only with the [manual setup](#5-manual-setup-for-full-rendering-control).

---

### `<NetworkLoggerFAB>`

The floating 🌐 button that opens the panel. Draggable by default.

```tsx
import { NetworkLoggerFAB } from "react-native-network-inspector-devtools";
```

---

### `<NetworkLoggerPanel>`

The full-screen modal panel. Controlled by the context's `isVisible` state; opened/closed by the FAB or `dispatch({ type: 'SET_VISIBLE', payload: true })`. Accepts no props.

```tsx
import { NetworkLoggerPanel } from "react-native-network-inspector-devtools";
```

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

## License

MIT © [Akshay Ambaliya](https://github.com/akshayambaliya)

See [LICENSE](./LICENSE) for the full license text.
