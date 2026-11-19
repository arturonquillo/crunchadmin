# Ads module — Hostinger deploy

Stable app: **https://test2.lecrunch.com.br** · path `/opt/crunchadmin`  
Full plan: project store `docs/ads-module-plan.md`.

## 1. Secrets (owner — never commit)

Add to `/opt/crunchadmin/.env` **and** Cursor Secrets (dashboard):

| Variable | Required for real OAuth |
| --- | --- |
| `META_APP_ID` | Yes |
| `META_APP_SECRET` | Yes |
| `APP_BASE_URL=https://test2.lecrunch.com.br` | Yes (redirect) |
| `META_GRAPH_API_VERSION=v22.0` | Optional |
| `META_OAUTH_STATE_SECRET` | Optional |
| `OPENAI_API_KEY` | Hablar ads tools |

Without `META_APP_ID`/`META_APP_SECRET`, `/ads` still works with **Usar datos demo (mock)**.

## 2. Meta Developer Console

1. App → Facebook Login → Valid OAuth Redirect URIs:
   - `https://test2.lecrunch.com.br/api/ads/oauth/callback`
   - `http://localhost:3000/api/ads/oauth/callback`
2. Marketing API / permissions: `ads_read`, `ads_management` (Development Mode: add restaurant user as app role + ad account Admin/Advertiser).
3. Advanced Access / App Review only when serving users outside the app roles.

## 3. Deploy steps

```bash
cd /opt/crunchadmin
git fetch origin
git checkout <branch-or-main>
git pull
npm ci
# Apply MetaConnection migration on BOTH DBs
DATABASE_URL="file:/opt/crunchadmin/data/demo.db" npx prisma migrate deploy
DATABASE_URL="file:/opt/crunchadmin/data/prod.db" npx prisma migrate deploy
npm run build
systemctl restart crunchadmin
```

Keep existing:

```
DATABASE_URL_DEMO=file:/opt/crunchadmin/data/demo.db
DATABASE_URL_PROD=file:/opt/crunchadmin/data/prod.db
```

## 4. Smoke

1. Open https://test2.lecrunch.com.br/ads (drawer → Anuncios).
2. Mock connect **or** real OAuth if secrets present.
3. Select ad account → last 7d hierarchy (spend/CTR/CPC/CPA) → pause/enable.
4. Hablar: «¿cómo van los anuncios?» / «dame el reporte diario de ads».

## 5. Dev vs Prod

Connection tokens live in the active SQLite file (`demo.db` vs `prod.db`). Toggle in the drawer does not share Meta sessions across modes.
