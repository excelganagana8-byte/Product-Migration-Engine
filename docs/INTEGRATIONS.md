# Platform integration guide

Adapters translate external platform records to PME's normalized model in `backend/src/types/product.ts`.

## Shopify source

`backend/src/adapters/shopify/client.ts` uses the Shopify Admin GraphQL API, product cursor pagination and an access token header. Start with a development store and the minimum product-read permission. Shopify GraphQL connection limits and API version support can change; test pagination, products with many variants, and rate-limit behavior against the chosen API version.

## WooCommerce destination

`backend/src/adapters/woocommerce/client.ts` uses WooCommerce REST API v3 and Basic authentication with a consumer key/secret. Use HTTPS. The current worker can create a product parent and attaches source IDs as WooCommerce metadata. **Variable product variation creation is not complete**; don't consider variable products fully migrated until that implementation is added and tested. Remote image URL ingestion must also be verified against the target site.

## Add another adapter

1. Define its credentials and connection-test operation.
2. Implement cursor/page pagination with timeouts, rate-limit handling and retry/backoff.
3. Normalize its records into the common internal product model.
4. Implement explicit destination mapping and unsupported-field warnings.
5. Add mocked tests for pagination, transformation, rate limits and failure recovery.
6. Update API docs, README supported-platform matrix and the safe test-store workflow.

Never copy raw platform objects directly to another platform or log credentials.
