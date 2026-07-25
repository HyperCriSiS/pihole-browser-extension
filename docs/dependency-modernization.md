# Dependency modernization

The dependency modernization is intentionally split into small, independently validated stages.

## Completed stages

1. Compatible dependency updates within the existing Vue 2 and Vuetify 2 architecture.
2. Vue 2.7 bridge migration using the native Composition API.

The Vue 2.7 bridge removes `@vue/composition-api` and `vue-template-compiler`, updates all Composition API imports to use `vue`, and configures the Vue compiler target explicitly.

## Planned stages

1. Migrate the application bootstrap and components to Vue 3.
2. Migrate Vuetify 2 components and themes to a supported Vuetify version.
3. Modernize TypeScript, ESLint and the remaining build-tool major versions.
4. Add focused automated tests before the next public release.

Each stage must pass dependency installation, ESLint, Prettier, Firefox and Chrome production builds, and CodeQL before it is merged.
