# AI governance directory

This directory supplements the canonical policy in `AGENTS.md` with focused governance rules, approved decisions, and reviewed learnings.

It does not replace or weaken `AGENTS.md`, and it does not add a second copy of existing harness capabilities:

- Reusable workflow skills remain in `.agents/skills/`.
- Codex agent roles remain in `.codex/agents/`.
- Shared MCP configuration remains in `.mcp.json`.
- CI and tool-native hooks remain in their existing tool directories.

Use `rules/` for topic policies, `decisions/` for durable approved decisions, and `learnings.md` for evidence-backed observations awaiting promotion or removal. If instructions conflict, follow the precedence defined in `AGENTS.md` and use the more restrictive rule.
