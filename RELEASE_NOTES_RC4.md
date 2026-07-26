## PiHole Browser Extension 4.2.0 RC4

This prerelease replaces RC1, RC2 and RC3 and is intended for manual browser testing.

### True client-group pause

- Select a client group as the default Pi-hole pause target.
- Select the entire Pi-hole installation only when explicitly requested.
- Keep the selected group and all of its normal configuration enabled.
- Pause filtering for clients in that group with a dedicated group-scoped allow-all regex rule.
- Restore the previous rule state automatically when the timer expires.
- Support an indefinite pause with a duration of `0` and manual resume.
- Remember the last selected pause target.
- Preserve timers across background or browser restarts.

### Domain actions

- Show a clearly labelled permanent allow button.
- Show three direct temporary allow buttons using the configurable domain presets.
- Show a clearly labelled permanent block button.
- Keep domain preset durations separate from the Pi-hole pause duration.

### Framework modernization

- Vue 3.5
- Vue Router 5
- Vuetify 4.1
- TypeScript 6
- ESLint 10 and Prettier 3

### Firefox note

The XPI is not signed by Mozilla. Load it temporarily through `about:debugging`, or use Firefox Developer Edition with unsigned extensions enabled.
