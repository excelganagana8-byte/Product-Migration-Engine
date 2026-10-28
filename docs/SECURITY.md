# Security model and deployment notes

PME's first release is intended for a single trusted administrator on a self-hosted instance. It is not a public multi-tenant service.

- Configure a high-entropy `PME_ADMIN_TOKEN`; all protected API calls use `x-pme-admin-token`.
- Set `CREDENTIAL_ENCRYPTION_KEY` to exactly 32 random bytes encoded as 64 hex characters. Keep it separate from PostgreSQL and database backups. Losing it makes saved credentials undecryptable; rotating it requires a deliberate re-encryption procedure (not yet implemented).
- Saved credentials use AES-256-GCM with a fresh 12-byte nonce and authentication tag.
- Use dedicated store API credentials with minimum necessary scopes/permissions. Shopify typically requires `read_products` for product data and may require `read_inventory` for inventory quantities, depending on the fields and app configuration. WooCommerce product migration requires product read/write access. Verify requirements against current platform documentation and app configuration.
- Use HTTPS, firewall rules, access-controlled hosting, secret management and database backups in production. The provided Compose port bindings are localhost-only.
- Store URL validation requires HTTPS by default and blocks obvious private/internal addresses, including DNS results that resolve to private ranges. DNS rebinding and proxy-layer SSRF are not fully eliminated; do not accept untrusted arbitrary URLs in a public service. `ALLOW_PRIVATE_STORE_URLS=true` disables these restrictions for trusted local development only.
- Logs should contain migration identifiers and sanitized platform errors, never raw credentials. Do not paste secrets into issues or chat.
- PME writes destination product data. No full rollback is implemented. Use disposable development stores until the full workflow has been verified.
- The admin token is a shared secret, not a full user-management system. Do not expose this API to untrusted users.
