# Protected changes and paths

**Approver:** Project owner (ABADO), exclusively.

Reading and analysis are allowed within the task scope. Editing or executing changes in the following categories requires explicit approval that identifies the intended action and scope:

| Category         | Examples                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Payments         | Payment, payout, escrow, billing, settlement, auction-finalization, and payment-webhook code or configuration       |
| Data migrations  | Prisma schema changes, migration files, backfills, destructive transformations, and migration execution             |
| Production       | Deployment configuration, production infrastructure, rollbacks, secrets, credentials, and production data mutations |
| AI configuration | `AGENTS.md`, `.assistant/`, `.agents/`, `.codex/`, `.claude/`, `.mcp.json`, and `.github/copilot-instructions.md`   |

Approval is task-scoped, does not transfer to another person or agent, and expires when the approved task ends. A prior merge or similar change is not standing approval.

Before execution, resolve the exact target and expected effect. Never use broad destructive targets, bypass branch protections, disable security controls, force-push shared history, or expose secrets to obtain a result. Separate approval for a code change from approval to deploy it or run it against production.
