# ObsPlatform — Plan de Trabajo: Productivo al 100%

> **Versión**: 1.0 · **Fecha**: junio 2026  
> **Basado en**: `docs/production-gap-analysis.md` + `docs/observability-architecture.md` + código real del proyecto  
> **Objetivo**: Transformar el portal funcional actual en una plataforma de observabilidad productiva

---

## 📊 Estado Actual (resumen)

| Componente | Estado | Conectado a AWS real? |
|---|---|---|
| Dashboard (`/`) | ✅ Funcional | ✅ Sí (servicios + métricas + charts) |
| Account Detail (`/accounts/[id]`) | ⚠️ Funcional | ❌ No — 100% mock |
| Service Detail (`/service-detail`) | ✅ Funcional | ✅ Sí |
| Service Detail (`/accounts/[id]/services/[sid]`) | ⚠️ Funcional | ❌ No — 100% mock |
| Operation Detail (`.../operations/[oid]`) | ⚠️ Funcional | ⚠️ Parcial |
| Incidents (`/incidents`) | ⚠️ Funcional | ❌ No — 100% mock |
| Settings (`/settings`) | ✅ Completo | ✅ CRUD real de credenciales |
| Header | ⚠️ Bugs | ❌ Mock incidents + hydration error |
| Sidebar | ✅ Fixed | ⚠️ Mock accounts |
| SearchDialog (⌘K) | ⚠️ Funcional | ❌ No — 100% mock |
| ServiceTopology | ⚠️ Funcional | ❌ No — hardcoded |

**Score general: ~30%** — El frontend se ve bien, pero la mitad de las páginas usan datos falsos y faltan 7 pilares clave.

---

## 🗺️ Mapa del Plan — 7 Fasess

```

Fase 0 ── Quick-Wins (1-2 días)
  ├── Fix hydration error Header
  ├── Sidebar con cuentas reales
  ├── Encriptar credenciales AWS
  └── Conectar incidents con CloudTrail real
         │
         ▼
Fase 1 ── Wirear páginas a datos reales (1 semana)
  ├── Account Detail: datos desde /api/aws/accounts + /api/aws/services
  ├── Service Detail (nested): datos desde /api/aws/metrics
  ├── SearchDialog: búsqueda contra AWS real
  ├── ServiceTopology: auto-descubrimiento de dependencias
  └── Incidentes reales (CloudTrail + CloudWatch Alarms)
         │
         ▼
Fase 2 ── Pipeline de Datos (3-4 semanas)
  ├── NATS JetStream server
  ├── OpenTelemetry Collectors
  ├── VictoriaMetrics (timeseries)
  ├── Quickwit (logs)
  └── Exporters desde AWS → pipeline
         │
         ▼
Fase 3 ── Alerting + Slack (2 semanas)
  ├── Engine de alertas (reglas + evaluación)
  ├── Canal de Slack (webhook + bot)
  ├── Thresholds configurables
  └── Notificaciones Push
         │
         ▼
Fase 4 ── Seguridad + Infra (1-2 semanas)
  ├── Auth básica (NextAuth / OAuth proxy)
  ├── Rate limiting
  ├── Dockerfile + docker-compose
  └── CORS + headers de seguridad
         │
         ▼
Fase 5 ── Testing + CI/CD (1-2 semanas)
  ├── Tests unitarios (vitest)
  ├── Tests E2E (Playwright)
  ├── GitHub Actions CI
  └── Deploy automatizado
         │
         ▼
Fase 6 ── IA/ML (6-8 semanas)
  ├── Anomaly detection (CPU, memory, error rate)
  ├── Forecasting de capacidad
  ├── RCA automático (logs + métricas)
  ├── Slack bot con IA
  └── Dashboard de Insights
```

---

# 🚀 Fase 0 — Quick-Wins (1-2 días)

Prioridad máxima, bajo esfuerzo, alto impacto.

## 0.1 🔧 Fix hydration error Header

**Archivo**: `src/components/Header.tsx`  
**Problema**: `PopoverTrigger` renderiza `<button>` y dentro tiene `<Button>` que también es `<button>`  
**Fix**: Usar la prop `render` de base-ui para que `PopoverTrigger` SEA el `Button`

```tsx
// Antes
<PopoverTrigger>
  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 relative">
    <Bell className="h-4 w-4" />
    {activeIncidents > 0 && (
      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
        {activeIncidents}
      </span>
    )}
  </Button>
</PopoverTrigger>

// Después
<PopoverTrigger
  render={
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 relative" />
  }
>
  <Bell className="h-4 w-4" />
  {activeIncidents > 0 && (
    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
      {activeIncidents}
    </span>
  )}
</PopoverTrigger>
```

**Validación**: `npm run build` sin hydration errors.

## 0.2 🔒 Encriptar credenciales AWS en disco

**Archivo**: `src/lib/storage.ts`  
**Problema**: `secretAccessKey` se guarda en texto plano en `.data/credentials.json`  
**Solución**: Usar `crypto.createCipheriv` con AES-256-GCM y una clave derivada de una variable de entorno `OBS_ENCRYPTION_KEY`.

**Cambios**:
1. Agregar función `encrypt(text: string): { encrypted: string; iv: string; tag: string }`
2. Agregar función `decrypt(encrypted: string, iv: string, tag: string): string`
3. En `writeCredentials()`, encriptar `secretAccessKey` de cada credencial antes de serializar
4. En `readCredentials()`, desencriptar al leer
5. Agregar al `.env.local.example` la variable `OBS_ENCRYPTION_KEY`

```ts
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

function getEncryptionKey(): Buffer {
  const key = process.env.OBS_ENCRYPTION_KEY;
  if (!key) throw new Error("OBS_ENCRYPTION_KEY env var is required");
  return createHash("sha256").update(key).digest();
}

function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return { encrypted, iv: iv.toString("hex"), tag };
}
```

## 0.3 Sidebar con cuentas reales

**Archivo**: `src/components/Sidebar.tsx`  
**Problema**: Importa `accounts` de `@/data/mock` en vez de usar la store real  
**Fix**: Importar `useSettingsStore` y usar `awsAccounts` + `fetchAwsAccounts` de la store

## 0.4 Popover de notificaciones con datos reales

**Archivo**: `src/components/Header.tsx`  
**Problema**: Usa `incidents` de mock  
**Fix**: Llamar a `/api/aws/events?credentialId=...&timeRange=24h` para traer eventos reales de CloudTrail y mostrar los de tipo error como "incidentes"

## 0.5 Dockerfile + docker-compose

**Archivos nuevos**: `Dockerfile`, `.dockerignore`, `docker-compose.yml`  
**Objetivo**: Poder deployar con `docker compose up` en cualquier servidor

---

# 🔗 Fase 1 — Wirear páginas a datos reales (1 semana)

## 1.1 Account Detail con datos reales

**Archivo**: `src/app/accounts/[id]/page.tsx`  
**Estado**: Usa `getAccountById`, `getServicesByAccount`, `getIncidentsByAccount` de mock  
**Plan**:
1. Reemplazar imports de mock por llamadas fetch a:
   - `GET /api/aws/accounts?credentialId=...` → datos de la cuenta
   - `GET /api/aws/services?credentialId=...` → servicios de esa cuenta
   - `GET /api/aws/events?credentialId=...` → incidentes reales
2. Usar `useSettingsStore` para obtener `activeCredentialId`
3. Pasar `credentialId` como parámetro en las llamadas
4. El `id` del route param se mapea al `accountId` devuelto por AWS

## 1.2 Service Detail nested con datos reales

**Archivo**: `src/app/accounts/[id]/services/[sid]/page.tsx`  
**Estado**: 100% mock  
**Plan**: Migrar a la misma arquitectura que `service-detail/page.tsx` (que ya funciona con AWS real):
1. Usar searchParams para pasar `credentialId`, `serviceId`, `namespace`, `region`
2. Llamar a `POST /api/aws/metrics` para obtener métricas reales
3. Llamar a `GET /api/aws/events` para incidentes del servicio
4. Reemplazar toda la data mock

## 1.3 Operation Detail con métricas reales

**Archivo**: `src/app/accounts/[id]/services/[sid]/operations/[oid]/page.tsx`  
**Estado**: Parcialmente real pero frágil  
**Plan**:
1. Usar `Suspense` wrapper para `useSearchParams`
2. Conectar las métricas específicas de la operación desde CloudWatch
3. Agregar charts de P95 latency, error rate y RPS

## 1.4 SearchDialog contra AWS real

**Archivo**: `src/components/SearchDialog.tsx`  
**Estado**: 100% mock  
**Plan**:
1. Reemplazar `searchAll()` que usa `accounts, services, operations, incidents` de mock
2. En su lugar, hacer fetch a `/api/aws/services?credentialId=...` para poblar resultados
3. Cachear resultados para búsqueda rápida (o usar TanStack Query, que ya está instalado)
4. Mostrar resultados con namespace y tipo real

## 1.5 ServiceTopology auto-descubierto

**Archivo**: `src/components/ServiceTopology.tsx`  
**Estado**: Dependencias hardcodeadas  
**Plan**:
1. En lugar de `serviceDependencies` fijas, consultar las relaciones reales
2. Usar CloudWatch metrics (ej: si service A llama a service B consistentemente, detectarlo)
3. O usar datos de X-Ray / ServiceLens si está disponible
4. Mientras tanto, mostrar topología basada en los servicios descubiertos

## 1.6 Incidents desde CloudWatch Alarms

**Archivo**: `src/app/incidents/page.tsx`  
**Estado**: 100% mock  
**Plan**:
1. Agregar endpoint `GET /api/aws/alarms?credentialId=...`
2. Llamar a `DescribeAlarmsCommand` de CloudWatch
3. Mapear alarmas en estado `ALARM` a incidentes
4. Agregar datos de CloudTrail events como "incident history"

---

# 📡 Fase 2 — Pipeline de Datos (3-4 semanas)

> Basado en la Propuesta A de `docs/observability-architecture.md`

## 2.1 NATS JetStream Server

**Qué**: Message broker para streaming de datos de observabilidad  
**Por qué**: Baja latencia (~1ms), persistente, open-source  
**Cómo**:
1. Docker Compose con `nats:latest` + JetStream habilitado
2. Streams: `aws.metrics`, `aws.logs`, `aws.events`, `alerts`
3. Consumer groups para distintos procesadores

## 2.2 OpenTelemetry Collectors

**Qué**: Agentes de recolección de telemetría  
**Por qué**: Vendor-neutral, recibe métricas/logs/traces  
**Cómo**:
1. OTEL Collector config con receivers (Prometheus, OTLP)
2. Exporters hacia VictoriaMetrics (métricas) y Quickwit (logs)
3. Procesadores: batch, filter, transform

## 2.3 VictoriaMetrics (TSDB)

**Qué**: Base de datos de series temporales  
**Por qué**: 10x más eficiente que Prometheus, compatible con PromQL  
**Cómo**:
1. Docker Compose: `victoriametrics/victoriaMetrics`
2. Configurar retention (30 días por defecto)
3. Conectar desde el frontend vía API

## 2.4 Quickwit (Logs)

**Qué**: Motor de búsqueda de logs  
**Por qué**: 10x más barato que Elasticsearch, serverless-first  
**Cómo**:
1. Docker Compose: `quickwit/quickwit`
2. Indexar logs de CloudWatch Logs + eventos
3. API para búsqueda desde el frontend

## 2.5 Exporters AWS → Pipeline

**Qué**: Puente entre AWS y el pipeline local  
**Cómo**:
1. Lambda function que escucha CloudWatch Logs → NATS
2. CloudWatch Metric Stream → OTEL Collector
3. CloudTrail → S3 → Quickwit (vía SQS)

---

# 🔔 Fase 3 — Alerting + Slack (2 semanas)

## 3.1 Engine de Alertas

**Qué**: Evaluación de reglas contra datos en tiempo real  
**Implementación**:
1. Tabla de reglas: `{ name, query, condition, threshold, severity, cooldown, channels }`
2. Worker que evalúa cada N segundos contra VictoriaMetrics
3. Estados: `ok → pending → firing → resolved`

## 3.2 Integración Slack

**Qué**: Notificaciones a canales de Slack  
**Implementación**:
1. Slack Bot (Events API + Webhooks)
2. Comandos: `/obs status`, `/obs silence alert-X`
3. Modal para crear alertas desde Slack
4. Canales por severidad: `#obs-critical`, `#obs-warning`, `#obs-info`

## 3.3 Thresholds configurables desde UI

**Qué**: Configurar alertas desde Settings  
**Implementación**:
1. Nueva sección en Settings: "Alert Rules"
2. CRUD de reglas
3. Test rule: ejecutar contra datos actuales

---

# 🛡️ Fase 4 — Seguridad + Infra (1-2 semanas)

## 4.1 Autenticación

**Qué**: Proteger la plataforma con login  
**Opciones**:
1. **NextAuth.js** con Google OAuth (rápido, 1 día)
2. **Auth0** (más features, pero external)
3. **Proxy reverso** con autenticación básica (nginx + htpasswd)

## 4.2 Rate Limiting

**Qué**: Proteger APIs internas  
**Implementación**:
1. Middleware de Next.js con `@upstash/ratelimit` o similar
2. Límites: 100 req/min por IP, 10 req/s para APIs pesadas

## 4.3 Dockerización completa

```dockerfile
FROM node:22-alpine AS base
FROM base AS deps
  WORKDIR /app
  COPY package.json bun.lock ./
  RUN bun install --frozen-lockfile
FROM base AS runner
  WORKDIR /app
  COPY --from=deps /app/node_modules ./node_modules
  COPY . .
  ENV NODE_ENV=production
  EXPOSE 3000
  CMD ["bun", "run", "start"]
```

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env.production
    volumes: [".data:/app/.data"]
  nats:
    image: nats:latest
    command: ["-js"]
  victoriametrics:
    image: victoriametrics/victoriaMetrics
    volumes: ["vmdata:/victoria-metrics-data"]
```

## 4.4 Headers de seguridad

**Implementación**: En `next.config.js`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` básico

---

# 🧪 Fase 5 — Testing + CI/CD (1-2 semanas)

## 5.1 Tests unitarios (Vitest)

**Ya instalado**: Playwright  
**Falta**: Vitest para unit tests  
**Plan**:
```bash
bun add -d vitest @testing-library/react @testing-library/jest-dom
```

**Tests a escribir**:
1. `src/lib/__tests__/storage.test.ts` — CRUD de credenciales, encriptación
2. `src/store/__tests__/settings.test.ts` — Store de Zustand
3. Test de API routes con mocks de AWS SDK
4. Test de componentes: Header, Sidebar, Dashboard

## 5.2 Tests E2E (Playwright)

**Ya instalado**: Playwright + `@playwright/test`  
**Plan**:
1. Configurar `playwright.config.ts`
2. Tests: login flow, dashboard carga, navegación, settings CRUD
3. Test de responsive: desktop + mobile

## 5.3 GitHub Actions CI

**Archivo nuevo**: `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: npx tsc --noEmit
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run lint
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bunx vitest run
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
```

## 5.4 Deploy automatizado

**Opción recomendada**: Vercel (proyecto Next.js, deploy simple)  
**Alternativa**: Docker + VPS con GitHub Actions deploy

---

# 🤖 Fase 6 — IA/ML (6-8 semanas)

> Ver `docs/observability-architecture.md` sección 7 para detalles completos

## 6.1 Anomaly Detection

**Qué**: Detectar anomalías en series temporales automáticamente  
**Stack**: Python + Prophet (Facebook) o AnomalyDetection Toolkit (ADTK)  
**Pipeline**:
1. Exportar métricas de VictoriaMetrics → Python service
2. Modelo Prophet por servicio (CPU, memory, error rate, latency)
3. Detección en ventanas de 5 min
4. Alertas automáticas cuando se detecta anomalía

## 6.2 Forecasting de Capacidad

**Qué**: Predecir cuándo se va a saturar un recurso  
**Implementación**:
1. Modelo Prophet con seasonality (diaria, semanal)
2. Predicción a 7/14/30 días
3. Dashboard "Capacity Planning" con charts de proyección
4. Slack alert: "ECS cluster prod-cluster will reach 80% CPU in 14 days"

## 6.3 RCA Automático (Root Cause Analysis)

**Qué**: Dado un incidente, encontrar la causa raíz automáticamente  
**Implementación**:
1. Cuando se dispara una alerta, recolectar contexto:
   - Métricas de todos los servicios relacionados (últimos 30 min)
   - Logs de error del período
   - Cambios recientes (CloudTrail)
2. Alimentar a un LLM (Claude/GPT-4) con el contexto
3. Devolver: "Root cause: `svc-auth` started returning 503s after deploy v2.3.1 at 14:32"

## 6.4 Slack Bot con IA

**Qué**: Bot de Slack que responde preguntas en lenguaje natural  
**Comandos**:
- `@obs what's wrong right now?` → Resumen de alertas activas
- `@obs analyze service api-gateway` → Análisis de salud + anomalías
- `@obs why did we have an incident yesterday?` → RCA automático
- `@obs forecast capacity for ecs-prod` → Proyección

## 6.5 Dashboard de Insights

**Qué**: Página nueva `/insights` con análisis de IA  
**Contenido**:
- Anomalías detectadas (últimas 24h)
- Predicciones de capacidad
- Patrones de comportamiento semanal
- Recomendaciones automáticas

---

# 📋 Resumen de Archivos a Modificar/Crear

## Fase 0 — Quick-Wins

| Archivo | Acción |
|---|---|
| `src/components/Header.tsx` | Fix hydration error + conectar a CloudTrail real |
| `src/components/Sidebar.tsx` | Usar `useSettingsStore` en vez de mock |
| `src/lib/storage.ts` | Agregar encriptación AES-256 |
| `.env.local.example` | Agregar `OBS_ENCRYPTION_KEY` |
| `Dockerfile` | **Nuevo** |
| `docker-compose.yml` | **Nuevo** |
| `.dockerignore` | **Nuevo** |

## Fase 1 — Wirear páginas

| Archivo | Acción |
|---|---|
| `src/app/accounts/[id]/page.tsx` | Migrar de mock a fetch real |
| `src/app/accounts/[id]/services/[sid]/page.tsx` | Migrar de mock a fetch real |
| `src/app/accounts/[id]/services/[sid]/operations/[oid]/page.tsx` | Agregar Suspense + métricas reales |
| `src/components/SearchDialog.tsx` | Migrar a fetch real |
| `src/components/ServiceTopology.tsx` | Auto-descubrimiento |
| `src/app/incidents/page.tsx` | Migrar a CloudTrail + CloudWatch Alarms |
| `src/app/api/aws/alarms/route.ts` | **Nuevo** endpoint |

## Fase 2 — Pipeline (nuevos archivos)

| Archivo | Propósito |
|---|---|
| `infra/nats/` | Config NATS JetStream |
| `infra/otel/otel-collector-config.yml` | Config OTEL Collector |
| `infra/victoriametrics/prometheus.yml` | Config VictoriaMetrics |
| `infra/quickwit/quickwit-config.yml` | Config Quickwit |
| `infra/exporters/cloudwatch-logs-to-nats.ts` | Lambda para logs |
| `infra/exporters/metric-stream-to-otel.ts` | Lambda para métricas |

## Fase 3 — Alerting

| Archivo | Propósito |
|---|---|
| `src/app/api/alerts/rules/route.ts` | CRUD de reglas |
| `src/lib/alerts/engine.ts` | Evaluación de reglas |
| `src/lib/alerts/slack.ts` | Slack webhooks |
| `src/app/settings/alerts/page.tsx` | UI de configuración |
| `infra/slack-bot/` | Bot de Slack |

## Fase 4 — Seguridad + Infra

| Archivo | Propósito |
|---|---|
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth |
| `src/app/auth/login/page.tsx` | Login page |
| `src/middleware.ts` | Rate limiting + auth check |
| `nginx.conf` | Proxy reverso |

## Fase 5 — Testing + CI/CD

| Archivo | Propósito |
|---|---|
| `.github/workflows/ci.yml` | **Nuevo** |
| `vitest.config.ts` | **Nuevo** |
| `playwright.config.ts` | **Nuevo** |
| `src/**/__tests__/*.test.ts` | Tests |

## Fase 6 — IA/ML

| Archivo | Propósito |
|---|---|
| `ml/anomaly-detection/` | Modelos de detección |
| `ml/forecasting/` | Modelos de forecasting |
| `src/app/api/ml/anomalies/route.ts` | API de anomalías |
| `src/app/api/ml/forecast/route.ts` | API de forecasting |
| `src/app/api/ml/rca/route.ts` | API de RCA |
| `src/app/insights/page.tsx` | Dashboard de Insights |

---

## 🎯 Prioridades Recomendadas

### Esta semana (días 1-5)
```
Día 1: Fase 0.1 (fix hydration) + 0.2 (encriptación)
Día 2: Fase 0.3 (sidebar real) + 0.4 (header real) 
Día 3: Fase 1.1 (account detail real) + 1.2 (service detail nested real)
Día 4: Fase 1.3 (search real) + 1.4 (incidents real) + 1.5 (topology)
Día 5: Fase 0.5 (Docker) + build validation + deploy a staging
```

### Próximas semanas
```
Semana 2: Pipeline de datos (NATS + OTEL)
Semana 3: VictoriaMetrics + Quickwit
Semana 4: Alerting engine + Slack integration
Semana 5: Seguridad + Docker compose completo
Semana 6: Testing + CI/CD
Semana 7-12: IA/ML + Insights
```

---

## ⚡ Estimación de Esfuerzo

| Fase | Días | Archivos | Dependencias |
|---|---|---|---|
| **Fase 0** — Quick-Wins | 2 | 6 | Ninguna |
| **Fase 1** — Wirear páginas | 5 | 8 | Fase 0 |
| **Fase 2** — Pipeline | 15 | 10+ | Fase 1 (parcial) |
| **Fase 3** — Alerting | 5 | 5 | Fase 2 |
| **Fase 4** — Seguridad | 5 | 5 | Fase 0 |
| **Fase 5** — Testing | 5 | 5+ | Fase 0 |
| **Fase 6** — IA/ML | 20 | 10+ | Fase 2 + Fase 3 |

**Total: ~57 días hábiles (~3 meses con 1 persona dedicada)**

---

*Documento generado por Kowa · Basado en análisis de código real + `docs/production-gap-analysis.md` + `docs/observability-architecture.md`*