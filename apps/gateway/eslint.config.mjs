import base from '../../eslint.config.mjs';

export default [
  ...base,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      'no-empty': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
    },
  },
];
