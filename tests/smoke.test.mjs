import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";

describe("smoke: release readiness", () => {
  it("format:check passes", () => {
    execSync("pnpm format:check", { stdio: "pipe" });
  });

  it("lint passes with 0 warnings", () => {
    execSync("pnpm lint", { stdio: "pipe" });
  });

  it("typecheck passes", () => {
    execSync("pnpm typecheck", { stdio: "pipe" });
  });

  it("NEXT_PUBLIC_USE_API_MOCKS is not enabled in production", async () => {
    const { readFile } = await import("node:fs/promises");
    const compose = await readFile("docker-compose.yml", "utf8");
    assert.ok(
      compose.includes("NEXT_PUBLIC_USE_API_MOCKS=${NEXT_PUBLIC_USE_API_MOCKS"),
      "docker-compose should use env var reference, not hardcoded true",
    );
  });

  it("Prisma schema hash exists and check passes", () => {
    execSync("node scripts/check-prisma.mjs", { stdio: "pipe" });
  });
});
