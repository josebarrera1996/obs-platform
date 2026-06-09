# ObsPlatform — Observability Platform

> **Plataforma productiva de observabilidad multi-cuenta AWS con capacidades de IA/ML, alerting inteligente y pipeline de datos en tiempo real.**

ObsPlatform es un portal full-stack para monitorear infraestructura AWS (EC2, ECS, RDS, Lambda, ALB, DynamoDB, ElastiCache y más) desde una interfaz unificada. Descubre servicios automáticamente a través de credenciales AWS, despliega dashboards en tiempo real, detecta anomalías con IA y permite la gestión de productos y su relación con los servicios de infraestructura.

---

## ✨ Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| **Dashboard multi-cuenta** | Vista consolidada de todas las cuentas AWS con estado, uptime y warning de incidentes |
| **Descubrimiento automático** | Escanea namespaces AWS (ECS, EC2, RDS, Lambda, ALB, NLB, DynamoDB, ElastiCache, S3, SQS, SNS, CloudFront) |
| **Métricas en tiempo real** | CPU, memoria, latencia, error rate, RPS con gráficos interactivos (Recharts) |
| **Detalle de servicios** | Vista por servicio con métricas, operaciones, topología y relaciones |
| **Productos** | Agrupa servicios en productos lógicos con indicadores asociados |
| **Insights IA/ML** | Detección de anomalías, forecasting, pattern detection y root cause analysis |
| **Alertas inteligentes** | Reglas configurables con notificaciones vía Slack |
| **Pipeline de datos** | Ingesta, procesamiento y almacenamiento con NATS + Quickwit |
| **Modo oscuro** | Tema claro/oscuro completo vía Tailwind v4 + CSS vars |
| **Atajos de teclado** | Navegación rápida con `Ctrl+K` (búsqueda), `?` (ayuda) y más |

---

## 🧱 Stack Tecnológico

### Frontend

| Tecnología | Versión | Uso |
|---|---|---|
| [Next.js](https://nextjs.org/) | 16.2 (App Router) | Framework full-stack |
| [React](https://react.dev/) | 19.2 | UI components |
| [Tailwind CSS](https://tailwindcss.com/) | v4 | Estilos utilitarios |
| [shadcn/ui](https://ui.shadcn.com/) | v4 | Componentes base (card, dialog, badge, button, etc.) |
| [Recharts](https://recharts.org/) | 3.8 | Charts y visualizaciones |
| [TanStack Query](https://tanstack.com/query) | v5 | Gestión de estado y fetching |
| [Zustand](https://github.com/pmndrs/zustand) | v5 | Estado global liviano |
| [Lucide React](https://lucide.dev/) | — | Iconos |
| [date-fns](https://date-fns.org/) | 4.4 | Fechas y timezone |

### Backend / API

| Tecnología | Uso |
|---|---|
| Next.js API Routes | API REST serverless |
| AWS SDK v3 | Clientes para CloudWatch, ECS, EC2, RDS, Lambda, etc. |
| next-auth v5 | Autenticación (Credentials / OAuth) |
| PostgreSQL + pg | Base de datos para feature store, anomalías y predicciones |

### Infraestructura

| Componente | Propósito |
|---|---|
| Docker Compose | Entorno local con PostgreSQL, NATS, Quickwit |
| Terraform | Deploy a producción en AWS ECS Fargate |
| NATS | Message broker para pipeline de datos en tiempo real |
| Quickwit | Motor de búsqueda para logs e ingestión |
| Playwright | Tests end-to-end |

### IA/ML

| Endpoint | Descripción |
|---|---|
| `/api/ml/anomalies` | Detección de anomalías (Z-score) |
| `/api/ml/forecast` | Forecasting de métricas (modelo Prophet-like) |
| `/api/ml/patterns` | Detección de patrones (spikes, dips, trends) |
| `/api/ml/root-cause` | Root Cause Analysis automatizado |

---

## 📁 Estructura del Proyecto

```
obs-platform/
├── src/
│   ├── app/
│   │   ├── accounts/         # Detalle de cuentas AWS + servicios
│   │   ├── api/              # API routes (REST)
│   │   │   ├── aws/          #   accounts, services, metrics, alarms, events
│   │   │   ├── ml/           #   anomalías, forecast, patterns, root-cause
│   │   │   ├── alerts/       #   reglas, schedule, Slack
│   │   │   ├── credentials/  #   gestión de credenciales AWS
│   │   │   ├── pipeline/     #   ingestión, logs, stats
│   │   │   └── health/       #   health check
│   │   ├── incidents/        # Vista de incidentes
│   │   ├── insights/         # IA/ML insights dashboard
│   │   ├── pipeline/         # Pipeline de datos UI
│   │   ├── products/         # Gestión de productos
│   │   ├── service-detail/   # Vista detalle de servicio
│   │   ├── login/            # Página de login
│   │   └── settings/         # Configuración
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── MainLayout.tsx    # Layout principal con Sidebar + Header
│   │   ├── Sidebar.tsx       # Navegación lateral
│   │   ├── Header.tsx        # Barra superior
│   │   ├── SearchDialog.tsx  # Búsqueda global (Ctrl+K)
│   │   ├── ServiceTopology.tsx
│   │   └── ...               # ErrorBoundary, Pagination, Skeleton, ThemeProvider
│   ├── data/                  # Mock data
│   ├── lib/                   # Utilidades, db client, AWS helpers
│   ├── store/                 # Zustand stores (products, settings)
│   └── types/                 # TypeScript domain models
├── docs/
│   ├── observability-architecture.md   # Documentación de arquitectura
│   ├── deployment-guide.md             # Guía de deploy
│   ├── current-state.md                # Estado actual del proyecto
│   ├── production-gap-analysis.md       # Análisis de brechas para producción
│   └── work-plan.md                     # Plan de trabajo
├── infra/
│   ├── db/migrations/         # Migraciones SQL (feature store, anomalías, predicciones)
│   └── terraform/             # Infraestructura como código (AWS ECS Fargate)
├── e2e/                       # Tests end-to-end con Playwright
├── docker-compose.yml         # Entorno local completo
├── Dockerfile                 # Docker image para producción
└── vercel.json                # Config Vercel (opcional)
```

---

## 🚀 Primeros Pasos

### Prerrequisitos

- Node.js >= 20
- npm
- Docker Desktop (para PostgreSQL y pipeline local)
- Una cuenta AWS con credenciales (opcional para modo real)

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/garage-deep-analytics/obs-platform.git
cd obs-platform

# 2. Instalar dependencias
npm install

# 3. Iniciar base de datos PostgreSQL (para ML y feature store)
docker compose up -d db

# 4. Ejecutar migraciones
npm run dev   # Las migraciones corren automáticamente al iniciar

# 5. Iniciar servidor de desarrollo
npm run dev
# Abrir http://localhost:3000
```

### Login

Por defecto, el portal arranca con autenticación **Credentials**:

- **Email:** `admin@obsplatform.dev`
- **Password:** `admin123`

*(Configurable via `AUTH_CREDENTIALS` env var)*

---

## 🖥️ Scripts Disponibles

| Script | Comando | Descripción |
|---|---|---|
| Dev | `npm run dev` | Inicia servidor de desarrollo (puerto 3000) |
| Build | `npm run build` | Build de producción |
| Start | `npm run start` | Inicia servidor de producción |
| Lint | `npm run lint` | ESLint |
| Typecheck | `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| Test | `npm test` | Tests unitarios (Vitest) |
| E2E | `npm run e2e` | Tests end-to-end (Playwright) |
| Coverage | `npm run test:coverage` | Tests con reporte de cobertura |

---

## 🏗️ Despliegue

### Local con Docker Compose

```bash
# Solo app
docker compose up -d

# App + pipeline completo (NATS + Quickwit)
docker compose --profile pipeline up -d

# Todo junto
docker compose --profile all up -d
```

### Producción (AWS ECS)

Ver la [guía de despliegue](docs/deployment-guide.md) completa con Terraform:

```bash
cd infra/terraform
terraform init
terraform plan -var-file="terraform.tfvars"
terraform apply
```

---

## 🔐 Autenticación

El portal usa **next-auth v5** con dos modos:

| Modo | Configuración |
|---|---|
| **Credentials** (default) | Login con email + password |
| **OAuth** | Configurable con cualquier provider (Google, GitHub, etc.) |

Las sesiones expiran a los 30 días. El secret de encriptación se configura via `AUTH_SECRET`.

---

## ☁️ Conexión AWS

1. Ve a **Settings > AWS Credentials**
2. Agrega tus credenciales AWS (Access Key + Secret Key)
3. Selecciona las regiones a monitorear
4. El portal descubre automáticamente los servicios disponibles

**Namespaces soportados:** ECS, EC2, RDS, Lambda, ALB, NLB, DynamoDB, ElastiCache, S3, SQS, SNS, CloudFront

---

## 🧠 IA/ML

El módulo de insights ofrece cuatro capacidades:

1. **Detección de Anomalías** — Z-score sobre métricas históricas
2. **Forecasting** — Predicción de métricas futuras
3. **Pattern Detection** — Identificación de spikes, dips y trends
4. **Root Cause Analysis** — Correlación entre servicios para diagnosticar incidentes

Todas las predicciones y resultados se almacenan en PostgreSQL para consulta histórica.

---

## 🧪 Tests

```bash
# Tests unitarios
npm test

# Tests con coverage
npm run test:coverage

# Tests E2E (requiere servidor corriendo)
npm run e2e
```

---

## 🤝 Contribuir

1. Hacer fork del repositorio
2. Crear una rama (`git checkout -b feature/mi-feature`)
3. Commit convencional (`feat:`, `fix:`, `chore:`, `docs:`)
4. Hacer push (`git push origin feature/mi-feature`)
5. Abrir un Pull Request

---

## 📄 Licencia

MIT

---

<p align="center">
  <sub>Desarrollado con ❤️ por <a href="https://github.com/garage-deep-analytics">garage-deep-analytics</a></sub>
</p>