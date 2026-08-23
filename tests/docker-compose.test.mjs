import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const runDockerComposeConfig = () => {
  const args = ["compose", "config", "--format", "json"];
  const result =
    process.platform === "win32"
      ? spawnSync(`docker ${args.join(" ")}`, {
          cwd: new URL("../", import.meta.url),
          encoding: "utf8",
          shell: true,
        })
      : spawnSync("docker", args, {
          cwd: new URL("../", import.meta.url),
          encoding: "utf8",
        });
  return result;
};

// A hardcoded secret literal directly assigned to one of these keys in a
// tracked compose file (rather than a ${VAR:-default} substitution) would
// mean the value can never be overridden without editing a tracked file.
const secretKeysThatMustBeOverridable = [
  "POSTGRES_PASSWORD",
  "MINIO_ROOT_PASSWORD",
  "MINIO_ROOT_USER",
  "JWT_SECRET",
  "MODERATION_INTERNAL_TOKEN",
  "PGADMIN_DEFAULT_PASSWORD",
];

for (const file of ["docker-compose.yml", "docker-compose.override.yml"]) {
  test(`${file} does not hardcode a bare secret literal for a value that should be overridable`, () => {
    const content = read(file)
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    for (const key of secretKeysThatMustBeOverridable) {
      const assignmentPattern = new RegExp(
        `(?<!\\$\\{)${key}:\\s*(?!\\$\\{)\\S|(?<!\\$\\{)${key}=(?!\\$\\{)\\S`,
      );
      const match = content.match(assignmentPattern);
      assert.equal(
        match,
        null,
        `${file} assigns ${key} a bare literal instead of a \${${key}:-default} substitution: ${match?.[0]}`,
      );
    }
  });
}

test("the backend service overrides NODE_ENV instead of inheriting the image's production default", () => {
  const content = read("docker-compose.yml");
  assert.match(
    content,
    /backend:[\s\S]*?NODE_ENV=\$\{NODE_ENV:-development\}/,
    "docker-compose.yml's backend service must set NODE_ENV explicitly — " +
      "apps/backend/Dockerfile bakes in NODE_ENV=production, which activates " +
      "strict production secret validation this dev stack does not satisfy.",
  );
});

test("backend, web, and moderation each declare a healthcheck", () => {
  const content = read("docker-compose.yml");
  for (const service of ["backend", "web", "moderation"]) {
    const servicePattern = new RegExp(
      `^  ${service}:\\n([\\s\\S]*?)(?=^  \\S|\\Z)`,
      "m",
    );
    const serviceBlock = content.match(servicePattern)?.[1] ?? "";
    assert.match(
      serviceBlock,
      /healthcheck:/,
      `${service} has no healthcheck block in docker-compose.yml`,
    );
  }
});

test("docker compose config resolves the merged stack without error", () => {
  const result = runDockerComposeConfig();
  if (result.error?.code === "ENOENT") {
    // Docker isn't installed/available in this environment — skip rather
    // than fail; the other tests here cover the file contents statically.
    return;
  }
  assert.equal(
    result.status,
    0,
    result.stderr || result.error?.message || "docker compose config failed",
  );
  const config = JSON.parse(result.stdout);
  assert.equal(config.services.backend.environment.NODE_ENV, "development");
  assert.ok(config.services.backend.healthcheck);
  assert.ok(config.services.web.healthcheck);
  assert.ok(config.services.moderation.healthcheck);
  assert.equal(
    config.services.web.depends_on.backend.condition,
    "service_healthy",
  );
});
