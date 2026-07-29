## PiHole Browser Extension 4.2.0 RC8

This prerelease replaces RC1 through RC7 and is intended for real-browser testing.

### Compact popup redesign

- Single compact panel without nested cards or excessive spacing.
- Header with Pi-hole control title and settings shortcut.
- Compact global Pi-hole switch.
- Current domain display with visible Blocked, Not blocked, or Unknown status.
- Equal-width green Whitelist and red Blacklist buttons with short labels.
- Three temporary Whitelist buttons for the selected client group.
- Compact client-group selector, manual switch, and three timed pause buttons.

### Blocked-domain badge

- Uses Pi-hole's domain search API and rule precedence for the selected client group.
- Shows a red tab-specific `!` badge while the active domain is blocked.
- Clears the badge when the domain is allowed, global blocking is disabled, or the tab has no valid HTTP/HTTPS domain.
- Uses Chromium Manifest V3 `action` and Firefox Manifest V2 `browserAction` APIs.

### Validation

- Domain rule precedence tests passed.
- ESLint and Prettier passed.
- Firefox and Chromium production builds passed.
- CodeQL passed on the source branch.

The Firefox XPI is unsigned and must be loaded temporarily through `about:debugging`.
