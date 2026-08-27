module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  rootDir: ".",
  modulePaths: ["<rootDir>/src"],
  moduleNameMapper: {
    "^nanoid/non-secure$": "<rootDir>/src/test-support/nanoid-non-secure.cjs",
    "^ipaddr\\.js$": "ipaddr.js",
    "^(.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        useESM: true,
      },
    ],
  },
  // Use testRegex rather than testMatch: Jest resolves <rootDir> globs through
  // jest-util's replacePathSepForGlob, which leaves a literal backslash before
  // any path segment starting with a regex-special character (e.g. a
  // dot-prefixed directory like ".claude") unconverted on Windows, silently
  // matching zero test files. testRegex is matched directly against absolute
  // paths and isn't subject to that conversion.
  testRegex: "[\\\\/]src[\\\\/].*\\.(spec|test)\\.ts$",
  collectCoverageFrom: ["<rootDir>/src/**/*.ts", "!<rootDir>/src/main.ts"],
  coverageReporters: ["text", "lcov"],
  coverageThreshold: {
    global: {
      branches: 23,
      functions: 38,
      lines: 44,
      statements: 44,
    },
  },
};
