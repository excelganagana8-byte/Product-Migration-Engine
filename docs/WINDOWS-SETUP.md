# Windows setup (beginner-friendly)

## Recommended: Docker Desktop

1. Install Docker Desktop for Windows and make sure it is running.
2. Extract the project ZIP to a new folder, for example `C:\Users\YOUR_USER\product-migration-engine-build`. **Do not extract over your existing repository**; compare/merge later if you want to keep the Git history you already have.
3. In VS Code, choose **File → Open Folder** and open that extracted folder.
4. In the VS Code terminal, create the environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

5. Generate random values for the database password, admin token and encryption key. Run this three times, saving each output somewhere private:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Put one generated value in `POSTGRES_PASSWORD`, one in `PME_ADMIN_TOKEN`, and one in `CREDENTIAL_ENCRYPTION_KEY`. Use the generated hex values for the database password to avoid URL-encoding problems. The encryption key must be 64 hexadecimal characters. Update the password inside `DATABASE_URL` if you plan to run the backend outside Docker; Compose builds its own URL from `POSTGRES_PASSWORD`.

6. Start the stack:

   ```powershell
   docker compose up --build
   ```

   The first build downloads container images and Node packages, so it can take several minutes. Leave this terminal running.

7. Open `http://localhost:5173`. Enter the `PME_ADMIN_TOKEN` value you put in `.env`. The API health endpoint is `http://localhost:4000/api/health`.
8. Connect a Shopify development store and a WooCommerce test store. Use disposable test data first; this early build is not verified for production migration.

## If Docker is not available

Install Node.js 20+ and PostgreSQL 15+. Create `.env`, set `DATABASE_URL` to your PostgreSQL database, and fill in the admin/encryption secrets. Then run:

```powershell
npm install
npm run db:generate --workspace=backend
npm run db:migrate --workspace=backend
npm run dev
```

This local mode requires PostgreSQL to be running. For local HTTP WooCommerce only, `ALLOW_PRIVATE_STORE_URLS=true` may be used in a trusted development environment; never use that setting on a public deployment.

## If it fails

- Run `docker compose ps` to see which services are up.
- Run `docker compose logs -f backend worker migrate` to inspect sanitized errors.
- If you changed the database password after the database volume was initialized, the stored PostgreSQL password may not match; do not delete the volume unless you understand that it deletes the local database.
- Never share `.env`, access tokens, consumer secrets or real customer data in screenshots or public issues.
