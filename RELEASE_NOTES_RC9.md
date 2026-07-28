## PiHole Browser Extension 4.2.0 RC9

This prerelease replaces RC1 through RC8 and is intended for manual browser testing.

### Shared client-group selection

- Move the client-group selector directly below the permanent Whitelist and Blacklist buttons.
- Remove the redundant selected-client-group text.
- Use the same selected group for temporary domain Whitelisting and group pause actions.
- Add a default client-group selector to the settings page.
- Add an option directly below it to hide the selector in the popup while retaining the stored group.

### Extension icon badge

- Restore the global Pi-hole status badge as `On`, `Off` or `Err`.
- Show a red tab-specific `On!` badge when the active domain is blocked.
- Restore the normal global status when the domain is allowed or the tab has no valid HTTP/HTTPS domain.
- Keep Chromium Manifest V3 `action` and Firefox Manifest V2 `browserAction` compatibility.

### Existing functionality retained

- Compact popup layout and domain status display.
- Permanent Whitelist and Blacklist actions.
- Three temporary Whitelist presets.
- Manual and timed group pause controls.
- Explicit connection Save action.

### Firefox note

The XPI is not signed by Mozilla. Load it temporarily through `about:debugging`, or use Firefox Developer Edition with unsigned extensions enabled.
