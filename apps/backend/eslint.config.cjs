const typescriptEslintPlugin = require("@typescript-eslint/eslint-plugin");
const typescriptEslintParser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-this-alias": "warn",
    },
  },
];
