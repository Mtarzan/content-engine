# Content Engine Deployment Runbook

This project is deployable, but deployment is not complete until the GitHub, VM, Cloudflare, and archive records below are filled with real production values.

## Required Production Inputs

- GitHub repository URL
- VM SSH host and user
- VM project path: `/opt/apps/content-engine`
- Public hostname: `content-engine.ne-xio.net`
- Cloudflare zone and DNS access
- Production `.env` values:
  - `DATABASE_URL`
  - `SHOPIFY_STORE_URL`
  - `SHOPIFY_ADMIN_TOKEN`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `ADMIN_API_KEY`
  - `OPENAI_MODEL`
  - `WORKER_ENABLED`
  - `ALLOWED_ORIGINS`

## Deployment Topology

- Runtime: Docker Compose on the VM. Use `docker-compose.prod.yml` for production when Supabase Postgres is the database.
- API: Express app listening on container port `3000`, bound on the VM as `127.0.0.1:3003`
- Database: Supabase Postgres through `DATABASE_URL`
- Public access: Cloudflare proxied DNS record to the VM ingress path
- Direct Compose port bindings are localhost-only; expose public access through Cloudflare or a local reverse proxy.
- Scheduler: in-process cron worker enabled with `WORKER_ENABLED=true`

For production, prefer Supabase Postgres and do not expose the Compose `postgres` service publicly. The included local Postgres service is bound to localhost only and is for development and fallback operation.

## Release Procedure

1. Confirm local validation passes:

   ```bash
   powershell -ExecutionPolicy Bypass -File scripts/verify-release.ps1
   ```

2. Commit and push the current version to GitHub:

   ```bash
   git add .
   git commit -m "Release content engine"
   git push origin main
   ```

3. Archive the previously deployed version in GitHub before replacing it.

   Recommended archive format:

   ```bash
   git tag archive/content-engine-YYYYMMDD-HHMM <previous-deployed-sha>
   git push origin archive/content-engine-YYYYMMDD-HHMM
   ```

4. Keep only the latest 10 deployment archive tags for this project.

5. On the VM, clone or update the repository:

   ```bash
   sudo mkdir -p /opt/apps/content-engine
   sudo chown "$USER":"$USER" /opt/apps/content-engine
   git clone <github-repository-url> /opt/apps/content-engine
   cd /opt/apps/content-engine
   ```

6. Create the production `.env` file on the VM. Do not commit it.

7. Start or replace the service:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

   After the first clone, future VM updates can use:

   ```bash
   APP_DIR=/opt/apps/content-engine sh scripts/deploy-vm.sh <github-repository-url> main
   ```

8. Verify health from the VM:

   ```bash
   curl -fsS http://localhost:3000/health
   ```

9. Configure Cloudflare:

   - Create proxied DNS record for `content-engine.ne-xio.net`.
   - Route traffic to the VM through the approved Cloudflare ingress method.
   - Do not treat direct VM IP access as final delivery.

10. Verify public health:

    ```bash
    curl -fsS https://content-engine.ne-xio.net/health
    ```

## Restart Method

From the VM project path:

```bash
docker compose -f docker-compose.prod.yml restart app
```

For a full rebuild:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Rollback Procedure

1. Identify the previous archive tag:

   ```bash
   git tag --list "archive/content-engine-*"
   ```

2. Check out the target archive on the VM:

   ```bash
   cd /opt/apps/content-engine
   git fetch --tags
   git checkout <archive-tag>
   ```

3. Recreate containers:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. Verify:

   ```bash
   curl -fsS http://localhost:3000/health
   curl -fsS https://content-engine.ne-xio.net/health
   ```

## Firewall Checks

On the VM, confirm public ports are limited to the approved ingress path:

```bash
sudo ss -tulpn
sudo ufw status verbose
```

Expected direct bindings from this project:

- `127.0.0.1:3003` for the API container
- no public `0.0.0.0:3000`
- no public `0.0.0.0:5432`

## Deployment Record

Fill this section after a real deployment.

- GitHub repository:
- Current deployed commit:
- Previous deployed archive tag:
- VM path:
- Public hostname:
- Restart method:
- Archive method:
- Deployment timestamp:
- Operator:
