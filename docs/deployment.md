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
  - `SHOPIFY_WEBHOOK_SECRET`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`
  - `OPENAI_REFERER`
  - `OPENAI_TITLE`
  - `ADMIN_API_KEY`
  - `OPENAI_MODEL`
  - `WORKER_ENABLED`
  - `ALLOWED_ORIGINS`
  - `PUBLISHER_MODE`
  - `META_GRAPH_VERSION`
  - `FACEBOOK_PAGE_ID`
  - `FACEBOOK_PAGE_ACCESS_TOKEN`

## Deployment Topology

- Runtime: Docker Compose on the VM. Use `docker-compose.yml` for the bundled Postgres deployment, or `docker-compose.prod.yml` when a Supabase Postgres `DATABASE_URL` is available.
- API: Express app listening on container port `3000`, bound on the VM as `127.0.0.1:3003`
- Database: Supabase Postgres through `DATABASE_URL`
- Public access: Cloudflare proxied DNS record to the VM ingress path
- Direct Compose port bindings are localhost-only; expose public access through Cloudflare or a local reverse proxy.
- Scheduler: in-process cron worker enabled with `WORKER_ENABLED=true`

For production, prefer Supabase Postgres when a `DATABASE_URL` is available. The bundled Postgres service is internal-only and is the fallback deployment path.

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
   docker compose up -d --build
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
docker compose restart app
```

For a full rebuild:

```bash
docker compose up -d --build
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
   docker compose up -d --build
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
- no public Postgres binding

## Deployment Record

- GitHub repository: `https://github.com/Mtarzan/content-engine`
- Current deployed commit: `7bcb70c`
- Previous deployed archive tag: not applicable, first deployment
- VM path: `/opt/apps/content-engine`
- Public hostname: `https://content-engine.ne-xio.net`
- Operator dashboard: `https://content-engine.ne-xio.net/`
- Restart method: `cd /opt/apps/content-engine && docker compose restart app`
- Archive method: first deployment has no previous archive; future deployments use `archive/content-engine-YYYYMMDD-HHMM`
- Cloudflare method: DNS CNAME `content-engine.ne-xio.net` to tunnel `e07558be-d261-4169-9652-6312dae218ca`, served by container `cloudflared-content-engine`
- Local health: `curl -fsS http://127.0.0.1:3003/health`
- Public health: `curl -fsS https://content-engine.ne-xio.net/health`
- Frontend check: `curl -fsS https://content-engine.ne-xio.net/ | grep 'Content Engine'`
- Dashboard API check: `curl -H "x-admin-api-key: $ADMIN_API_KEY" https://content-engine.ne-xio.net/admin/overview`
- AI provider: OpenAI-compatible provider via `OPENAI_BASE_URL`
- Conversion attribution: Shopify orders-paid webhook at `/webhooks/shopify/orders-paid`
- Publisher mode: configured by `PUBLISHER_MODE`
- Deployment timestamp: `2026-05-03 15:40 UTC`
- Operator: Codex
