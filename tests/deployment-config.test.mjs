import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const actionBlocks = (workflow, action) => {
  const lines = workflow.split(/\r?\n/);
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(
      new RegExp(`^(\\s*)- uses: ${action.replace("/", "\\/")}@`),
    );
    if (!match) continue;

    const stepPrefix = `${match[1]}- `;
    let end = index + 1;
    while (end < lines.length && !lines[end].startsWith(stepPrefix)) {
      end += 1;
    }
    blocks.push(lines.slice(index, end).join("\n"));
  }

  return blocks;
};

const runPnpm = (args) => {
  const options = {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  };
  return process.platform === "win32"
    ? spawnSync(`pnpm ${args.join(" ")}`, {
        ...options,
        shell: true,
      })
    : spawnSync("pnpm", args, options);
};

const readPnpmConfig = (key) => {
  const result = runPnpm(["config", "get", key, "--json"]);

  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.notEqual(result.stdout.trim(), "", `pnpm did not load ${key}`);
  return JSON.parse(result.stdout);
};

const parseVersion = (version) => version.split(".").map(Number);

const isAtLeastVersion = (actual, minimum) => {
  const actualParts = parseVersion(actual);
  const minimumParts = parseVersion(minimum);

  for (let index = 0; index < minimumParts.length; index += 1) {
    const actualPart = actualParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;

    if (actualPart > minimumPart) {
      return true;
    }

    if (actualPart < minimumPart) {
      return false;
    }
  }

  return true;
};

test("pnpm runtime matches the repository package-manager pin", () => {
  const expected = JSON.parse(read("package.json")).packageManager;
  const result = runPnpm(["--version"]);

  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(`pnpm@${result.stdout.trim()}`, expected);
});

test("server toolchain pins stay aligned across local, CI, and container runtimes", () => {
  const rootPackage = JSON.parse(read("package.json"));
  const nodeVersionFile = new URL("../.node-version", import.meta.url);

  assert.equal(
    existsSync(nodeVersionFile),
    true,
    "the repository must publish its supported Node version",
  );
  const nodeVersion = read(".node-version").trim();
  const workflow = read(".github/workflows/ci.yml");
  const backendDockerfile = read("apps/backend/Dockerfile");
  const webDockerfile = read("apps/web/Dockerfile");

  assert.equal(rootPackage.engines.node, nodeVersion);
  assert.match(rootPackage.packageManager, /^pnpm@\d+\.\d+\.\d+$/);

  const pnpmSetupSteps = actionBlocks(workflow, "pnpm/action-setup");
  const nodeSetupSteps = actionBlocks(workflow, "actions/setup-node");
  const repositoryNodeSteps = nodeSetupSteps.filter((step) =>
    /node-version-file: \.node-version/.test(step),
  );
  const mobileNodeSteps = nodeSetupSteps.filter((step) =>
    /node-version: 18\.18\.0/.test(step),
  );

  assert.ok(pnpmSetupSteps.length > 0);
  for (const step of pnpmSetupSteps) {
    assert.doesNotMatch(
      step,
      /^\s+version:/m,
      "CI must read pnpm from package.json instead of duplicating the version",
    );
  }
  assert.equal(nodeSetupSteps.length, pnpmSetupSteps.length);
  assert.equal(
    repositoryNodeSteps.length + mobileNodeSteps.length,
    nodeSetupSteps.length,
    "every CI job must use the repository Node pin or the documented Expo/Detox exception",
  );
  assert.match(
    backendDockerfile,
    new RegExp(`^FROM node:${nodeVersion}-slim AS base$`, "m"),
  );
  assert.match(
    webDockerfile,
    new RegExp(`^FROM node:${nodeVersion}-slim AS base$`, "m"),
  );
});

test("turbo supports pnpm 11 flat patch lockfiles", () => {
  const rootPackage = JSON.parse(read("package.json"));
  const minimumTurboVersion = "2.9.7";
  const result = runPnpm(["turbo", "--version"]);

  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.ok(
    isAtLeastVersion(result.stdout.trim(), minimumTurboVersion),
    `turbo ${result.stdout.trim()} cannot parse pnpm 11 patchedDependencies lockfile entries`,
  );
  assert.match(rootPackage.devDependencies.turbo, /^\^?2\./);
});

test("pnpm uses the repository-local store in every runtime", () => {
  const result = runPnpm(["store", "path"]);
  const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
  const expectedStoreRoot = resolve(workspaceRoot, ".pnpm-store");
  const workspaceConfig = read("pnpm-workspace.yaml");

  assert.match(workspaceConfig, /^storeDir: \.pnpm-store$/m);
  assert.match(workspaceConfig, /^enableGlobalVirtualStore: false$/m);
  assert.match(workspaceConfig, /^verifyDepsBeforeRun: warn$/m);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.ok(
    resolve(result.stdout.trim()).startsWith(expectedStoreRoot),
    `pnpm resolved an external store: ${result.stdout.trim()}`,
  );
});

test("pnpm loads the repository overrides and patch declarations", () => {
  const overrides = readPnpmConfig("overrides");
  const patchedDependencies = readPnpmConfig("patchedDependencies");

  assert.equal(overrides["@auth/core@<0.41.3"], "0.41.3");
  assert.equal(
    patchedDependencies["@expo/cli@0.17.13"],
    resolve(
      fileURLToPath(new URL("../", import.meta.url)),
      "patches/@expo__cli@0.17.13.patch",
    ),
  );
});

test("pnpm applies an explicit dependency build-script policy", () => {
  const allowBuilds = readPnpmConfig("allowBuilds");

  assert.equal(allowBuilds["@prisma/client"], true);
  assert.equal(allowBuilds["@prisma/engines"], true);
  assert.equal(allowBuilds.bcrypt, true);
  assert.equal(allowBuilds.esbuild, true);
  assert.equal(allowBuilds["@nestjs/core"], false);
  assert.equal(allowBuilds["@sentry/cli"], false);
  assert.equal(allowBuilds.msw, false);
  assert.equal(allowBuilds.prisma, false);
  assert.equal(allowBuilds.protobufjs, false);
});

test("workspace installs generate the backend Prisma client explicitly", () => {
  const rootPackage = JSON.parse(read("package.json"));
  const backendPackage = JSON.parse(read("apps/backend/package.json"));

  assert.equal(
    rootPackage.scripts.postinstall,
    "pnpm --filter backend prisma:generate",
  );
  assert.equal(
    backendPackage.scripts["prisma:generate"],
    "prisma generate --schema prisma/schema.prisma",
  );
  assert.equal(backendPackage.scripts.prebuild, "pnpm run prisma:generate");
  assert.equal(backendPackage.scripts.pretypecheck, "pnpm run prisma:generate");
});

test("production workloads consume the External Secrets outputs", () => {
  const backend = read("k8s/backend/deployment.yaml");
  const web = read("k8s/web/deployment.yaml");

  assert.match(backend, /secretRef:\s+name: forumo-backend-secrets/);
  assert.match(web, /secretRef:\s+name: forumo-web-secrets/);
  assert.match(web, /secretRef:\s+name: forumo-admin-secrets/);
  assert.doesNotMatch(`${backend}\n${web}`, /name: forumo-secrets/);
});

test("Kubernetes probes target routes implemented by each service", () => {
  const backend = read("k8s/backend/deployment.yaml");
  const web = read("k8s/web/deployment.yaml");

  assert.match(backend, /path: \/api\/v1\/health\/live/);
  assert.match(backend, /path: \/api\/v1\/health\/ready/);
  assert.match(web, /name: web[\s\S]*?path: \/\s+port: 3000/);
  assert.match(web, /name: admin[\s\S]*?path: \/admin\s+port: 3001/);
  assert.doesNotMatch(`${backend}\n${web}`, /path: \/health/);
});

test("admin routes are mounted once beneath the /admin base path", () => {
  const nextConfig = read("apps/admin/next.config.mjs");
  const providers = read("apps/admin/src/components/providers.tsx");
  const adminEnv = read("apps/admin/.env.example");
  const legacyAdminRoute = new URL(
    "../apps/admin/src/app/admin/layout.tsx",
    import.meta.url,
  );

  assert.match(nextConfig, /basePath:\s*["']\/admin["']/);
  assert.match(
    providers,
    /SessionProvider basePath=["']\/admin\/api\/auth["']/,
  );
  assert.match(
    adminEnv,
    /NEXTAUTH_URL=http:\/\/localhost:3001\/admin\/api\/auth/,
  );
  assert.equal(existsSync(legacyAdminRoute), false);
});

test("deployment docs apply only the canonical production manifests", () => {
  const deploymentGuide = read("docs/DEPLOYMENT.md");

  assert.match(
    deploymentGuide,
    /kubectl apply -f k8s\/backend\/deployment.yaml/,
  );
  assert.match(deploymentGuide, /kubectl apply -f k8s\/web\/deployment.yaml/);
  assert.doesNotMatch(
    deploymentGuide,
    /kubectl apply -f k8s\/apps\/(backend|web)\.yaml/,
  );
});

test("monitoring docs use the metrics controller x-api-key contract", () => {
  const deploymentGuide = read("docs/DEPLOYMENT.md");

  assert.match(deploymentGuide, /http_headers:[\s\S]*?x-api-key:/);
  assert.doesNotMatch(deploymentGuide, /Authorization: Bearer/);
});

test("paused mobile emulator jobs run only when explicitly dispatched", () => {
  const workflow = read(".github/workflows/ci.yml");

  assert.match(workflow, /run_android_e2e:/);
  assert.match(
    workflow,
    /if: github\.event_name == 'workflow_dispatch' && inputs\.run_android_e2e/,
  );
  assert.match(
    workflow,
    /if: github\.event_name == 'workflow_dispatch' && inputs\.run_ios_e2e/,
  );
});
