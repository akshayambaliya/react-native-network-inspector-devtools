---
name: bump-and-publish
description: 'Manual version bump and npm publish steps for react-native-network-inspector-devtools (no CI/changesets in this repo). Use when asked to release, publish, or cut a new version of this library.'
---

# Bump and publish

## When to use
The user wants to release a new version of `react-native-network-inspector-devtools` to npm. There is no CI pipeline and no changesets/semantic-release tooling — this is a fully manual process.

## Procedure

1. **Confirm a clean working tree** on the branch you intend to release from (`git status`).

2. **Bump the version** in [package.json](../../../package.json) (`version` field), following semver based on the nature of the changes (patch for fixes, minor for new backwards-compatible exports, major for breaking API changes to anything exported from `src/index.ts`).

3. **Build the package**:
   ```bash
   npm install
   npm run build         # bob build -> lib/commonjs, lib/module, lib/typescript
   npm run check-types   # tsc --noEmit
   ```
   Confirm both exit cleanly. `npm run lint` is currently broken in this repo (no ESLint config) — don't treat it as a release gate.

4. **Sanity-check the `lib/` output** was regenerated (check `lib/commonjs/index.js`, `lib/module/index.js`, `lib/typescript/src/index.d.ts` timestamps/content) — `prepare` also runs `bob build` automatically on `npm install`/`npm publish`, but verify manually since there's no CI safety net.

5. **Update README.md** if the release adds/changes public API — cross-check `src/index.ts` exports against the "API Reference" section (see the `add-new-component-or-hook` skill). Do this before publishing, not after.

6. **Commit the version bump** (e.g. `chore(release): vX.Y.Z`) including any README changes.

7. **Publish**:
   ```bash
   npm publish
   ```
   This triggers the `prepare` script (`bob build`) again before publish. `files` in package.json (`src`, `lib`, `LICENSE`) controls what ships to npm — don't add new top-level source directories without updating this whitelist.

8. **Tag and push**:
   ```bash
   git tag vX.Y.Z
   git push && git push --tags
   ```
   Confirm with the user before pushing tags/commits if this is a shared branch — pushing is not auto-approved.

9. Optionally create a GitHub release from the tag summarizing the changes (no automation does this for you).
