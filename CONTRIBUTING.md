# Contributing

## Requirements

- Node.js 22 to 24
- npm with support for lockfile version 3

Use the committed lockfile for every clean installation:

```bash
npm ci --prefer-offline --no-audit --no-fund
```

Do not use `npm install` for normal development or CI. Use `npm run rebuild-package-lock` only when dependency declarations intentionally change, and commit the resulting `package-lock.json` together with `package.json`.

## Validation

Run the complete merge-relevant validation locally:

```bash
npm run check
```

This includes TypeScript checking, ESLint, Prettier, the complete Node test suite, Firefox and Chrome production builds, Mozilla `web-ext lint`, icon/reference validation and archive-content validation.

To prepare locally named packages and checksums after a successful build:

```bash
npm run package:artifacts
```

Generated directories and browser packages must not be committed.

## Pull requests

- Keep code, workflows, commit messages and pull-request text in English.
- Keep functional changes separate from CI, dependency or formatting-only changes.
- Update or add tests when behavior changes.
- Do not commit secrets, Pi-hole credentials, local configuration, generated archives or build output.
- Ensure `npm run check` succeeds before requesting review.

## Releases

A stable release tag must exactly match the version in `package.json` and both browser manifests, for example `v4.2.0`. A release-candidate tag uses the same base version plus a prerelease suffix, for example `v4.2.0-rc.11`. The release workflow validates and packages the tagged commit, marks prerelease tags automatically and refuses to replace an existing release.
