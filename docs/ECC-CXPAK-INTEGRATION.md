# ECC and cxpak integration

This repository uses a project-local, stack-specific ECC installation plus cxpak 3.1.4.

## Upstream sources

- ECC: `affaan-m/ECC`, integrated from commit `50743cec75852e32d6517c9894a3339a2462a713`
- cxpak: `Barnett-Studios/cxpak`, integrated from commit `ba45a771886a714bd69625e50a80b84ad7df5ed0`
- cxpak Windows release: `v3.1.4`
- Release SHA-256: `b4199c74cfda9e45a8022b912d7220ad5ec87b8a015f7318bb0108b2acc573e2`

The source checkouts live under the ignored `.integration-sources/` directory on the machine where the integration was performed. The committed files are sufficient for a fresh checkout.

## ECC classification

DAILY skills match the active stack: TypeScript, Next.js/React, React Native, NestJS, FastAPI/Python, Prisma/Postgres, Docker/Kubernetes, API design, security, TDD, E2E testing, documentation lookup, and verification.

The remaining installed skills are LIBRARY workflows. They remain searchable but should only be loaded when their trigger matches the current task. ECC agents, hooks, legacy command shims, and the broad MCP catalog were not installed because they either duplicate Codex-native surfaces or add unrelated runtime context.

Codex uses the three project-local roles in `.codex/agents/`: explorer, reviewer, and docs researcher.

## cxpak setup

On Windows, install the pinned binary:

```powershell
pnpm setup:cxpak
```

The installer downloads the official release archive, verifies its SHA-256 checksum, and installs `cxpak.exe` under ignored `.tools/cxpak/`.

Useful commands:

```powershell
pnpm cxpak:overview
pnpm cxpak:onboard
pnpm cxpak:visual
pnpm cxpak:mcp
```

Codex reads the cxpak MCP definition from `.codex/config.toml`. Other MCP-compatible clients can use `.mcp.json`. Generated indexes and reports are written to ignored `.cxpak/`.

## Verification

After a fresh setup, verify:

```powershell
.\.tools\cxpak\cxpak.exe --version
pnpm cxpak:overview
codex mcp list
```

The expected version is `cxpak 3.1.4`. The MCP server must complete an `initialize` request and report server name `cxpak` with version `3.1.4`.
