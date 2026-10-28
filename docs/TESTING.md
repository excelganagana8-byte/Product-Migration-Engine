# Testing and safe end-to-end workflow

## Automated tests

Run `npm test -w backend` and `npm run typecheck` from the repository root after `npm install`. Current unit coverage exercises core product mapping and warnings. The job-worker test is a minimal contract check, not a substitute for a database-backed recovery test. Pagination, retry/backoff, crash-window idempotency, credential redaction and full worker-resume integration tests remain to be expanded.

## Safe live test setup

1. Create a Shopify development store with a small catalog including simple products, variable products, missing SKUs, multiple images, draft/archived products and HTML descriptions.
2. Run a disposable WooCommerce test site over HTTPS or a trusted local Docker network. For local HTTP only, set `ALLOW_PRIVATE_STORE_URLS=true` in a development-only `.env`.
3. Create dedicated API credentials and configure the PME connection screen. Never use production credentials in test logs or CI.
4. Test the connection and run a scan. Inspect product and variant counts before previewing.
5. Review warnings and test on a fresh destination. Confirm product values, media, stock and variation behavior manually.
6. Interrupt the worker during a migration and verify item state, destination metadata and retry behavior before using any real catalog.
7. Export the JSON/CSV report and compare the source catalog with the destination.

Do not use this release on a production store until variation/image behavior and crash-window idempotency are verified end to end.
