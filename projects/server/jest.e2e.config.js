/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'tests/**/*.ts',
    '!tests/**/*.d.ts',
    '!tests/**/*.spec.ts',
    '!tests/**/*.test.ts'
  ],
  coverageDirectory: 'coverage-e2e',
  coverageReporters: ['text', 'lcov'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  }
}; 