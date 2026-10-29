# Crunchadmin

Centro operativo del restaurante: **mapa 3D interactivo del local**, **pendientes por zona**, **recetas con versiones y escalado**, **menú multi-plataforma** (Foodie / tienda propia) y **chat** multimodal.

MVP en español sobre Next.js App Router + TypeScript + Tailwind + Prisma (SQLite local) + React Three Fiber.

## Arranque rápido

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — home = **nivel 3D tipo videojuego** (props Kenney CC0, sin techo, cutaway).

## Home 3D (zonas + assets)

Pendientes llevan `zone` (`pared_entrada`, `cocina`, `salon`, `barra`, `exterior`, `bano`, `oficina`). Props GLB de **Kenney Furniture Pack** (CC0; ver `public/models/kenney/CREDITS.md`). Hover/click con brillo y anillo; cámara hace zoom a la zona. Tareas abiertas marcan props (pared roja, cajas en cocina, etc.); al marcar `HECHO` se limpian. Zoom lejano: `maxDistance` ~32. Sin ubicación física → `oficina`.

**Crédito assets:** [Kenney.nl](https://kenney.nl) Furniture Pack — CC0 (vía [OpenGameArt](https://opengameart.org/content/furniture-kit)).

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y producción |
| `npm test` | Tests del motor de escalado |
| `npm run db:seed` | Datos demo (mayonesa 1 kg → 1,8 kg) |
| `npm run db:studio` | Prisma Studio |

## Módulos

- **Inicio 3D** — escena low-poly con auto-rotación, órbita táctil y pendientes anclados a zonas.
- **Pendientes** — CRUD por categoría + selector de zona; filtros por zona.
- **Recetas** — ficha + versiones; **escalado** desde rendimiento o cualquier ingrediente base (conversión g/kg, ml/L).
- **Menú** — ítem base + specs Foodie / tienda propia (pestañas).
- **Chat** — texto + subida de imagen/archivo; OpenAI si hay `OPENAI_API_KEY`, si no stub amable.
- **Recordatorios / adjuntos de pendientes** — modelos listos; UI mínima / stub.

## Escalado (ejemplo seed)

Receta *Mayonesa casa* con rendimiento **1 kg**. Al escalar a **1,8 kg** (factor 1,8):

| Ingrediente | Original | Escalado |
|-------------|----------|----------|
| Aceite | 700 g | 1260 g |
| Yema | 150 g | 270 g |
| Mostaza | 50 g | 90 g |
| Vinagre | 80 g | 144 g |
| Sal | 20 g | 36 g |
| Pimienta | a gusto | no escala |

También puedes elegir p. ej. aceite 700 g → 1260 g como base y obtener el mismo factor.

## Variables de entorno

Ver `.env.example`:

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | SQLite `file:./dev.db` o PostgreSQL en prod |
| `OPENAI_API_KEY` | Opcional — chat real |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |
| `NEXTAUTH_*` / `CLERK_*` / `NEXT_PUBLIC_SUPABASE_*` | Auth (opcional; MVP single-operator) |

## Auth

Estructura lista en `src/lib/auth.ts` (`getCurrentUser`). Sin login en MVP: un solo operador. Conecta NextAuth, Clerk o Supabase Auth cuando quieras cerrar el acceso.

## Fuera de alcance (MVP)

App nativa, POS, inventario en tiempo real, multi-tenant, email/push.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 5 · React Three Fiber / drei · Vitest · OpenAI SDK
