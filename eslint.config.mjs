import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'artifacts/**',
      'dist/**',
      '_locales/**',
      'node_modules/**',
      '.github/**',
      'icon/**',
      'icon_raw/**',
      'src/webpack/**',
      'package.*.zip',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'class-methods-use-this': 'off',
      'no-restricted-syntax': ['off', 'ForOfStatement'],
      'prefer-promise-reject-errors': 'off',
      'no-plusplus': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    files: ['*.js', '*.mjs', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: [
      'src/module/popup/vue/components/PopupListCardComponent.vue',
      'src/module/popup/vue/components/PopupStatusCardComponent.vue',
    ],
    rules: {
      'prefer-destructuring': 'off',
    },
  },
  {
    files: ['src/service/PiHoleApiService.ts'],
    rules: {
      'consistent-return': 'off',
    },
  },
  {
    files: ['src/service/TemporaryActionService.ts'],
    rules: {
      'no-await-in-loop': 'off',
      'no-continue': 'off',
    },
  },
  eslintConfigPrettier,
)
