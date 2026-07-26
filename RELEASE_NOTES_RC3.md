## PiHole Browser Extension 4.2.0 RC3

This prerelease replaces RC1 and RC2 and is intended for manual browser testing.

### Corrected pause model

- The pause control selects a client group by default.
- The entire Pi-hole installation is an explicit alternative in the same target selector.
- The existing pause duration applies to both targets.
- A duration of `0` pauses until blocking is manually resumed.
- The UI describes the action as pausing blocking rather than disabling a group.
- The last selected pause target is remembered.

### Corrected domain actions

- Restore a clearly labelled permanent allow button.
- Add three direct temporary allow buttons using the configurable domain presets.
- Restore a clearly labelled permanent block button.
- Domain preset durations are no longer reused by the Pi-hole pause control.

### Framework modernization

- Vue 3.5
- Vue Router 5
- Vuetify 4.1
- TypeScript 6
- ESLint 10 and Prettier 3

### Firefox note

The XPI is not signed by Mozilla. Load it temporarily through `about:debugging`, or use Firefox Developer Edition with unsigned extensions enabled.
