module.exports = {
  testEnvironment: 'jsdom', // Simulate browser environment
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'], // For global test setup
  transform: {
    '^.+\\.jsx?$': 'babel-jest', // Transform JS/JSX files using Babel
  },
  moduleNameMapper: {
    // Mock CSS imports (if you use CSS Modules, this might need adjustment)
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Mock image imports or other static assets if needed
    // '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js',
  },
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // Verbose output
  verbose: true,
};
