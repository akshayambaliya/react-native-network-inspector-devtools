---
name: add-new-component-or-hook
description: 'Steps to add a new public component, hook, or utility to react-native-network-inspector-devtools end-to-end: implementation, types, index export, README documentation, example app usage. Use when asked to add a new export, feature, or public API surface to this library.'
---

# Add a new component / hook / utility

## When to use
The user wants to add a new component, hook, context value, or utility function that should be part of the library's public npm API (not a purely internal helper).

## Procedure

1. **Implement** the code under the appropriate `src/` subfolder:
   - `src/components/` for React components
   - `src/context/` for context/reducer/hook additions
   - `src/utils/` for pure functions (matching logic, interceptors, etc.)
   - `src/types.ts` for new shared types/interfaces
   Follow [source-conventions.instructions.md](../../instructions/source-conventions.instructions.md): function components, RN-core-only APIs, TSDoc on exported types/props, strict TypeScript (no `@ts-ignore`).

2. **Export it** from [src/index.ts](../../../src/index.ts) — this file is the sole definition of the public API. Add both the value export and any associated `type` export, grouped with similar exports (components together, types together at the bottom).

3. **If it touches state**, add action(s) to the existing reducer in [src/context/reducer.ts](../../../src/context/reducer.ts) rather than introducing new state machinery. If it needs persistence, be deliberate about the `react-native-network-inspector-devtools:mocks` AsyncStorage key — don't reuse it for unrelated data.

4. **Document it in [README.md](../../../README.md)**:
   - Add a row/section under "API Reference" (mirroring the existing entries for `<NetworkLogger>`, `<NetworkLoggerFAB>`, etc.)
   - Add a Props/Options table if it takes configuration, matching the style of the `<NetworkLogger> Props` table.
   - Add a short usage example under "Usage Examples" if the feature needs more than a one-liner to demonstrate.
   - Update the Table of Contents if you added a new heading.

5. **Wire up a usage example in `example/`** (see [example-app.instructions.md](../../instructions/example-app.instructions.md)) so the feature is manually verifiable through the demo app — there is no automated test suite in this repo, so this is the only executable verification step.

6. **Build and typecheck** before considering the change done:
   ```bash
   npm run build         # bob build -> lib/commonjs, lib/module, lib/typescript
   npm run check-types   # tsc --noEmit
   ```
   Do not run `npm run lint` as a gate — it is currently broken (no ESLint config/devDependency in this repo); don't try to fix it as part of an unrelated feature.

7. **Restart Metro in `example/`** if you want to manually verify: `file:../` dependencies resolve to the built `lib/` output, so a stale build or cached Metro bundle can hide your change (`npm start -- --clear` inside `example/`).
