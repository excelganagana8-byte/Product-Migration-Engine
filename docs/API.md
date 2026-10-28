# API reference (initial)

The API is JSON-based. Send `x-pme-admin-token: <PME_ADMIN_TOKEN>` for protected endpoints. Do not include credentials in URLs. Error responses use `{ "error": "..." }`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Process health; no credentials required |
| GET | `/api/ready` | Database readiness |
| GET | `/api/connections` | List connection metadata; secrets omitted |
| POST | `/api/connections` | Save encrypted connection credentials |
| POST | `/api/connections/:id/test` | Test platform access |
| DELETE | `/api/connections/:id` | Delete connection (database constraints may reject deletion when jobs refer to it) |
| POST | `/api/scan` | Read and summarize Shopify products |
| POST | `/api/preview` | Read-only product preview; does not write to WooCommerce |
| POST | `/api/jobs` | Create a queued job and snapshot source product IDs |
| GET | `/api/jobs` | List recent jobs |
| GET | `/api/jobs/:id` | Read persisted job state and recent log events |
| GET | `/api/jobs/:id/items?status=FAILED` | List job items, optionally filtered by state |
| POST | `/api/jobs/:id/cancel` | Request worker cancellation |
| POST | `/api/jobs/:id/retry-failed` | Requeue failed items |
| GET | `/api/jobs/:id/report.json` | Download job, item and log data as JSON |
| GET | `/api/jobs/:id/report.csv` | Download item outcomes as CSV |

## Connection payloads

Shopify: `{ "name":"Store A", "platform":"SHOPIFY", "storeUrl":"https://example.myshopify.com", "credentials":{"accessToken":"…","apiVersion":"2025-10"} }`

WooCommerce: `{ "name":"Store B", "platform":"WOOCOMMERCE", "storeUrl":"https://example.com", "credentials":{"consumerKey":"ck_…","consumerSecret":"cs_…"} }`

Credentials are accepted only over the API request body, encrypted before persistence and never returned in responses. API version can be omitted to use the default in the adapter.

## Important current limitations

This is an initial API contract, not a claim of production completeness. The job currently snapshots product IDs at creation and the worker re-reads the Shopify catalog when processing. Product variations are not yet created as separate WooCommerce variation records, and product-image URL ingestion depends on WooCommerce accepting the remote image source. Live-store E2E validation remains required.
