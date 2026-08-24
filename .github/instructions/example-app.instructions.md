---
description: "Conventions for the example/ Expo demo app that exercises this library locally. Use when editing files under example/ or wiring up new demo screens."
applyTo: "example/**"
---

# Example app conventions (`example/**`)

- `example/` is an Expo (SDK 52 / RN 0.76) app whose only purpose is manually exercising the library during development — it is not published and has its own `package.json`/`tsconfig.json`.
- It depends on the library via `"react-native-network-inspector-devtools": "file:../"` in [example/package.json](../../example/package.json). This resolves to the **built** `lib/` output, not `src/` directly — after changing anything under the repo root `src/`, run `npm run build` at the repo root before the change is visible in `example/`. A Metro/Expo restart (`npm start -- --clear`) may also be needed since `file:` deps can be cached.
- `example/src/api/` contains the axios client(s) and mock endpoint fixtures used to demonstrate `instance`/`instances` and `initialMocks`; `example/src/screens/` contains the demo UI. Follow existing patterns there rather than adding new demo infra.
- When adding a new public export to the library, add or update a small usage example under `example/` (mirroring the corresponding README usage example) so the feature is manually verifiable — this repo has no automated tests, so the example app is the only executable verification available.
- Do not add native modules or eject from Expo managed workflow here; the example app's `ios/` folder is Expo-generated and not meant for manual native edits.
