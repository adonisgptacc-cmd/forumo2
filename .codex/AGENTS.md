# Codex configuration guidance

The root `AGENTS.md` is the canonical policy for project work. Root `CLAUDE.md` is only a tool entry point and cannot override it.

- Keep this directory project-local and portable.
- Resolve agent `config_file` paths relative to `.codex/config.toml`.
- Keep cxpak pinned and checksum-verified through `scripts/setup-cxpak.ps1`.
- Do not add broad ECC MCP catalogs, hooks, or legacy command shims here.
- Preserve the existing codebase-memory integration; cxpak is complementary.
