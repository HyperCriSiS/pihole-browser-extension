# PiHole Browser Extension ![Icon](https://github.com/HyperCriSiS/pihole-browser-extension/blob/master/icon/icon-48.png?raw=true)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ngoafjpapneaopfkpboebcahajopcifi)](https://chrome.google.com/webstore/detail/switch-for-pihole/ngoafjpapneaopfkpboebcahajopcifi)
[![Mozilla Add-on](https://img.shields.io/amo/v/pihole-browser-extension)](https://addons.mozilla.org/firefox/addon/pihole-browser-extension/)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/users/ngoafjpapneaopfkpboebcahajopcifi?label=chrome%20users)](https://chrome.google.com/webstore/detail/switch-for-pihole/ngoafjpapneaopfkpboebcahajopcifi)
[![Mozilla Add-on](https://img.shields.io/amo/users/pihole-browser-extension?color=green&label=mozilla%20users)](https://addons.mozilla.org/firefox/addon/pihole-browser-extension/)
![GitHub](https://img.shields.io/github/license/HyperCriSiS/pihole-browser-extension)

The PiHole Browser Extension is a small browser extension for Chrome and Firefox. It is written with Vue and TypeScript and supports Pi-hole v6 and later.

## Features

- Enable or disable configured Pi-hole instances
- Configure multiple Pi-hole instances
- Whitelist or blacklist the current domain
- Use keyboard shortcuts and context-menu actions
- Check Pi-hole connections from the settings page
- Control Pi-hole client groups

## Usage

1. Open the popup by selecting the extension icon in the browser toolbar.
2. Open the settings page using the cog button.
3. Enter the Pi-hole address, including `http://` or `https://` and any required path.
4. Enter the Pi-hole password and save the connection.

## Development

Node.js 22 to 24 and npm are supported. The committed `package-lock.json` is the source of truth for dependency installation.

```bash
npm ci --prefer-offline --no-audit --no-fund
npm run check
```

Common commands:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run build:firefox
npm run build:chrome
npm run package:artifacts
```

`npm run check` performs the same source, test, browser-build, Firefox-lint and package-structure checks used by CI. Production builds are written to `dist/`; validated ZIP/XPI files and SHA-256 checksums are written to `artifacts/` by `npm run package:artifacts`.

## Releases

Stable releases use a tag matching the exact version in `package.json`, `manifest.firefox.json` and `manifest.chrome.json`, for example `v4.2.0`. Release candidates append a prerelease suffix to the same base version, for example `v4.2.0-rc.11`.

The release workflow performs the complete validation suite from a fresh checkout, creates separately named Firefox and Chrome packages, adds a source archive containing `SOURCE_COMMIT.txt`, generates SHA-256 checksums and refuses to overwrite an existing GitHub release. Tags containing a prerelease suffix are automatically published as prereleases.

## Troubleshooting

### Error after selecting the Pi-hole switch

This usually indicates an incorrect Pi-hole password or connection configuration. Check the saved address and password for whitespace and verify the connection from the settings page.

### Whitelisting or blacklisting domains

The extension can add the current domain to Pi-hole lists. This functionality requires a compatible Pi-hole version and a valid connection.

## Disclaimer

This is not an official Pi-hole application. Report extension problems in this repository; the Pi-hole project is not responsible for malfunctions caused by this extension.
