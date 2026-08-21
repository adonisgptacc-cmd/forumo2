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
  testMatch: ["<rootDir>/src/**/*.spec.ts", "<rootDir>/src/**/*.test.ts"],
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
