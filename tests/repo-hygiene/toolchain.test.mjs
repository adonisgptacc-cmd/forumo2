import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

describe("toolchain pinning", () => {
  test(".node-version exists and contains 22.23.2", () => {
    assert.ok(existsSync(".node-version"), ".node-version missing");
    assert.equal(readFileSync(".node-version", "utf8").trim(), "22.23.2");
  });

  test(".nvmrc exists and contains 22.23.2", () => {
    assert.ok(existsSync(".nvmrc"), ".nvmrc missing");
    assert.equal(readFileSync(".nvmrc", "utf8").trim(), "22.23.2");
  });

  test("package.json engines.node and packageManager are pinned", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    assert.equal(pkg.engines.node, "22.23.2");
    assert.equal(pkg.packageManager, "pnpm@11.19.0");
  });
});
