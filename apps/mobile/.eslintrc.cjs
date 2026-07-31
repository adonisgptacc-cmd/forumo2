module.exports = {
  root: true,
  extends: ["expo"],
  env: {
    es2022: true,
    jest: true,
    node: true,
  },
  rules: {
    "@typescript-eslint/ban-types": "off",
  },
  ignorePatterns: ["android/", "coverage/", "ios/"],
  overrides: [
    {
      files: ["e2e/**/*.ts"],
      globals: {
        by: "readonly",
        device: "readonly",
        element: "readonly",
      },
    },
  ],
};
