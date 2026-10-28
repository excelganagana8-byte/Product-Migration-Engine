# Contributing

Thanks for helping improve PME. Please open an issue before a large change and describe the migration scenario and expected behavior.

## Development

- Use Node.js 20+ and PostgreSQL 15+.
- Run `npm install`, `npm run typecheck`, and `npm test` before opening a PR.
- Add tests for mapping, retry, pagination, and failure behavior where relevant.
- Never commit store credentials, access tokens, database dumps, or customer data.
- Keep API behavior and supported/unsupported fields documented. Do not describe mocked behavior as a working integration.

## Pull requests

Keep changes focused, include reproduction steps for fixes, and update README/docs when supported behavior changes. Security issues should be reported privately to the repository maintainers rather than disclosed in a public issue.
