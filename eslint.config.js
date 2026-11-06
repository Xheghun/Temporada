const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'coverage/**', '.expo/**', '.agents/**'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'VariableDeclarator > Identifier.id[name=/^(tx|db|deps|req|res|fn|cb)$/]',
          message:
            'Use a descriptive name such as transaction, database, dependencies, request, response or callback.',
        },
        {
          selector:
            ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) > Identifier.params[name=/^(tx|db|deps|req|res|fn|cb)$/]',
          message:
            'Name parameters for their purpose instead of using opaque abbreviations.',
        },
      ],
    },
  },
]);
