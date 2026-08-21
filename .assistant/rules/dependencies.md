# Dependency policy

- Use pnpm and keep `pnpm-lock.yaml` synchronized with manifest changes.
- Prefer existing workspace packages and dependencies before adding another library.
- Obtain Project owner (ABADO) approval before adding a new runtime dependency or changing a dependency in a protected surface.
- Check maintenance status, license compatibility, package provenance, and known security advisories.
- Pin or constrain versions consistently with the repository's existing convention.
- Do not install packages through remote shell pipelines such as `curl | sh`.
- Keep dependency changes focused; do not combine broad upgrades with unrelated feature work.
- Run the appropriate audit, tests, type checks, and build after dependency changes, and document unresolved advisories.
