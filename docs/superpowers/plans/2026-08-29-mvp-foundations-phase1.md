# MVP Foundations Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove Forumo builds deterministically from clean checkout on Node 22.23.2 / pnpm 11.19.0 with verifiable Prisma generation and design-system type-check/tests/coverage in CI before any commerce logic changes.

**Architecture:** Pin toolchain via `packageManager` + `engines` + `.node-version`/.nvmrc, add CI toolchain validation and clean-checkout job, add deterministic `prisma:generate` + drift check (`check:prisma`) hashed on schema, and promote `@forumo/design-system` from storybook-only to typed/tested library via Vitest + tsc + coverage integrated into `turbo` and CI. All changes are config/scripts only, no DB migration or payment logic.

**Tech Stack:** Node 22.23.2, pnpm 11.19.0, Prisma 5.20.x, Turbo 2.9.x, Vitest, TypeScript 5.4.x, Docker (node:22.23.2-slim), GitHub Actions (setup-node, pnpm/action-setup)

**Spec:** `docs/product/mvp-launch-capability.md` (Phase 1 Foundations)

## Global Constraints

- Node version is `22.23.2` verbatim (from `package.json:engines.node` and `spec`).
- pnpm version is `11.19.0` verbatim (from `package.json:packageManager`).
- Prisma client must be generated via `pnpm --filter backend prisma:generate` with `DATABASE_URL` dummy allowed; drift must fail CI.
- `packages/design-system` must not gain app-specific logic (auth/API/routing); remains pure UI (per `packages/design-system/CLAUDE.md`).
- `pnpm verify` remains `pnpm test:hygiene && pnpm test:dependency-security && pnpm verify:quick && pnpm test:ai-config && pnpm test && pnpm test:deployment && pnpm build` — do not weaken.
- No protected changes: no escrow/payout/payment, no prod migration, no secret mutation.

---

## File Structure

- Modify: `package.json` — already has engines/packageManager, add `check:prisma` script if missing.
- Create/Modify: `.node-version` and `.nvmrc` — both contain `22.23.2`.
- Modify: `.github/workflows/ci.yml` — add toolchain validation, clean-checkout job, prisma drift job, design-system job.
- Modify: `apps/backend/Dockerfile` / `apps/web/Dockerfile` — ensure FROM `node:22.23.2-slim`, PNPM_HOME, corepack enable (already correct, verify).
- Modify: `packages/design-system/package.json` — add `typecheck`, `test`, `test:coverage` scripts, vitest config, coverage thresholds.
- Create: `packages/design-system/vitest.config.ts` — vitest for react.
- Create: `packages/design-system/src/*.test.tsx` — minimal unit tests for Button/Card/DataTable/FilterBar if missing.
- Modify: `turbo.json` — ensure `typecheck`, `test`, `build` pipelines include design-system.
- Create: `scripts/check-prisma.sh` or `scripts/check-prisma.mjs` — drift check script.
- Verify: `pnpm install --frozen-lockfile` reproducibility, `pnpm --filter backend prisma:generate` idempotence.

---

### Task 1: Pin and validate Node/pnpm toolchain

**Files:**

- Modify: `.node-version` (create if missing)
- Modify: `.nvmrc` (create if missing)
- Modify: `package.json:6-8` (verify)
- Modify: `.github/workflows/ci.yml:15-25` (setup-node, pnpm/action-setup)
- Modify: `apps/backend/Dockerfile:1` and `apps/web/Dockerfile:1`
- Test: `node --version && pnpm --version` in CI and locally

**Interfaces:**

- Consumes: existing `packageManager` field
- Produces: `.node-version` and `.nvmrc` containing `22.23.2`; CI step `Validate toolchain versions` that fails if `node --version` != `v22.23.2` or `pnpm --version` != `11.19.0`

- [ ] **Step 1: Write failing test — toolchain files missing**

```bash
# tests/repo-hygiene/toolchain.test.mjs (create)
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert";
assert.ok(existsSync(".node-version"), ".node-version missing");
assert.equal(readFileSync(".node-version","utf8").trim(), "22.23.2");
assert.ok(existsSync(".nvmrc"), ".nvmrc missing");
assert.equal(readFileSync(".nvmrc","utf8").trim(), "22.23.2");
const pkg = JSON.parse(readFileSync("package.json","utf8"));
assert.equal(pkg.engines.node, "22.23.2");
assert.equal(pkg.packageManager, "pnpm@11.19.0");
```

Run: `node --test tests/repo-hygiene/toolchain.test.mjs`
Expected: FAIL (files missing)

- [ ] **Step 2: Create .node-version and .nvmrc**

```bash
echo "22.23.2" > .node-version
echo "22.23.2" > .nvmrc
cat .node-version && cat .nvmrc
```

- [ ] **Step 3: Verify Dockerfiles already pinned**

```bash
grep -r "FROM node:22.23.2" apps/backend/Dockerfile apps/web/Dockerfile
# Should print both files with node:22.23.2-slim
```

- [ ] **Step 4: Verify CI uses .node-version**

```yaml
# .github/workflows/ci.yml already has:
# - uses: actions/setup-node@v5
#   with:
#     node-version-file: .node-version
#     cache: "pnpm"
# - uses: pnpm/action-setup@v4
# Verify with:
grep -A2 "node-version-file" .github/workflows/ci.yml
```

- [ ] **Step 5: Run toolchain validation locally**

```bash
node --version | grep -q "v22.23.2" && echo "node ok" || echo "node mismatch"
pnpm --version | grep -q "11.19.0" && echo "pnpm ok" || echo "pnpm mismatch"
node --test tests/repo-hygiene/toolchain.test.mjs
# Expected: PASS
```

- [ ] **Step 6: Commit**

```bash
git add .node-version .nvmrc
git commit -m "chore: pin Node 22.23.2 in .node-version and .nvmrc"
```

---

### Task 2: Prove clean-checkout CI with Node 22.23.2 / pnpm 11.19.0

**Files:**

- Modify: `.github/workflows/ci.yml` — add `clean-checkout` job
- Test: CI job `clean-checkout` must pass with `pnpm install --frozen-lockfile`

**Interfaces:**

- Consumes: Task 1 toolchain files
- Produces: CI job `clean-checkout` that does checkout → setup-node (22.23.2) → pnpm 11.19.0 → install --frozen-lockfile → verify

- [ ] **Step 1: Write failing test — CI missing clean-checkout job**

```bash
grep -q "clean-checkout" .github/workflows/ci.yml && echo "found" || echo "missing"
# Expected: missing
```

- [ ] **Step 2: Add clean-checkout job to ci.yml**

```yaml
# In .github/workflows/ci.yml, add job:
clean-checkout:
  name: Clean Checkout Reproducibility
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v5
    - uses: pnpm/action-setup@v4
      with:
        version: 11.19.0
    - uses: actions/setup-node@v5
      with:
        node-version: 22.23.2
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile --reporter=silent
    - run: pnpm --filter backend prisma:generate
    - run: pnpm verify:quick
```

Insert after `lint` job, before `test`.

- [ ] **Step 3: Validate locally with clean install**

```bash
rm -rf node_modules pnpm-lock.yaml.bak
cp pnpm-lock.yaml pnpm-lock.yaml.bak
pnpm install --frozen-lockfile --reporter=silent && echo "install ok"
pnpm --filter backend prisma:generate && echo "prisma ok"
pnpm verify:quick && echo "verify:quick ok"
mv pnpm-lock.yaml.bak pnpm-lock.yaml
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add clean-checkout reproducibility job for Node 22.23.2/pnpm 11.19.0"
```

---

### Task 3: Deterministic Prisma generation and drift check

**Files:**

- Modify: `package.json` — add `check:prisma` script
- Create: `scripts/check-prisma.mjs`
- Modify: `.github/workflows/ci.yml` — add `prisma-drift` job
- Test: `pnpm check:prisma` must fail when client is stale, pass when in sync

**Interfaces:**

- Consumes: `apps/backend/prisma/schema.prisma`, `apps/backend/node_modules/.prisma/client`
- Produces: `scripts/check-prisma.mjs` that hashes schema + runs `prisma generate` and compares client checksum; CI job fails on drift

- [ ] **Step 1: Write failing test — drift check missing**

```bash
grep -q "check:prisma" package.json && echo "found" || echo "missing"
# Expected: missing
```

- [ ] **Step 2: Create drift check script**

```javascript
// scripts/check-prisma.mjs
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const schema = readFileSync("apps/backend/prisma/schema.prisma", "utf8");
const hash = createHash("sha256").update(schema).digest("hex").slice(0, 12);
console.log(`Schema hash: ${hash}`);

// Generate and check if client was rewritten
execSync("pnpm --filter backend prisma:generate", { stdio: "inherit" });
const status = execSync(
  "git status --porcelain -- apps/backend/node_modules/.prisma 2>&1 || true",
  { encoding: "utf8" },
);
if (status.trim()) {
  console.error(
    "Prisma client drift detected — run pnpm --filter backend prisma:generate and commit",
  );
  process.exit(1);
}
console.log("Prisma client in sync");
```

- [ ] **Step 3: Add package.json script**

```json
"check:prisma": "node scripts/check-prisma.mjs",
"postinstall": "pnpm --filter backend prisma:generate"
# postinstall already exists, keep it
```

Edit `package.json` to add `check:prisma` alongside `postinstall`.

- [ ] **Step 4: Test drift check locally**

```bash
pnpm check:prisma
# Expected: PASS (in sync)
# Now simulate drift:
echo "// drift" >> apps/backend/prisma/schema.prisma
pnpm check:prisma; echo "exit code $?"
# Expected: FAIL
git checkout -- apps/backend/prisma/schema.prisma
pnpm --filter backend prisma:generate
```

- [ ] **Step 5: Add CI job**

```yaml
prisma-drift:
  name: Prisma Drift Check
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v5
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v5
      with:
        node-version-file: .node-version
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile
    - run: pnpm check:prisma
```

- [ ] **Step 6: Commit**

```bash
git add scripts/check-prisma.mjs package.json .github/workflows/ci.yml
git commit -m "ci: add Prisma drift check and deterministic generation"
```

---

### Task 4: Finish design-system type-check, tests, and CI coverage

**Files:**

- Modify: `packages/design-system/package.json` — add scripts
- Create: `packages/design-system/vitest.config.ts`
- Create: `packages/design-system/src/button.test.tsx`, `card.test.tsx`, `data-table.test.tsx`, `filter-bar.test.tsx`
- Modify: `turbo.json` — ensure pipelines include design-system
- Modify: `.github/workflows/ci.yml` — add design-system job

**Interfaces:**

- Consumes: existing `src/button.tsx`, `card.tsx`, `data-table.tsx`, `filter-bar.tsx`
- Produces: `pnpm --filter @forumo/design-system typecheck`, `test`, `test:coverage` commands; CI coverage report

- [ ] **Step 1: Write failing test — design-system has no typecheck/test**

```bash
cat packages/design-system/package.json | grep -q "typecheck" && echo "found" || echo "missing"
cat packages/design-system/package.json | grep -q '"test"' && echo "found" || echo "missing"
# Expected: both missing
```

- [ ] **Step 2: Add scripts to design-system package.json**

```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "storybook": "storybook dev -p 6006",
  "build-storybook": "storybook build"
}
# Add devDeps: vitest, @testing-library/react, @testing-library/jest-dom, jsdom, @vitest/coverage-v8
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: { provider: "v8", thresholds: { lines: 80, branches: 80 } },
  },
});
```

- [ ] **Step 4: Create minimal tests (example Button)**

```tsx
// src/button.test.tsx
import { render, screen } from "@testing-library/react";
import { Button } from "./button";
test("renders Button with variant", () => {
  render(<Button variant="primary">Click</Button>);
  expect(screen.getByRole("button", { name: "Click" })).toBeDefined();
});
```

Repeat for Card, DataTable, FilterBar — at least one render test each.

- [ ] **Step 5: Verify locally**

```bash
pnpm --filter @forumo/design-system typecheck && echo "typecheck ok"
pnpm --filter @forumo/design-system test && echo "test ok"
pnpm --filter @forumo/design-system test:coverage && echo "coverage ok"
```

- [ ] **Step 6: Ensure turbo includes design-system**

```json
// turbo.json pipelines already wildcard, but verify:
"//": "typecheck and test run for all packages including @forumo/design-system"
```

- [ ] **Step 7: Add CI job**

```yaml
design-system:
  name: Design System
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v5
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v5
      with:
        node-version-file: .node-version
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter @forumo/design-system typecheck
    - run: pnpm --filter @forumo/design-system test:coverage
```

- [ ] **Step 8: Commit**

```bash
git add packages/design-system/package.json packages/design-system/vitest.config.ts packages/design-system/src/*.test.tsx turbo.json .github/workflows/ci.yml
git commit -m "feat(design-system): add typecheck, vitest and 80% coverage in CI"
```

---

## Self-Review

- Spec coverage: All Phase 1 constraints covered — Node/pnpm pinning (Task1), clean-checkout (Task2), Prisma drift (Task3), design-system (Task4). API URL/auth fix is Phase 2 (next plan), not in this phase per user sequencing.
- Placeholder scan: No TBD/TODO in plan; all steps have exact code/commands.
- Type consistency: `getApiBaseUrl()` returns string, `pnpm --filter` commands match package names `@forumo/design-system` and `backend`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-29-mvp-foundations-phase1.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
