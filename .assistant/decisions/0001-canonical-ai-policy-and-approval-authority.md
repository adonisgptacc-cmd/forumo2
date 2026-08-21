# 0001: Canonical AI policy and approval authority

- Status: approved
- Date: 2026-08-16
- Owner: Project owner (ABADO)
- Approval evidence: Project owner's explicit authorization in the current Codex task

## Context

The repository had overlapping root instructions and tool-specific configuration. The attached AI project structure proposed a broad governance hierarchy, but copying it wholesale would duplicate the existing ECC skills, Codex roles, MCP configuration, and project documentation.

## Decision

- Root `AGENTS.md` is the canonical cross-tool AI policy.
- Root `CLAUDE.md`, `.claude/CLAUDE.md`, `.codex/AGENTS.md`, and `.github/copilot-instructions.md` are tool entry points that may add compatible detail but cannot weaken the canonical policy.
- Project owner (ABADO) is the sole approver for payment, migration, production, and AI-configuration changes.
- `.assistant/` holds only cross-tool rules, decisions, and reviewed learnings. Existing skills, agents, MCP configuration, CI, and hooks remain in their established locations.

## Alternatives considered

- Keep both root instruction files authoritative: rejected because conflicting policy could drift silently.
- Copy the entire template hierarchy: rejected because it would create overlapping workflow surfaces and increase maintenance cost.
- Make `CLAUDE.md` canonical: rejected because `AGENTS.md` has broader tool support in this repository.

## Consequences

All assistants share one policy and one approval authority. Tool-specific files stay small. Governance changes themselves are protected and require the project owner's explicit approval.

## Verification and rollback

`tests/ai-governance.test.mjs` verifies canonical pointers, protected approvals, required rule files, existing integration surfaces, and local override ignores. Roll back the canonical policy, pointers, governance directory, package scripts, and governance test together to avoid a partially configured state.
