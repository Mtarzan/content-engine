$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/content_engine?schema=public"
}

npm.cmd run build
npm.cmd audit --omit=dev
npx.cmd prisma validate
docker compose config | Out-Null

$temporaryEnvCreated = $false
if (-not (Test-Path -LiteralPath ".env")) {
  $temporaryEnvCreated = $true
  @"
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/content_engine?schema=public
SHOPIFY_STORE_URL=https://example.myshopify.com
SHOPIFY_ADMIN_TOKEN=dummy
SHOPIFY_WEBHOOK_SECRET=dummy
SUPABASE_URL=https://example.supabase.co
SUPABASE_SERVICE_ROLE_KEY=dummy
OPENAI_API_KEY=dummy
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_REFERER=https://content-engine.ne-xio.net
OPENAI_TITLE=Content Engine
ADMIN_API_KEY=12345678901234567890123456789012
ALLOWED_ORIGINS=https://content-engine.ne-xio.net
OPENAI_MODEL=gpt-4o-mini
PUBLISHER_MODE=mock
META_GRAPH_VERSION=v19.0
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=
WORKER_ENABLED=true
"@ | Set-Content -LiteralPath ".env" -NoNewline
}

try {
  docker compose -f docker-compose.prod.yml config | Out-Null
} finally {
  if ($temporaryEnvCreated) {
    Remove-Item -LiteralPath ".env" -Force
  }
}

Write-Host "Release verification passed."
