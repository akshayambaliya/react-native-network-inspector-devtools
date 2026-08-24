---
description: "TypeScript and React Native component conventions for this library's source. Use when writing or editing components, hooks, context, reducers, or utils under src/."
applyTo: "src/**/*.ts,src/**/*.tsx"
---

# Source conventions (`src/**`)

- Public API is defined entirely by [src/index.ts](../../src/index.ts). Any new component, hook, function, or type meant for consumers **must** be re-exported there — nothing outside `src/index.ts`'s export list is part of the public API, regardless of what a file exports internally.
- `tsconfig.json` is strict (`strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`). Code must satisfy these with no compiler-option workarounds or `@ts-ignore`.
- Components are plain function components using only React Native core APIs (`StyleSheet.create`, `Animated`, `PanResponder`, `Modal`, `TouchableOpacity`, etc.) — do not introduce third-party UI/animation libraries. The library advertises "zero non-peer dependencies"; new runtime deps beyond `react`, `react-native`, `axios`, `@react-native-async-storage/async-storage` require explicit justification.
- Document exported types, props, and non-obvious functions with TSDoc, matching the depth in [src/types.ts](../../src/types.ts) (prose description + `@example` for shapes that aren't self-evident) and [src/components/NetworkLoggerFAB.tsx](../../src/components/NetworkLoggerFAB.tsx) (per-prop doc comments on the `Props` interface).
- State lives in a single reducer ([src/context/reducer.ts](../../src/context/reducer.ts)) driven through `NetworkLoggerContext`. Don't introduce a second state mechanism (e.g. a new context, Zustand, Redux) — add actions/cases to the existing reducer.
- Mock and blacklist URL matching (`contains`/`exact`/`regex`, priority `exact > regex > contains`, longer pattern wins, user mocks beat presets) is centralized in [src/utils/mockMatcher.ts](../../src/utils/mockMatcher.ts) and [src/utils/blacklistMatcher.ts](../../src/utils/blacklistMatcher.ts). Reuse these instead of writing new ad-hoc URL-matching logic.
- Persisted mock state uses the AsyncStorage key `react-native-network-inspector-devtools:mocks` (see `NetworkLoggerContext.tsx`). Don't change this key without a migration path — it would silently drop existing users' saved mocks.
- After adding or changing a public export, check whether [README.md](../../README.md)'s "API Reference" / "Configuration" sections need updating — several existing exports (sub-views, low-level interceptor installers, blacklist utils, theme) are already undocumented there; don't add to that gap.
