# Dependency modernization

The dependency modernization is intentionally split into small, independently validated stages.

## Completed stages

1. Compatible dependency updates within the existing Vue 2 and Vuetify 2 architecture.
2. Vue 2.7 bridge migration using the native Composition API.
3. ESLint flat-config migration with typescript-eslint 8, eslint-plugin-vue 10 and Prettier 3.
4. ESLint 10 and eslint-webpack-plugin 6 upgrade.
5. TypeScript 6, current browser type definitions and compatible Webpack tooling majors.
6. Vue 3, Vue Router 5 and Vuetify 4 framework migration.

The Vue 2.7 bridge removes `@vue/composition-api` and `vue-template-compiler`, updates all Composition API imports to use `vue`, and configures the Vue compiler target explicitly.

The lint modernization removes the legacy `.eslintrc.js` and `.eslintignore` files, moves the existing lint scope and exceptions into `eslint.config.mjs`, and keeps Webpack linting aligned with the standalone ESLint command.

The ESLint 10 stage validates the final flat-config-only toolchain before the remaining compiler and framework migrations.

The compiler stage updates TypeScript and the browser API definitions, replaces deprecated TypeScript module-resolution settings, upgrades compatible Webpack loaders and plugins, and replaces `url-loader` with built-in asset modules.

The framework stage migrates application startup to `createApp`, adopts the current router API, updates the Vue compiler and loader integration, moves themes and SVG icons to `createVuetify`, and replaces removed Vuetify 2 template structures.

The popup now contains three independent control areas:

1. A global Pi-hole switch that enables or disables blocking for every configured Pi-hole until it is changed manually.
2. A client-group control with a remembered group selector, a manual blocking switch and three independently configurable timed pause buttons. A group pause does not disable or alter the group itself. It creates a dedicated allow-all regex rule assigned only to that group, records the previous rule state per configured Pi-hole and removes or restores the rule when blocking resumes or the timer expires. The three durations use `group_pause_times`.
3. A domain card with permanent whitelist and blacklist actions that assign the rule to every client group on each configured Pi-hole. Its three temporary whitelist buttons use the same client group selected in the client-group control above. Each temporary action creates a dedicated regex whitelist rule assigned only to that selected group and removes it when the timer expires. The three durations use `temporary_allow_times` and remain independent from the group-pause presets.

Pi-hole connection fields are saved only through the explicit Save action. Add PiHole creates another unsaved connection tab and no longer acts as an implicit save operation.

## Release candidate validation

Release candidate `v4.2.0-rc.6` validates the final action scope: permanent domain rules apply to all client groups, while temporary domain whitelist timers apply only to the currently selected client group.

## Remaining release work

1. Complete a manual popup and options-page smoke test in Firefox and Chromium.
2. Add focused automated tests before the next public release.

Each stage must pass dependency installation, ESLint, Prettier, Firefox and Chrome production builds, and CodeQL before it is merged.
