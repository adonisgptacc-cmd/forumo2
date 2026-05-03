# Forumo Project — Claude Instructions

## Superpowers Plugin

This project uses the [superpowers](https://github.com/obra/superpowers) plugin (v5.0.7). Skills are located in `.claude/skills/`. Always invoke the `using-superpowers` skill at the start of each session to load the skill framework.

Available skills:
- `using-superpowers` — meta-skill: how to find and use skills
- `brainstorming` — design-first workflow before any implementation
- `writing-plans` — create detailed implementation plans
- `executing-plans` — execute plans with review checkpoints
- `test-driven-development` — TDD: write failing test first, always
- `systematic-debugging` — root cause analysis before any fix
- `requesting-code-review` — dispatch code reviewer subagents
- `receiving-code-review` — respond to review feedback with rigor
- `finishing-a-development-branch` — merge, PR, or discard with verification
- `subagent-driven-development` — fresh subagent per task + two-stage review
- `dispatching-parallel-agents` — parallel independent investigations
- `using-git-worktrees` — isolated workspaces for feature development
- `verification-before-completion` — evidence before any completion claim

## Preview / Dev Server Verification

**Never start a dev server or run the preview verification workflow** (preview_start, preview_snapshot, preview_screenshot, etc.) after editing code. This project does not require browser verification checks. Skip the check entirely and end the turn after edits are complete.
