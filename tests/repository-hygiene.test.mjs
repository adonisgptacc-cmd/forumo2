import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const rootUrl = new URL("../", import.meta.url);
const rootPath = fileURLToPath(rootUrl);
const pathExists = (path) => existsSync(new URL(path, rootUrl));
const readJson = (path) =>
  JSON.parse(readFileSync(new URL(path, rootUrl), "utf8"));
const runGit = (args) => {
  const result = spawnSync("git", args, {
    cwd: rootPath,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split(/\r?\n/).filter(Boolean);
};

test("generated build metadata stays ignored", () => {
  const generatedArtifacts = [
    "apps/admin/tsconfig.tsbuildinfo",
    "apps/web/tsconfig.tsbuildinfo",
  ];
  assert.deepEqual(
    runGit(["check-ignore", "--no-index", ...generatedArtifacts]).sort(),
    generatedArtifacts.sort(),
  );

  const trackedArtifacts = runGit(["ls-files", "--", ...generatedArtifacts]);
  const pendingDeletions = new Set(
    runGit([
      "diff",
      "--name-only",
      "--diff-filter=D",
      "--",
      ...generatedArtifacts,
    ]),
  );
  assert.deepEqual(
    trackedArtifacts.filter((path) => !pendingDeletions.has(path)),
    [],
  );

  for (const configPath of [
    "apps/admin/tsconfig.json",
    "apps/web/tsconfig.json",
  ]) {
    const config = readJson(configPath);
    assert.equal(
      config.compilerOptions.tsBuildInfoFile,
      "./.next/cache/tsconfig.tsbuildinfo",
      `${configPath} must write incremental metadata inside its ignored Next.js cache`,
    );
  }
});

test("stale diagnostic artifacts stay out of the source tree", () => {
  const staleArtifacts = [
    "apps/backend/admin_reviews_err.txt",
    "apps/backend/all_tests_err.txt",
    "apps/backend/all_tests_results.txt",
    "apps/backend/auth_test_err.txt",
    "apps/backend/auth_test_err_v2.txt",
    "apps/backend/auth_test_err_v3.txt",
    "apps/backend/messaging_test_err.txt",
    "apps/backend/messaging_test_err_v2.txt",
    "apps/backend/order_test_err.txt",
    "apps/backend/order_test_err_v2.txt",
    "apps/backend/order_test_err_v3.txt",
    "apps/backend/order_test_err_v4.txt",
    "apps/backend/order_test_err_v5.txt",
    "apps/backend/test_results.txt",
    "apps/backend/tsc_output.txt",
    "apps/backend/tsc_output_2.txt",
  ];

  assert.deepEqual(staleArtifacts.filter(pathExists), []);
});

test("the superseded checkout simulator stays removed", () => {
  assert.equal(
    pathExists(
      "apps/web/src/app/(authenticated)/app/checkout/checkout-simulator.tsx",
    ),
    false,
  );
});

test("applications declare only the dependencies they directly use", () => {
  const webDependencies = readJson("apps/web/package.json").dependencies;
  const adminDependencies = readJson("apps/admin/package.json").dependencies;

  for (const dependency of [
    "@auth/prisma-adapter",
    "@base-ui/react",
    "autoprefixer",
    "class-variance-authority",
    "framer-motion",
  ]) {
    assert.equal(webDependencies[dependency], undefined, dependency);
  }

  for (const dependency of [
    "@tanstack/react-query-devtools",
    "tailwind-merge",
  ]) {
    assert.equal(adminDependencies[dependency], undefined, dependency);
  }
});

test("backend declares every @forumo workspace package it imports", () => {
  // Regression test: backend imported runtime values (Zod schemas, not just
  // types) from @forumo/shared without declaring it as a dependency. It only
  // "worked" via a TypeScript path alias (tsconfig.base.json) that affects
  // type-checking and ts-node-dev, not the compiled production runtime —
  // `node dist/apps/backend/src/main.js` would crash with "Cannot find
  // module '@forumo/shared'" on startup, since pnpm's strict linking never
  // created the node_modules symlink for an undeclared dependency.
  const backendDependencies = readJson(
    "apps/backend/package.json",
  ).dependencies;

  const importedWorkspacePackages = new Set();
  const walk = (dirUrl) => {
    const dirPath = fileURLToPath(dirUrl);
    for (const entry of readdirSync(dirPath)) {
      const entryUrl = new URL(`${entry}`, `${dirUrl}/`);
      const entryPath = fileURLToPath(entryUrl);
      const stat = statSync(entryPath);
      if (stat.isDirectory()) {
        walk(entryUrl);
        continue;
      }
      if (!entry.endsWith(".ts") || entry.endsWith(".spec.ts")) continue;
      const content = readFileSync(entryPath, "utf8");
      for (const match of content.matchAll(/from\s+["'](@forumo\/\w+)/g)) {
        importedWorkspacePackages.add(match[1]);
      }
    }
  };
  walk(new URL("apps/backend/src", rootUrl));

  for (const pkg of importedWorkspacePackages) {
    assert.ok(
      backendDependencies[pkg],
      `apps/backend/src imports "${pkg}" but apps/backend/package.json does not declare it as a dependency`,
    );
  }
});
