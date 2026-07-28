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

## Popup controls

The popup uses one compact panel with four clearly separated areas:

1. A header with the settings shortcut.
2. A compact global Pi-hole switch.
3. A current-domain area with a visible blocked/not-blocked status, equal-width Whitelist and Blacklist buttons, and three temporary Whitelist presets for the selected client group.
4. A client-group area with a remembered selector, a manual blocking switch, and three independent timed pause buttons.

Permanent domain actions assign their rules to every current client group on each configured Pi-hole. Temporary domain actions use the selected client group and `temporary_allow_times`. Timed group pauses use `group_pause_times`; both preset sets remain independent.

The current-domain status is evaluated with Pi-hole's domain search API and its documented rule precedence for the selected client group. A red tab-specific `!` badge is shown while the active domain is blocked. The badge is cleared when the domain is allowed, global blocking is disabled, or the active tab has no valid HTTP or HTTPS domain. Chromium uses the Manifest V3 `action` API and Firefox uses the Manifest V2 `browserAction` API through the shared badge wrapper.

Domain rule precedence and multi-Pi-hole state aggregation are covered by `tests/domain-status.test.ts` and can be run with `npm run test:domain-status`.

Pi-hole connection fields are saved only through the explicit Save action. Add PiHole creates another unsaved connection tab and no longer acts as an implicit save operation.

## Remaining release work

1. Complete a manual popup and options-page smoke test in Firefox and Chromium.
2. Publish the next release candidate after the real-browser layout test.

Each stage must pass domain status tests, dependency installation, ESLint, Prettier, Firefox and Chrome production builds, and CodeQL before it is merged.
