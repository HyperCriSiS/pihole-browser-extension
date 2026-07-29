## PiHole Browser Extension 4.2.0 RC6

This prerelease replaces RC1 through RC5 and is intended for manual browser testing.

### Global Pi-hole control

- A dedicated switch enables or disables blocking globally on every configured Pi-hole.
- The global switch is manual and has no timer.

### Client-group control

- Select one client group and keep that selection for all group-scoped actions.
- A dedicated manual switch pauses or resumes filtering for the selected group.
- Three independently configurable buttons pause filtering for the selected group for a fixed duration.
- The Pi-hole group itself and its normal configuration remain enabled.

### Domain actions

- Permanent Whitelist and Blacklist actions apply to every client group on each configured Pi-hole.
- The three temporary Whitelist buttons apply only to the client group selected above.
- Temporary Whitelist durations are configured independently from group-pause durations.
- Temporary rules are restored automatically after expiry and survive background or browser restarts.

### Connection settings

- Pi-hole addresses and passwords are stored only when the explicit Save button is pressed.
- Add PiHole creates a new unsaved connection tab.

### Framework modernization

- Vue 3.5
- Vue Router 5
- Vuetify 4.1
- TypeScript 6
- ESLint 10 and Prettier 3

### Firefox note

The XPI is not signed by Mozilla. Load it temporarily through `about:debugging`, or use Firefox Developer Edition with unsigned extensions enabled.
