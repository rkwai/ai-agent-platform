module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../$1'
  },
  setupFilesAfterEnv: [
    '<rootDir>/../setupTests.ts'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true
    }]
  },
  testMatch: [
    '<rootDir>/**/__tests__/**/*.(test|spec).(ts|tsx)'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleDirectories: ['node_modules', 'src'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
}; 