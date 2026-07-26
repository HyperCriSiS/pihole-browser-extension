# Dependency modernization

The dependency modernization is intentionally split into small, independently validated stages.

## Completed stages

1. Compatible dependency updates within the existing Vue 2 and Vuetify 2 architecture.
2. Vue 2.7 bridge migration using the native Composition API.
3. ESLint flat-config migration with typescript-eslint 8, eslint-plugin-vue 10 and Prettier 3.
4. ESLint 10 and eslint-webpack-plugin 6 upgrade.
5. TypeScript 6, current browser type definitions and compatible Webpack tooling majors.

The Vue 2.7 bridge removes `@vue/composition-api` and `vue-template-compiler`, updates all Composition API imports to use `vue`, and configures the Vue compiler target explicitly.

The lint modernization removes the legacy `.eslintrc.js` and `.eslintignore` files, moves the existing lint scope and exceptions into `eslint.config.mjs`, and keeps Webpack linting aligned with the standalone ESLint command.

The ESLint 10 stage validates the final flat-config-only toolchain before the remaining compiler and framework migrations.

The compiler stage updates TypeScript and the browser API definitions, replaces deprecated TypeScript module-resolution settings, upgrades compatible Webpack loaders and plugins, and replaces `url-loader` with built-in asset modules.

## Planned stages

1. Migrate the application bootstrap and components to Vue 3.
2. Migrate Vuetify 2 components and themes to a supported Vuetify version.
3. Add focused automated tests before the next public release.

Each stage must pass dependency installation, ESLint, Prettier, Firefox and Chrome production builds, and CodeQL before it is merged.
