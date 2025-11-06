# Hyperstack — Gateway + Auth Service (RS256, JWKS, Redis, Prisma)

Plataforma de autenticación mínima y lista para producción: un **Gateway HTTP (NestJS)** delante de un **Auth Service (NestJS + Prisma + Redis)** que emite y valida **JWT RS256** (access/refresh) con **rotación deslizante** y **detección de reuso**. Incorpora **throttling** por **IP** y `x-device-id`, endpoints de **salud** y **métricas** para observabilidad, y **CI** con build y pruebas (unitarias/E2E).
**Objetivo**: proveer un esqueleto sólido y verificable para proyectos que necesiten login y gestión de sesiones con buenas prácticas desde el principio.

---

## Índice
- [Arquitectura](#arquitectura)
- [Requisitos](#requisitos)
- [Endpoints](#endpoints)
- [Quickstart (dev)](#quickstart-dev)
- [Flujos](#flujos)
- [Throttling](#throttling)
- [Seguridad (JWT/JWKS)](#seguridad-jwtjwks)
- [Tests](#tests)
- [Observabilidad](#observabilidad)
- [CI](#ci)
- [Troubleshooting](#troubleshooting)
- [Licencia](#licencia)

---

## Arquitectura
```
Client
  │
  │ HTTP (Bearer access)         ┌───────────────┐
  ├───────────────▶  Gateway  ──▶│  Auth Service │──┐
  │ /api/auth/*                  └───────────────┘   │
  │        │                     Prisma              │
  │        │              ┌─────────────────┐        │
  │        └─── JWKS ───▶│  /jwks.json      │        │
  │                       └─────────────────┘        │
  │                                                  ▼
  │                                          ┌──────────┐
  │                                          │ Postgres │
  │                                          └──────────┘
  │                                                 │
  │                                          ┌──────────┐
  └──────────────── Metrics/OTEL ───────────▶│  Redis  │
                                             └──────────┘

```
---
- **Gateway**: expone `/api/auth/*`, valida Access JWT con **JWKS** (RS256).
- **Auth Service**: emite Access/Refresh, sliding refresh, reuse-detection, sesiones en Redis.
- **Postgres**: usuarios.
- **Redis**: sesiones, locks y throttling.
- **Prometheus/OTEL**: métricas y trazas opcionales.

---

## Requisitos
- Node.js 20
- pnpm 9
- Docker (para Postgres/Redis/observabilidad)
- OpenSSL (para llaves dev)





## Endpoints

`GET /api/auth/health` — estado + deps (db/redis).

`POST /api/auth/register` `{ email, password, name? }` → 201.

`POST /api/auth/login` `{ email, password }` → accessToken, refreshToken.

`POST /api/auth/refresh` `{ refreshToken }` → rotación (sliding) + reuse-detection.

`POST /api/auth/logout` `{ refreshToken }` → invalida refresh.

`GET /api/auth/me` (Bearer access) → `{ id, email, name }`.

`GET /api/auth/.well-known/jwks.json` → JWKS público (RS256).

### Headers útiles

`x-device-id`: **obligatorio** para throttling/sesiones decentes.

`x-forwarded-for`: respeta IP del cliente detrás de proxy/LB.

## Quickstart (dev)

```bash
pnpm i

# Infra local
docker compose up -d postgres

# Llaves dev
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# Prisma
pnpm --filter @hyperstack/auth-service prisma:generate
AUTH_DATABASE_URL=postgres://hyperstack:hyperstack@localhost:5432/hyperstack_auth \
pnpm --filter @hyperstack/auth-service prisma migrate deploy

# Arranque
pnpm -w nx run @hyperstack/auth-service:serve
pnpm -w nx run @hyperstack/gateway:serve
 ```

### Smoke rápido
 ```bash
## Health
curl -sS http://localhost:3000/api/auth/health | jq

# Registro
curl -sS http://localhost:3000/api/auth/register \
  -H 'content-type: application/json' \
  -H 'x-device-id: dev-1' \
  -d '{"email":"user@test.local","password":"12345678","name":"User"}' | jq

# Login
LOGIN=$(curl -sS http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -H 'x-device-id: dev-1' \
  -d '{"email":"user@test.local","password":"12345678"}')
ACCESS=$(jq -r .accessToken <<<"$LOGIN")
REFRESH=$(jq -r .refreshToken <<<"$LOGIN")

# Me
curl -sS http://localhost:3000/api/auth/me \
  -H "authorization: Bearer $ACCESS" | jq

# Refresh (sliding)
ROT=$(curl -sS http://localhost:3000/api/auth/refresh \
  -H 'content-type: application/json' \
  -H 'x-device-id: dev-1' \
  -d "{\"refreshToken\":\"$REFRESH\"}")
ACCESS=$(jq -r .accessToken <<<"$ROT")
REFRESH=$(jq -r .refreshToken <<<"$ROT")

# Logout
curl -sS http://localhost:3000/api/auth/logout \
  -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq
 ```
# Flujos

- **Login** → crea sesión (Redis) y devuelve `access/refresh`.

- **Refresh** → rota el refresh (sliding). Reuso de refresh viejo -> **reuse-detection** y revoca la familia.

- **Logout** (por refresh) -> invalida ese refresh. `logout-all` existe en el servicio; el gateway expone lo esencial.


# Throttling

- Clave compuesta: `ruta+IP` y `ruta+deviceId`.

- Respuestas con `429` y header x-ratelimit-limit.

- `x-device-id` es obligatorio para clientes reales (móvil/web nativo).

- Respeta `x-forwarded-for` si hay LB/Ingress.

#### Archivos:

Gateway: `apps/gateway/src/infrastructure/security/throttling.ts`

Auth: `apps/auth-service/src/infrastructure/security/throttling.ts`


# Seguridad (JWT/JWKS)

- RS256 con llaves en `keys/` solo para **dev/CI**. En prod: KMS/HSM o secret manager y rotación real.

- JWKS: `GET /api/auth/.well-known/jwks.json` (expone kid = `JWT_KID`).

- `aud`/`iss` estrictos y TTLs configurables.

---

# Tests
 ```bash
## Unit
pnpm test:unit:auth
pnpm test:unit:gateway
pnpm test:unit     # ambos

## E2E mínimos (gateway)
pnpm test:e2e
 ```
#### Cubre:

- RS256 firma/verificación (auth-service).

- Validación de DTOs (`class-validator`).

- Throttling utils (gateway).

- E2E: health, login, refresh, logout, rotación y reuse-detection.

# Observabilidad

`/metrics` Prometheus (gateway y auth): latencias, contadores.

OTEL opcional vía `OTEL_EXPORTER_OTLP_ENDPOINT` (trazas de requests y deps db/redis).

# CI

#### Workflow: `.github/workflows/ci.yml`

- Levanta Postgres/Redis.

- `pnpm i` con lockfile.

- Prisma generate + migrate deploy (auth).

- Llaves dummy (solo para CI).

- Lint / Typecheck / Tests / Build (ambas apps).

- Sube `apps/*/dist` como artefactos.


# Troubleshooting

- **401 en `/me` con access nuevo** → revisa `JWT_ISS`/`JWT_AUD` y que el gateway consuma el JWKS correcto.

- **`refresh` devuelve 401** → reusaste un refresh viejo tras rotación -> **reuse-detection** revoca la familia.

- **429 inesperados** → revisa `x-device-id` y `x-forwarded-for`; con proxy local, activa `trust proxy`.

- **Prisma no conecta** → valida `AUTH_DATABASE_URL` y salud de Postgres del compose.

- **JWKS 404/vacío** → usa el endpoint del gateway: `/api/auth/.well-known/jwks.json` (debe mostrar `kid=JWT_KID`).

# Licencia
MIT License, See the LICENSE file for more information..
