<p align="center">
  <img src="icon_raw/icon-raw.png" alt="Wormhole Connector logo" width="240">
</p>

<h1 align="center">Wormhole Connector</h1>

<p align="center">
  <a href="https://github.com/HyperCriSiS/pihole-browser-extension/releases"><img src="https://img.shields.io/github/v/release/HyperCriSiS/pihole-browser-extension?include_prereleases&amp;sort=semver" alt="Latest release"></a>
  <a href="https://github.com/HyperCriSiS/pihole-browser-extension/actions/workflows/lint.yml"><img src="https://github.com/HyperCriSiS/pihole-browser-extension/actions/workflows/lint.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/HyperCriSiS/pihole-browser-extension" alt="MIT license"></a>
</p>

Control one or more Pi-hole instances directly from Firefox or a Chromium-based browser without opening the Pi-hole administration interface. Wormhole Connector targets **Pi-hole v6 and later** and provides global, domain-specific and client-group-specific controls.

Wormhole Connector is part of **The Wormhole Suite — Domains demystified**.

## Further development of the original project

This project is an actively maintained continuation of the original [Pi-hole Browser Extension by Pascal Glaser](https://github.com/badsgahhl/pihole-browser-extension).

The original project is now in maintenance mode. Since I use the extension extensively myself, I have modernized the codebase, added numerous features and continue development in this repository.

## Features

### Pi-hole and domain controls

- Enable or disable filtering on the configured Pi-hole instances.
- See whether the current domain is blocked globally.
- Add the current domain to the global whitelist or blacklist.
- Configure one or more Pi-hole connections, including installations behind a reverse-proxy path.
- Optionally reload the current tab after disabling filtering or whitelisting a domain.

### Client-group actions

- Select a Pi-hole client group directly in the popup.
- See whether the current domain is blocked for the selected group.
- Assign whitelist or blacklist rules specifically to the selected group.
- Temporarily whitelist the current domain for configurable durations.
- Enable, disable or temporarily pause filtering for the selected group.
- Use the selected group's domain status for the toolbar badge.

### Reliable multi-instance changes

- Check every configured Pi-hole before a shared mutation starts.
- Serialize conflicting actions across popup, options and background contexts.
- Apply changes in a defined order and roll back already changed instances if a later target fails.
- Retain a recovery record when an automatic rollback cannot be completed.
- Treat differing instance states as mixed instead of presenting a misleading unified state.

### Backup and synchronization

- Export settings as a versioned JSON file.
- Exclude Pi-hole passwords from exports by default.
- Validate and preview imports before applying them.
- Preserve locally stored passwords when importing a credential-free backup.
- Optionally synchronize safe preferences through the browser account. Passwords and session IDs are never synchronized.

### Customization and shortcuts

- Keep the extension logo recognizable and show active, blocked, temporarily allowed, disabled and error/unknown states through a native, color-coded toolbar badge.
- Configure the three presets used for temporary domain whitelisting and group pauses.
- Hide the client-group selector or individual action sections from the popup.
- Use keyboard shortcuts and browser context-menu actions.
- Check saved Pi-hole connections from the settings page.
- Follow the browser's light or dark appearance.

### Toolbar status

The toolbar keeps the large, shield-free main logo visible and uses the browser's native badge for status information:

| Badge | Meaning |
| --- | --- |
| Green `✓` | Pi-hole is active and the current domain is allowed |
| Red `×` | The current domain is blocked |
| Orange time, for example `5m` | The current domain is temporarily allowed |
| Blue-grey `OFF` | Pi-hole filtering is disabled |
| Yellow `!` | The current status is unavailable, mixed across instances or an error occurred |

## Requirements

- Pi-hole v6 or later.
- Firefox 140 or later, or a current Chromium-based browser.
- Network access from the browser to the configured Pi-hole address.
- A valid Pi-hole web-interface password when authentication is enabled.

## Installation

Download the package for your browser from the [GitHub Releases](https://github.com/HyperCriSiS/pihole-browser-extension/releases) page.

### Chromium-based browsers

1. Download and extract the `chrome.zip` package.
2. Open the browser's extensions page, for example `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the extracted directory.

### Firefox

The release currently contains an unsigned Firefox package for testing. In Firefox, open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on** and choose the downloaded XPI file. Temporary add-ons are removed when Firefox closes. A permanent installation in standard Firefox requires a Mozilla-signed package.

## Setup

1. Open the extension popup and select the cog button.
2. Enter the complete Pi-hole address, including `http://` or `https://` and any required reverse-proxy path.
3. Enter the Pi-hole web-interface password exactly as configured. Whitespace is preserved.
4. Save the connection and verify it with the connection check.
5. Optionally select a default client group and customize the popup, toolbar badge and timer presets.

## Updates and stored settings

Updates use incremental storage migrations. Existing connections, passwords and preferences are preserved; the extension does not wipe all stored data when its internal storage format changes. Obsolete persistent session tokens from older versions are removed automatically.

Pi-hole session IDs are kept only in browser session storage and are scoped to the complete API endpoint, including a reverse-proxy path. Concurrent requests share a single authentication attempt. Wormhole Connector tries to close active Pi-hole sessions before saved connection settings are replaced.

## Privacy and permissions

Pi-hole addresses, passwords and extension preferences are stored in the browser's local extension storage. Passwords are never placed in browser synchronization storage. Safe synchronization is disabled by default and must be enabled explicitly.

The extension requires access to HTTP and HTTPS addresses so it can communicate with user-configured Pi-hole instances, including devices hosted on local network addresses. Access to the active tab is used to identify the current domain for status checks and list actions. Context-menu and alarm permissions support the corresponding shortcuts and temporary actions.

To perform its core functions, the extension sends the configured authentication information and the current domain only to the Pi-hole addresses you provide. It does not send this information to the developers, analytics services or unrelated third parties. The inherited Google uninstall survey has been removed. See the complete [privacy policy](PRIVACY).

## Troubleshooting

### A switch or action reports an error

Check the complete saved Pi-hole address, including any reverse-proxy path, and verify that the password matches the Pi-hole configuration exactly. Then run the connection check from the settings page. The browser must be able to reach the Pi-hole address directly.

### Domain status is unknown

A status can only be determined when the current page has a usable domain, the Pi-hole connection succeeds and the required lists or group assignments can be read. Internal browser pages do not expose a normal web domain. With multiple Pi-hole instances, the unknown badge can also indicate differing instance states.

### A multi-instance action failed

Wormhole Connector checks all configured targets before changing them. If a later target fails, already changed instances are restored where possible. Check every Pi-hole connection individually before retrying. An incomplete rollback is retained as a recovery record instead of being hidden.

### Group actions are unavailable

Save and verify a working Pi-hole v6 connection first. The selected client group must exist on every Pi-hole instance involved in the action.

## Development

The project uses Vue, TypeScript, Vuetify, Webpack and npm. Node.js versions 22 through 24 are supported.

```bash
npm ci --prefer-offline --no-audit --no-fund
npm run check
```

`npm run check` performs the complete TypeScript, lint, formatting, test and browser-build validation used by CI. See [CONTRIBUTING.md](CONTRIBUTING.md) for development details.

## Contributors

- [Pascal Glaser](https://github.com/badsgahhl)
- [Erik Rill](https://github.com/erikr729)
- [HyperCriSiS](https://github.com/HyperCriSiS)

## License

This project is available under the [MIT License](LICENSE).

## Disclaimer

Wormhole Connector is not an official Pi-hole application. Report extension problems in this repository; the Pi-hole project is not responsible for malfunctions caused by this extension.
