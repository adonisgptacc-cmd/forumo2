# Security Advisory: `image-size` Transitive Vulnerability in `apps/mobile`

**Date:** 2026-08-22

**Status:** Locally patched until upstream publishes a fixed release

**Severity:** High (CVSS 7.5); low production-runtime exposure in this repository
**Package:** `image-size@1.2.1` via `metro@0.80.12` (transitive)

## Summary

`pnpm audit` reports two high-severity denial-of-service advisories for `image-size`:

| CVE            | GHSA                | Affected parser      | Upstream patched version |
| -------------- | ------------------- | -------------------- | ------------------------ |
| CVE-2025-71330 | GHSA-w3rx-r6r6-pgpr | ICNS                 | none published           |
| CVE-2025-71329 | GHSA-5p2g-fcmc-qvqq | JXL / HEIF ISO boxes | none published           |

The advisories mark `image-size<=2.0.2` as vulnerable and list no patched npm release. `apps/mobile` receives `image-size@1.2.1` through this path:

```text
apps/mobile -> react-native@0.73.6
  -> @react-native/community-cli-plugin@0.73.17
    -> metro@0.80.12
      -> image-size@1.2.1
```

`image-size` is used by Metro during bundling and is not called by the backend or web runtime. The project still patches it because a malicious committed asset could otherwise hang a developer or CI bundling process.

## Dependency Trace

The vulnerable package is not a direct workspace dependency. The active resolution is introduced only by the React Native toolchain:

```text
apps/mobile
└─ react-native@0.73.6
   └─ @react-native/community-cli-plugin@0.73.17
      └─ metro@0.80.12
         └─ image-size@1.2.1
```

Metro calls `image-size` while reading static asset dimensions during development and bundling. No application source imports `image-size` directly, and the package is not part of the deployed NestJS, web, or admin request path.

## Exploitability Assessment

Both advisories are availability issues caused by malformed image metadata that declares a zero-length record. Before the local patch, a crafted ICNS, JXL, or HEIF file processed by Metro could keep the parser loop from advancing and hang the process.

The practical exposure is limited because an attacker would need to get such an asset into a trusted source tree or another build input consumed by Metro. This does not make the defect harmless: repository contributions and downloaded development assets are untrusted inputs, and a hang can disrupt developer or CI availability.

The patch therefore treats malformed lengths as invalid input and makes the parser terminate. It does not change valid-image parsing behavior.

## Safe Patched-Upgrade Check

At the time of this review, the upstream advisories cover every published `image-size` version through `2.0.2` and do not identify a fixed npm release. An override to a newer published version would therefore not resolve either advisory and could introduce an unsupported Metro dependency change.

The local patch is intentionally scoped to Metro's resolved `image-size@1.2.1`. When an upstream release becomes available, first confirm Metro's supported dependency range and run the mobile build and dependency-security regression tests before removing it.

## Local Remediation

The workspace applies `patches/image-size@1.2.1.patch` through `pnpm-workspace.yaml` `patchedDependencies`.

The patch addresses the known infinite loops by:

- rejecting ICNS image entries whose declared entry length is smaller than the 8-byte ICNS entry header;
- rejecting ISO boxes whose declared box length is smaller than the 8-byte box header before `findBox` can return or loop on them.

`pnpm-workspace.yaml` intentionally ignores only these two audit IDs:

```yaml
audit:
  level: high
  ignore:
    - GHSA-5p2g-fcmc-qvqq # Patched locally in image-size@1.2.1.patch.
    - GHSA-w3rx-r6r6-pgpr # Patched locally in image-size@1.2.1.patch.
```

The ignore is not an accepted-risk waiver. It is tied to the local patch and the regression test below.

The workspace also overrides vulnerable `tar` versions below `7.5.21`. Unlike `image-size`, `tar` has an upstream patched release, so no audit ignore is needed for its advisory.

## Regression Test

`tests/dependency-security.test.mjs` verifies the active Metro-resolved package, not an arbitrary package-store copy. It asserts:

- zero-length JXL/ISO boxes return `undefined` instead of a box with `size: 0`;
- malformed ICNS and JXL inputs terminate within the child-process timeout;
- every active `tar` resolution is `7.5.21`, which includes the fix for GHSA-r292-9mhp-454m.

Run it with:

```bash
pnpm test:dependency-security
```

## Follow-up

Remove the local patch and audit ignore only after `image-size` publishes a fixed version and Metro resolves to it safely. Validate with:

```bash
pnpm install
pnpm test:dependency-security
pnpm audit
```

## References

- [GHSA-w3rx-r6r6-pgpr: `image-size` infinite loop in ICNS parser](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)
- [GHSA-5p2g-fcmc-qvqq: `image-size` infinite loop in JXL/HEIF parser](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)
- [GHSA-r292-9mhp-454m: `tar` denial of service while parsing archives](https://github.com/advisories/GHSA-r292-9mhp-454m)
- [pnpm audit configuration](https://pnpm.io/cli/audit)
