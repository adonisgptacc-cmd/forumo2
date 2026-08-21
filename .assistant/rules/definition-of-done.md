# Definition of Done

A change is complete when all applicable conditions are met:

- Acceptance criteria and expected failure behavior are implemented.
- New behavior has focused unit tests plus relevant integration and end-to-end coverage.
- Formatting, linting, type checks, tests, and builds pass for affected workspaces.
- Security, authorization, privacy, observability, and error handling were reviewed.
- Contracts, API documentation, migrations, operational notes, and user documentation are updated where needed.
- The final diff is focused and contains no secrets, generated noise, or accidental unrelated changes.
- Required approval from Project owner (ABADO) is recorded for protected changes and separately for protected execution.
- Skipped checks, remaining risks, assumptions, and rollback steps are stated in the handoff.

Use `pnpm verify:quick` during iteration and `pnpm verify` before a release-grade handoff when the full suite is practical. Automated checks provide evidence; they cannot grant approval.
