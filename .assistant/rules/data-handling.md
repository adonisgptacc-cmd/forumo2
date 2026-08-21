# Data handling policy

Use the least-sensitive data and least-privileged access that can complete the task.

| Environment | Default data and access                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Local/test  | Synthetic fixtures; isolated writable resources                                                                |
| Staging     | Synthetic or anonymized data; read-only unless the task requires a scoped mutation                             |
| Production  | No access by default; explicit approval for read-only access and separate explicit approval for every mutation |

- Never send raw customer records, credentials, access tokens, payment details, KYC documents, private messages, production database dumps, or confidential business data to an AI service.
- Minimize fields, redact identifiers, aggregate where possible, and respect retention requirements.
- Do not copy production data into local fixtures. Create representative synthetic data instead.
- Keep secrets in approved environment or secret-management systems, never prompts, source files, logs, screenshots, or decision records.
- Confirm the destination, authorization, and rollback or recovery path before any data export, import, backfill, deletion, or migration.
