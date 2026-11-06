module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.[jt]s?(x)'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
};
