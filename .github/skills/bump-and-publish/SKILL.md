---
name: bump-and-publish
description: 'Manual version bump and npm publish steps for react-native-network-inspector-devtools (no CI/changesets in this repo). Use when asked to release, publish, or cut a new version of this library.'
---

# Bump and publish

## When to use
The user wants to release a new version of `react-native-network-inspector-devtools`. There is no CI pipeline and no changesets/semantic-release tooling — this is a fully manual process, but the steps up to (not including) `npm publish` can be run end-to-end without stopping.

## Procedure

1. **Ask for the target version** if not already given (e.g. "what version — patch/minor/major, or an exact X.Y.Z?"). Suggest a bump based on the nature of the changes (patch for fixes, minor for new backwards-compatible exports, major for breaking API changes to anything exported from `src/index.ts`).

2. **Confirm a clean working tree** on the branch you intend to release from (`git status`). If there are uncommitted changes the user hasn't already reviewed, flag it before continuing.

3. **Bump the version** in [package.json](../../../package.json) (`version` field) to the agreed X.Y.Z.

4. **Run required checks ("tests")** — this repo has no Jest/test suite, so the release gate is:
   ```bash
   npm install
   npm run check-types   # tsc --noEmit
   ```
   `npm run lint` is currently broken in this repo (no ESLint config) — don't treat it as a release gate. Do not invent or run tests that don't exist.

5. **Build the package**:
   ```bash
   npm run build         # bob build -> lib/commonjs, lib/module, lib/typescript
   ```
   Sanity-check `lib/commonjs/index.js`, `lib/module/index.js`, `lib/typescript/src/index.d.ts` were regenerated with the latest `src/` content.

6. **Update README.md** if the release adds/changes public API — cross-check `src/index.ts` exports against the "API Reference" section (see the `add-new-component-or-hook` skill).

7. **If everything above is green, commit and push the changes**:
   ```bash
   git add -A
   git commit -m "chore(release): vX.Y.Z"
   git push
   ```

8. **Tag and push the tag**:
   ```bash
   git tag vX.Y.Z
   git push --tags
   ```

9. **Stop and ask the user to publish to npm.** Never run `npm publish` yourself — report that steps 1–8 succeeded and that the package is ready, then ask the user to run `npm publish` (or confirm before you run it). This triggers the `prepare` script (`bob build`) again before publish. `files` in package.json (`src`, `lib`, `LICENSE`) controls what ships to npm — don't add new top-level source directories without updating this whitelist.

10. Optionally create a GitHub release from the tag summarizing the changes (no automation does this for you) — offer this after npm publish is confirmed.
