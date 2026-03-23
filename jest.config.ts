import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  // Allow ts-jest to transform jose (ESM package)
  transformIgnorePatterns: [
    '/node_modules/(?!jose/)',
  ],
  // Ignore Next.js build output
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
};

export default config;
