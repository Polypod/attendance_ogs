module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/types/**',
    '!src/**/__mocks__/**',
    '!src/**/__tests__/**'
  ],
  // Coverage thresholds are intentionally ratcheted upward over time.
  coverageThreshold: {
    global: {
      branches: 48,
      functions: 74,
      lines: 58,
      statements: 58
    }
  },
  projects: [
    {
      displayName: 'backend',
      preset: 'ts-jest',
      transform: {
        '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }]
      },
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
      },
      setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts']
    },
    {
      displayName: 'frontend',
      preset: 'ts-jest',
      transform: {
        '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/frontend/tsconfig.jest.json' }]
      },
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/frontend/src'],
      testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/frontend/src/$1'
      },
      setupFilesAfterEnv: ['<rootDir>/frontend/src/test/setup.ts']
    }
  ]
};
