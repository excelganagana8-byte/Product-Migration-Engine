# Product Migration Engine (PME)

Open-source, self-hosted tooling for migrating supported product data from **Shopify to WooCommerce and later other e-commerce platforms**. PME is a migration utility, not a store builder or hosted multi-user SaaS.

> **Status: early implementation.** The repository includes a runnable UI/API foundation, encrypted connection storage, platform access checks, Shopify product retrieval, product mapping, a database-backed job model, and a worker foundation. It has **not** been verified end-to-end against live stores. Do not use it on a production store until you have tested with disposable development stores and reviewed the limitations below.

## What is implemented in this starter

- React + TypeScript UI with connection, scan, preview, jobs and status surfaces.
- Express + TypeScript API with admin-token protection, request validation, Helmet, rate limiting and credential redaction.
- PostgreSQL + Prisma schema for connections, jobs, job items, source/destination mappings and log events.
- AES-256-GCM encryption for stored connection credentials (encryption key supplied separately through the environment).
- Shopify Admin GraphQL product pagination and WooCommerce REST API connection checks/product creation primitives.
- Shopify-to-internal product normalization and WooCommerce payload mapping.
- Worker process that claims queued jobs with PostgreSQL row locking and records item outcomes.
- Docker Compose, tests for core transformation and setup docs.

## Not yet production-verified

- Full variable-product/variation creation, image transfer and association, robust post-migration verification, and retry after every possible crash window need additional end-to-end testing and hardening before production use.
- Live Shopify/WooCommerce credentials are not included, so live-store behavior is **implemented in parts but unverified against a live store**.
- The UI is a functional first pass, not a final accessibility/security audit.
- No rollback is provided. Logs and retries are not rollback.
- No hosted multi-user deployment, OAuth app flow, customer/order migration, collection/category migration, mobile app or additional marketplace adapters.

## Requirements

- Node.js 20+
- Docker and Docker Compose (recommended), or PostgreSQL 15+
- Shopify development store and Shopify Admin API access token with the minimum required read-products scope (typically `read_products`; verify current Shopify requirements for your app type).
- WooCommerce store with HTTPS and a REST API key with **Read/Write** permissions for product migration.

## Quick start with Docker

1. Copy `.env.example` to `.env`.
2. Replace the database password, `PME_ADMIN_TOKEN`, and `CREDENTIAL_ENCRYPTION_KEY`. Generate the encryption key with `openssl rand -hex 32` (exactly 64 hex characters).
3. Start the services:

   ```bash
   docker compose up --build
   ```

4. Open the UI at `http://localhost:5173`. The UI asks for the admin token, which is sent in the `x-pme-admin-token` header and stored only in the current browser session.
5. API health check: `http://localhost:4000/api/health`.

Docker Compose runs migrations before starting the API/worker. If startup fails, check `docker compose logs -f`.

For a step-by-step Windows walkthrough, see [`docs/WINDOWS-SETUP.md`](docs/WINDOWS-SETUP.md).

## Local development

```bash
cp .env.example .env
# Set DATABASE_URL to your local PostgreSQL instance and fill in secrets.
npm install
npm run db:generate -w backend
npm run db:migrate -w backend
npm run dev
```

For backend commands, run from the repository root. `npm run db:migrate -w backend` creates the local development schema. The root `npm run build`, `npm test`, and `npm run typecheck` scripts run workspace tasks.

## API overview

All `/api/*` endpoints except `/api/health` and `/api/ready` require `x-pme-admin-token` when `PME_ADMIN_TOKEN` is configured.

- `GET /api/health`, `GET /api/ready`
- `GET /api/connections`, `POST /api/connections`, `POST /api/connections/:id/test`, `DELETE /api/connections/:id`
- `POST /api/scan` (source connection ID)
- `POST /api/preview` (source connection ID, destination connection ID)
- `POST /api/jobs`, `GET /api/jobs`, `GET /api/jobs/:id`, `POST /api/jobs/:id/cancel`, `POST /api/jobs/:id/retry-failed`
- `GET /api/jobs/:id/items`, `GET /api/jobs/:id/report.json`, `GET /api/jobs/:id/report.csv`

See [`docs/API.md`](docs/API.md) and [`docs/SECURITY.md`](docs/SECURITY.md).

## Security notes

- Credentials are encrypted before persistence and never returned by the API. Set a strong encryption key and keep it separate from the database backup.
- This is a single-admin, self-hosted starting point. Do not expose it directly to the public internet. Use HTTPS, an authenticated reverse proxy, firewall rules, backups and restricted access.
- Store URLs are validated; private/internal addresses are blocked by default. For local WooCommerce test setups only, set `ALLOW_PRIVATE_STORE_URLS=true` in a trusted local environment.
- Use dedicated test stores first. Product creation writes to the destination. This tool does not promise rollback.

## Roadmap

- [x] App foundation, API health/readiness, connection storage, core product mapping
- [x] Initial Shopify product scan and WooCommerce connection test
- [x] Database job schema and worker foundation
- [ ] Complete variable products/variations and image transfer end to end
- [ ] Full crash-window idempotency and safe failed-item retry verification
- [ ] Full source/destination discrepancy report and live test-store E2E suite
- [ ] Accessibility/security review and release hardening
- [ ] Categories/collections, customers/orders, SEO/redirects, reviews and other adapters

## License

MIT is selected to make adoption, modification and contributions straightforward, including commercial use. It is permissive and does not require distributors to publish modifications; projects seeking stronger source-sharing obligations could consider a copyleft license such as AGPL instead. See [`docs/LICENSE-CHOICE.md`](docs/LICENSE-CHOICE.md).
