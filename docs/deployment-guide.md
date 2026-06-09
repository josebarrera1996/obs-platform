# ObsPlatform — Deployment Guide

> **Fecha:** junio 2026  
> **Stack:** Next.js 16 + Docker + AWS ECS Fargate  
> **Pipeline:** NATS JetStream + OpenTelemetry + Quickwit

---

## 📋 Requisitos

| Herramienta | Versión mínima | Para qué |
|---|---|---|
| Node.js | 22.x | Build y desarrollo local |
| Docker | 24.x + | Contenedores locales |
| Terraform | 1.6+ | Infraestructura AWS (producción) |
| AWS CLI | 2.x | Interacción con AWS |
| `npx` | 10.x | Comandos del proyecto |

---

## 🚀 Deployment Rápido (Desarrollo)

```bash
# 1. Clonar y configurar
git clone <repo-url>
cd obs-platform
cp .env.production.example .env.production
# Editar .env.production con tus valores

# 2. Build Docker
docker compose build app

# 3. Iniciar
docker compose up -d
# App en: http://localhost:3000

# 4. Verificar salud
curl http://localhost:3000/api/health
```

### Perfiles de Docker Compose

```bash
# Solo app (default)
docker compose up -d

# App + scheduler de alertas
docker compose --profile scheduler up -d

# App + pipeline completo (NATS + OTEL + Quickwit)
docker compose --profile pipeline up -d

# Todo junto
docker compose --profile all up -d
```

---

## 🏭 Deployment a Producción (AWS ECS)

### 1. Generar Secrets

```bash
# Encryption key (para credenciales AWS en reposo)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Auth secret (para JWTs)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Configurar Variables de Terraform

Editar `infra/terraform/terraform.tfvars`:

```hcl
aws_region       = "us-east-1"
vpc_id           = "vpc-xxxxx"
subnet_ids       = ["subnet-xxxxx", "subnet-yyyyy"]
certificate_arn  = "arn:aws:acm:us-east-1:xxxxx:certificate/xxxxx"
encryption_key   = "<generated-64-hex-chars>"
auth_secret      = "<generated-64-hex-chars>"
slack_webhook_url = "https://hooks.slack.com/services/xxxxx/xxxxx/xxxxx"
```

### 3. Deploy

```bash
# Script automatizado
ECR_REGISTRY=xxxxx.dkr.ecr.us-east-1.amazonaws.com \
ECR_REPO=obs-platform/app \
./scripts/deploy.sh production v1.0.0

# O manual:
cd infra/terraform
terraform init
terraform apply -auto-approve
```

---

## 🔐 Autenticación

Por defecto en desarrollo `OBS_AUTH_ENABLED=false`.  
Para habilitar autenticación en producción:

1. Setear `OBS_AUTH_ENABLED=true` en `.env.production`
2. Setear `AUTH_SECRET` con un valor generado
3. Opcional: configurar Google OAuth con `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`
4. Build y redeploy

---

## 🤖 IA/ML — Endpoints

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/ml/anomalies` | POST | Detección Z-score de anomalías |
| `/api/ml/forecast` | POST | Forecast Prophet-like (tendencia + estacionalidad) |
| `/api/ml/patterns` | POST | Detección de patrones + correlación entre servicios |
| `/insights` | GET | Dashboard de IA con anomalías, forecast y recomendaciones |

### Ejemplo: Forecast

```bash
curl -X POST http://localhost:3000/api/ml/forecast \
  -H "Content-Type: application/json" \
  -d '{"values": [50,52,55,53,58,60,57,62,65,63], "periods": 6}'
```

---

## 📡 Pipeline de Datos

El pipeline recibe datos de CloudWatch → NATS → OTEL → Quickwit (archivo local como fallback).

### Comandos del Pipeline

```bash
# Ingestar métricas (desde CloudWatch)
curl -X POST http://localhost:3000/api/pipeline/ingest \
  -H "Content-Type: application/json" \
  -d '{"credentialId": "xxx", "namespaces": ["AWS/ECS", "AWS/EC2"]}'

# Consultar métricas históricas
curl "http://localhost:3000/api/pipeline/query?namespace=AWS/ECS&metricName=CPUUtilization"

# Estadísticas del pipeline
curl http://localhost:3000/api/pipeline/stats

# Exportar a CSV
curl "http://localhost:3000/api/pipeline/query?namespace=AWS/ECS&format=csv"
```

### Almacenamiento

- **Local**: Archivos JSONL en `.data/pipeline/` (retención default: 90 días)
- **Producción**: Quickwit indexa en `quickwit_data/` con retención configurable
- **Streaming**: NATS JetStream para consumo en tiempo real

---

## 🩺 Monitoreo del Monitor

```bash
# Health check externo (JSON)
curl http://localhost:3000/api/external-health

# Health check externo (texto plano)
curl "http://localhost:3000/api/external-health?format=text"

# Health simple
curl http://localhost:3000/api/health
```

El servicio `monitor` en docker-compose corre health checks cada 5 minutos.

---

## 🔧 Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| `OBS_AUTH_ENABLED` redirect loop | `AUTH_TRUST_HOST` incorrecto | Setear `AUTH_TRUST_HOST=https://midominio.com` |
| Build Docker falla | `NEXT_OUTPUT=standalone` | Verificar `next.config.ts` tiene `output: standalone` |
| Credenciales no se guardan | `OBS_ENCRYPTION_KEY` no seteado | Generar key de 32 bytes hex |
| Pipeline no ingesta | credentialId inválido | Verificar en Settings → Credentials |
| 429 Too Many Requests | Rate limit de API (100/min) | Esperar o aumentar en `src/proxy.ts` |

---

## 📊 CI/CD

El pipeline de CI corre automáticamente en cada PR:

1. **Lint** → `npm run lint`
2. **TypeScript** → `npx tsc --noEmit`
3. **Tests unitarios** → `npx vitest run`
4. **Build** → `npm run build`
5. **E2E tests** → `npx playwright test`

Ver `.github/workflows/ci.yml` para detalles.

---

*Documento generado por Kowa · ObsPlatform Deployment Guide*