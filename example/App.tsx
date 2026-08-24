import React, { useEffect, useState } from "react";
import {
  jsonPlaceholderClient,
  pokeClient,
  countriesClient,
} from "./src/api/clients";
import { DEMO_PRESETS } from "./src/mocks/presets";
import { HomeScreen } from "./src/screens/HomeScreen";
import { DetailsScreen, DetailScreenParams } from "./src/screens/DetailsScreen";
import {
  NetworkLogger,
  type BlacklistRule,
  type InitialMockDefinitions,
  type MockPresetSection,
} from "react-native-network-inspector-devtools";

function isSectionPreset(
  value: InitialMockDefinitions[number],
): value is MockPresetSection {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { title?: unknown }).title === "string" &&
    "mocks" in value &&
    Array.isArray((value as { mocks?: unknown }).mocks)
  );
}

/**
 * Blacklist rules — see the "🚫 Blacklist" section on the Home screen.
 *
 * Any request whose URL (and optional method) matches one of these rules is:
 *   • NEVER added to the panel (no log row, no console capture row)
 *   • NEVER mocked, even if a matching preset / user mock is enabled
 *   • passed straight through to the real network exactly as issued
 *
 * The three entries below intentionally demonstrate all three match types.
 */
const DEMO_BLACKLIST: BlacklistRule[] = [
  // 1) CONTAINS (default) — block every URL containing "/comments".
  //    Used by `getCommentsBlacklisted()` in endpoints.ts.
  { urlPattern: "/comments" },

  // 2) REGEX — block fetches of static image assets (any extension / query).
  //    Used by `fetchImageAssetBlacklisted()` in fetchEndpoints.ts.
  { urlPattern: "\\.(png|jpe?g|gif|webp)(\\?|$)", matchType: "regex" },

  // 3) EXACT + METHOD — block ONLY the PATCH verb on this specific URL.
  //    PUT/POST/GET on the same URL still appear in the panel.
  {
    urlPattern: "https://jsonplaceholder.typicode.com/posts/1",
    matchType: "exact",
    method: "PATCH",
  },
];

/**
 * Demo App — react-native-network-inspector-devtools
 *
 * Wraps the entire app in <NetworkLogger> which:
 *  - Installs interceptors on all three axios instances
 *  - Loads preset mocks (with multiple variants) at startup
 *  - Applies the blacklist (see DEMO_BLACKLIST above) to silently ignore
 *    sensitive / noisy endpoints
 *  - Renders the draggable FAB + slide-up panel
 */
export default function App() {
  const presetCount = DEMO_PRESETS.reduce((count, entry) => {
    return count + (isSectionPreset(entry) ? entry.mocks.length : 1);
  }, 0);

  const presetSections = DEMO_PRESETS.reduce(
    (count, entry) => count + (isSectionPreset(entry) ? 1 : 0),
    0,
  );

  const [detailParams, setDetailParams] = useState<DetailScreenParams | null>(
    null,
  );

  useEffect(() => {
    console.log("[Example] Network logger demo mounted", {
      screen: "Home",
      presetsLoaded: presetCount,
      presetSections,
      blacklistRules: DEMO_BLACKLIST.length,
      clients: ["jsonPlaceholderClient", "pokeClient", "countriesClient"],
    });

    console.info("[Example] Console capture info sample", {
      hint: "Open Dev Tool > Console tab to verify automatic capture.",
      featureFlags: {
        consoleCapture: true,
        mocksEnabled: true,
      },
    });

    console.warn("[Example] Console capture warning sample", {
      scenario: "Verification only",
      note: "This warning is intentionally emitted by the example app.",
    });

    console.error("[Example] Console capture error sample", {
      scenario: "Verification only",
      recoverable: true,
      note: "This is a synthetic example error entry, not an app failure.",
    });
  }, [presetCount, presetSections]);

  return (
    <NetworkLogger
      // Intercept all three axios clients
      instances={[jsonPlaceholderClient, pokeClient, countriesClient]}
      // Also intercept the global `fetch` — see the "Fetch" section on Home.
      // Defaults to true in v0.2+, but stated explicitly here for the demo.
      enableFetch
      // Pre-load mocks so the Presets tab is ready to use straight away
      initialMocks={DEMO_PRESETS}
      // URLs matching any of these rules are NEVER captured or mocked.
      // See the "🚫 Blacklist" section on Home for live demo buttons.
      blacklist={DEMO_BLACKLIST}
      // Always enabled in this demo; in a real app: enabled={__DEV__}
      enabled
      // FAB sits just above the home-indicator area
      fabPosition={{ bottom: 40, right: 20 }}
    >
      {detailParams ? (
        <DetailsScreen {...detailParams} onBack={() => setDetailParams(null)} />
      ) : (
        <HomeScreen onNavigate={setDetailParams} />
      )}
    </NetworkLogger>
  );
}
