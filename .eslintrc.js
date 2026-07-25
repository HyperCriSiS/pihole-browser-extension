module.exports = {
    root: true,
    env: {
        browser: true,
        webextensions: true,
        es6: true,
    },
    "parser": "vue-eslint-parser",
    "parserOptions": {
        parser: '@typescript-eslint/parser',
        project: ['tsconfig.json'],
        tsconfigRootDir: __dirname,
        extraFileExtensions: ['.vue'],
    },
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'airbnb-typescript/base',
        'plugin:vue/recommended',
        'prettier'
    ],
    overrides: [
        {
            files: ['src/module/popup/vue/components/PopupListCardComponent.vue'],
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
    ],
    "rules": {
        "import/no-extraneous-dependencies": "off",
        "class-methods-use-this": "off",
        "no-restricted-syntax": ["off", "ForOfStatement"],
        "prefer-promise-reject-errors": "off",
        "no-plusplus": "off",
        "no-console": "off"
    }
};
