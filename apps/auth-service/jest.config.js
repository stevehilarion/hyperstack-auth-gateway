/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['@swc/jest', {
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true },
      },
      module: { type: 'commonjs' },
      sourceMaps: 'inline',
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  watchPathIgnorePatterns: ['<rootDir>/dist/'],
};
