import React, { useEffect, useState } from "react";
import {
  jsonPlaceholderClient,
  pokeClient,
  countriesClient,
} from "./src/api/clients";
import { DEMO_PRESETS } from "./src/mocks/presets";
import { HomeScreen } from "./src/screens/HomeScreen";
import { DetailsScreen, DetailScreenParams } from "./src/screens/DetailsScreen";
import { NetworkLogger } from "react-native-network-inspector-devtools";

/**
 * Demo App — react-native-network-inspector-devtools
 *
 * Wraps the entire app in <NetworkLogger> which:
 *  - Installs interceptors on all three axios instances
 *  - Loads preset mocks (with multiple variants) at startup
 *  - Renders the draggable FAB + slide-up panel
 */
export default function App() {
  const [detailParams, setDetailParams] = useState<DetailScreenParams | null>(
    null,
  );

  useEffect(() => {
    console.log("[Example] Network logger demo mounted", {
      screen: "Home",
      presetsLoaded: DEMO_PRESETS.length,
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
  }, []);

  return (
    <NetworkLogger
      // Intercept all three axios clients
      instances={[jsonPlaceholderClient, pokeClient, countriesClient]}
      // Pre-load mocks so the Presets tab is ready to use straight away
      initialMocks={DEMO_PRESETS}
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
