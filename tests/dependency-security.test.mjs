import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const mobileRoot = fileURLToPath(new URL("../apps/mobile/", import.meta.url));
const reactNativePackage = require.resolve("react-native/package.json", {
  paths: [mobileRoot],
});
const communityCliPackage = require.resolve(
  "@react-native/community-cli-plugin/package.json",
  { paths: [dirname(reactNativePackage)] },
);
const metroPackage = require.resolve("metro/package.json", {
  paths: [dirname(communityCliPackage)],
});
const imageSizeEntry = require.resolve("image-size", {
  paths: [dirname(metroPackage)],
});
const imageSizeRoot = dirname(dirname(imageSizeEntry));

const runPnpm = (args) =>
  process.platform === "win32"
    ? spawnSync(`pnpm ${args.join(" ")}`, {
        cwd: workspaceRoot,
        encoding: "utf8",
        shell: true,
      })
    : spawnSync("pnpm", args, {
        cwd: workspaceRoot,
        encoding: "utf8",
      });

const assertParserTerminates = (modulePath, expression, input) => {
  const script = `
    const target = require(process.argv[1]);
    const input = Buffer.from(process.argv[2], "hex");
    try { ${expression}; } catch {}
  `;
  const result = spawnSync(
    process.execPath,
    ["-e", script, modulePath, input],
    {
      encoding: "utf8",
      timeout: 1_000,
    },
  );

  assert.notEqual(
    result.error?.code,
    "ETIMEDOUT",
    `parser did not terminate for malformed input: ${result.error?.message}`,
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
};

test("patched image-size rejects zero-length ISO boxes", () => {
  const { findBox } = require(join(imageSizeRoot, "dist/types/utils.js"));
  const zeroLengthBox = Buffer.from("000000006a786c70", "hex");

  assert.equal(findBox(zeroLengthBox, "jxlp", 0), undefined);
});

test("patched image-size terminates on malformed ICNS and JXL input", () => {
  assertParserTerminates(
    imageSizeEntry,
    "target(input)",
    "69636e73000000106963303700000000",
  );
  assertParserTerminates(
    join(imageSizeRoot, "dist/types/jxl.js"),
    "target.JXL.calculate(input)",
    "000000006a786c70",
  );
});

test("all active tar resolutions include the recursion fix", () => {
  const result = runPnpm(["why", "tar", "-r"]);
  assert.equal(result.status, 0, result.stderr || result.error?.message);

  const versions = [...result.stdout.matchAll(/tar@(\d+\.\d+\.\d+)/g)].map(
    ([, version]) => version,
  );
  assert.ok(versions.length > 0, "pnpm did not report an active tar package");
  assert.deepEqual([...new Set(versions)], ["7.5.21"]);
});
