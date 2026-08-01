import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

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
