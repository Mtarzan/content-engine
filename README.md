# Content Engine

Production-ready TypeScript service that syncs Shopify products, stores them in PostgreSQL through Prisma, generates social content with OpenAI, and keeps publish-ready posts in the database.

## Stack

- Node.js, TypeScript, Express
- Prisma ORM
- PostgreSQL, compatible with Supabase Postgres
- Docker and Docker Compose
- OpenAI Responses API with strict JSON schema output

## Environment

Copy `.env.example` to `.env` and set real values.

`DATABASE_URL` is required by Prisma. For Supabase, use the Supabase Postgres connection string from Project Settings -> Database. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are validated because they are part of the deployment contract, but database access is performed through Prisma.

Required variables:

```bash
DATABASE_URL=
SHOPIFY_STORE_URL=
SHOPIFY_ADMIN_TOKEN=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ADMIN_API_KEY=
```

Optional variables:

```bash
PORT=3000
OPENAI_MODEL=gpt-4o-mini
WORKER_ENABLED=true
ALLOWED_ORIGINS=https://content-engine.ne-xio.net
```

## Run Locally

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Release validation:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-release.ps1
```

API runs on `http://localhost:3000`.

## Run With Docker

```bash
docker compose up --build
```

The compose file starts:

- `app` on port `3000`
- `postgres` on port `5432`

Production with Supabase Postgres:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Worker

The embedded worker runs every 30 minutes when `WORKER_ENABLED=true`.

Worker behavior:

1. Fetch products from `GET /admin/api/2024-01/products.json`
2. Upsert products into PostgreSQL
3. Find unprocessed products
4. Generate three social posts per product
5. Store posts as `pending`
6. Mark products as processed

Manual one-shot run:

```bash
npm run worker
```

## API

### Health

```bash
GET /health
```

Returns database-aware health status.

### List Posts

```bash
GET /posts
GET /posts?status=pending
GET /posts?status=posted
X-Admin-Api-Key: <ADMIN_API_KEY>
```

### Publish Post

```bash
POST /posts/:id/publish
X-Admin-Api-Key: <ADMIN_API_KEY>
```

The current publisher is a mock implementation. It logs the outgoing post and marks it as `posted`. The module boundary is ready for Meta and TikTok API clients.

## Database Models

### Product

- `id`
- `title`
- `description`
- `price`
- `image_url`
- `processed`

### ContentPost

- `id`
- `product_id`
- `platform`
- `caption`
- `image_url`
- `status`
- `created_at`

## Production Notes

- Missing or invalid environment variables fail startup.
- Secrets are never logged intentionally and known secret fields are redacted.
- Shopify and OpenAI failures are logged per product so one failed product does not stop the whole worker run.
- The worker has an in-process overlap guard. For multi-instance deployments, move scheduling to a single worker process or add a distributed lock.
- Deployment runbook: `docs/deployment.md`.
