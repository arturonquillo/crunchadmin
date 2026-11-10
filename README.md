# Crunchadmin

Centro operativo del restaurante: **pendientes**, **recetas con versiones y escalado**, **menú multi-plataforma** (Foodie / tienda propia) y **chat** multimodal.

MVP en español sobre Next.js App Router + TypeScript + Tailwind + Prisma (SQLite local).

## Arranque rápido

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y producción |
| `npm test` | Tests del motor de escalado |
| `npm run db:seed` | Datos demo (mayonesa 1 kg → 1,8 kg) |
| `npm run db:studio` | Prisma Studio |

## Módulos

- **Pendientes** — CRUD por categoría (mejoras físicas, compras, planes, insumos, nuevas recetas), estado y prioridad.
- **Recetas** — ficha + versiones; **escalado** desde rendimiento o cualquier ingrediente base (conversión g/kg, ml/L).
- **Menú** — ítem base + specs Foodie / tienda propia (pestañas).
- **Chat** — texto + subida de imagen/archivo; OpenAI si hay `OPENAI_API_KEY`, si no stub amable.
- **QR** — códigos cortos `/qr/abc123` con destino editable y conteo de lecturas. El impreso no cambia si cambia la URL final.
- **Sitio** — nombre, contacto, redes, horario y aviso. El sitio público los lee en `GET /api/public/site`.
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
| `NEXT_PUBLIC_SITE_URL` | Origen de los QR impresos. Default `https://lecrunch.com.br` |
| `ADMIN_PASSWORD` | Opcional. Si está definida, el panel pide contraseña. `/qr/...` sigue público |
| `NEXTAUTH_*` / `CLERK_*` / `NEXT_PUBLIC_SUPABASE_*` | Auth (opcional; MVP single-operator) |

## Códigos QR

Crear un código en **QR** genera un enlace fijo:

`https://lecrunch.com.br/qr/abc123` → destino actual (por ejemplo `https://instagram.com/_lecrunch`).

Cada apertura con `GET` suma una lectura (fecha y tipo de dispositivo). Cambiar el destino responde con un redirect **302**, así los QR ya impresos pasan a la URL nueva sin reimprimir. Pausar un código deja de redirigir.

Si el sitio público y este panel no son el mismo proceso, el dominio tiene que enviar `/qr/` a esta app:

```nginx
location /qr/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
}
```

## Auth

Estructura lista en `src/lib/auth.ts` (`getCurrentUser`). Sin `ADMIN_PASSWORD` el panel queda abierto (un solo operador). Con la variable, todo el panel pide contraseña y los redirects públicos siguen abiertos. Conecta NextAuth, Clerk o Supabase Auth cuando quieras cuentas por persona.

## Fuera de alcance (MVP)

App nativa, POS, inventario en tiempo real, multi-tenant, email/push.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 5 · Vitest · OpenAI SDK
