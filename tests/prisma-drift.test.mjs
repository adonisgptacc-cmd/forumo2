import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const backendPackageJson = `${workspaceRoot}apps/backend/package.json`;
const schemaPath = `${workspaceRoot}apps/backend/prisma/schema.prisma`;

const schema = readFileSync(schemaPath, "utf8");
const modelNames = [...schema.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);
const enumNames = [...schema.matchAll(/^enum\s+(\w+)/gm)].map((m) => m[1]);

test("schema.prisma declares at least one model and enum", () => {
  assert.ok(modelNames.length > 0, "expected schema.prisma to declare models");
  assert.ok(enumNames.length > 0, "expected schema.prisma to declare enums");
});

test("generated @prisma/client exports every schema model", () => {
  const require = createRequire(backendPackageJson);
  let client;
  try {
    client = require("@prisma/client");
  } catch (error) {
    throw new Error(
      `@prisma/client is not generated. Run "pnpm --filter backend prisma:generate" first.\n${error.message}`,
    );
  }

  const generatedModelNames = Object.keys(client.Prisma.ModelName ?? {});
  const missing = modelNames.filter(
    (name) => !generatedModelNames.includes(name),
  );

  assert.deepEqual(
    missing,
    [],
    `generated Prisma client is missing model(s) declared in schema.prisma: ${missing.join(", ")}. Regenerate with "pnpm --filter backend prisma:generate".`,
  );
});

test("generated @prisma/client exports every schema enum", () => {
  const require = createRequire(backendPackageJson);
  const client = require("@prisma/client");

  const missing = enumNames.filter(
    (name) => typeof client[name] !== "object" || client[name] === null,
  );

  assert.deepEqual(
    missing,
    [],
    `generated Prisma client is missing enum(s) declared in schema.prisma: ${missing.join(", ")}. Regenerate with "pnpm --filter backend prisma:generate".`,
  );
});
