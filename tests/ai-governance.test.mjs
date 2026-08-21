import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const rootUrl = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, rootUrl), "utf8");
}

test("AGENTS.md is the canonical policy with explicit approval authority", async () => {
  const agents = await read("AGENTS.md");

  assert.match(agents, /Canonical AI policy/i);
  assert.match(agents, /Project owner \(ABADO\)/);
  assert.match(agents, /payment/i);
  assert.match(agents, /migration/i);
  assert.match(agents, /production/i);
  assert.match(agents, /AI configuration/i);
  assert.match(agents, /Rule precedence/i);
});

test("tool-specific instruction files point back to AGENTS.md", async () => {
  const [claude, copilot, codex] = await Promise.all([
    read("CLAUDE.md"),
    read(".github/copilot-instructions.md"),
    read(".codex/AGENTS.md"),
  ]);

  for (const contents of [claude, copilot, codex]) {
    assert.match(contents, /AGENTS\.md/);
    assert.match(contents, /canonical/i);
  }

  assert.ok(
    claude.split(/\r?\n/).length <= 15,
    "CLAUDE.md should remain a short pointer",
  );
});

test("project-specific governance files exist", async () => {
  const requiredFiles = [
    ".assistant/README.md",
    ".assistant/learnings.md",
    ".assistant/rules/security.md",
    ".assistant/rules/protected-paths.md",
    ".assistant/rules/dependencies.md",
    ".assistant/rules/definition-of-ready.md",
    ".assistant/rules/definition-of-done.md",
    ".assistant/rules/data-handling.md",
    ".assistant/rules/request-format.md",
    ".assistant/rules/observability.md",
    ".assistant/decisions/README.md",
    ".github/pull_request_template.md",
  ];

  await Promise.all(requiredFiles.map((path) => read(path)));
});

test("generic governance does not duplicate installed harness surfaces", async () => {
  const assistantReadme = await read(".assistant/README.md");

  assert.match(assistantReadme, /\.agents\/skills/);
  assert.match(assistantReadme, /\.codex\/agents/);
  assert.match(assistantReadme, /\.mcp\.json/);
  assert.doesNotMatch(assistantReadme, /create duplicate harness surfaces/i);
});

test("local overrides are ignored and verification commands are registered", async () => {
  const [gitignore, packageJson] = await Promise.all([
    read(".gitignore"),
    read("package.json"),
  ]);
  const packageData = JSON.parse(packageJson);

  assert.match(gitignore, /^AGENTS\.local\.md$/m);
  assert.match(gitignore, /^\.assistant\/settings\.local\.json$/m);
  assert.equal(
    packageData.scripts["test:ai-config"],
    "node --test tests/ai-governance.test.mjs",
  );
  assert.match(packageData.scripts["verify:quick"], /format:check/);
  assert.match(packageData.scripts.verify, /test:ai-config/);
});
