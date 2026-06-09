# ObsPlatform — Gap Analysis: Producción al 100%

> **Propósito**: Identificar exactamente qué falta entre el estado actual y una plataforma de observabilidad productiva.
> **Basado en**: Código real del proyecto (junio 2026) + `docs/observability-architecture.md`
> **Audiencia**: Equipo técnico — cada gap tiene una estimación de esfuerzo.

---

## 1. Resumen Ejecutivo

| Dimensión | Estado | Producción requiere |
|---|---|---|
| **Frontend (UI/UX)** | ✅ ~75% completo | Faltan: estados de carga, paginación, responsive, filtros |
| **Integración AWS real** | ✅ ~60% funcional | Dashboard + ServiceDetail conectados; AccountDetail + ServiceList usan mock |
| **Pipeline de datos** | ❌ 0% | No hay ingestión, almacenamiento ni streaming de datos |
| **Alerting & Slack** | ❌ 0% | No hay engine de alertas ni notificaciones |
| **IA/ML** | ❌ 0% | No hay anomalías, predicciones ni análisis de logs |
| **Seguridad** | ❌ 0% | No hay auth, credenciales en disco plano, sin rate limiting |
| **Testing & CI/CD** | ❌ 0% | Playwright instalado, 0 tests escritos |
| **Infraestructura** | ❌ 0% | Sin Docker, sin deploy, sin monitoreo del monitor |
| **UX Productivo** | ⚠️ ~40% | Hydration errors, búsqueda con mock, breadcrumbs mock |

**Score general de productividad: ~25%** — el frontend está avanzado pero el backend de datos es inexistente.

---

## 2. Estado Detallado por Página

### 2.1 Dashboard (`/`)

| Item | Estado | Detalle |
|---|---|---|
| Muestra cuentas AWS reales | ✅ | Vía `fetchAwsAccounts()` desde CloudWatch/STS |
| Muestra servicios por namespace | ✅ | Vía `/api/aws/services` |
| Gráficos de métricas | ⚠️ Parcial | Solo algunos charts conectados a CloudWatch |
| Polling automático | ✅ | TanStack Query con refetch cada 60s |
| Estados de error/loading | ⚠️ Parcial | Algunos fetch errors no tienen UI dedicada |
| Datos mock como fallback | ❌ Sigue existiendo | Cuando no hay credenciales, muestra datos mock |

### 2.2 Account Detail (`/accounts/[id]`)

| Item | Estado | Detalle |
|---|---|---|
| Fetch real desde AWS | ❌ | Usa `getAccountById()` de mock data |
| Lista de servicios reales | ❌ | Usa `getServicesByAccount()` de mock |
| Incidentes reales | ❌ | Usa `getIncidentsByAccount()` de mock |
| ServiceTopology | ❌ | Componente existe pero usa mock |
| URL params dinámicos | ✅ | `useParams()` funciona correctamente |

### 2.3 Service Detail (`/accounts/[id]/services/[sid]`)

| Item | Estado | Detalle |
|---|---|---|
| Datos del servicio | ❌ | `getServiceById()` desde mock |
| Operaciones | ❌ | `getOperationsByService()` desde mock |
| Incidentes | ❌ | `getIncidentsByService()` desde mock |
| Tabla con métricas | ✅ | UI funciona, pero datos mock |

### 2.4 Service Detail External (`/service-detail?credentialId=&serviceId=`)

| Item | Estado | Detalle |
|---|---|---|
| Fetch real desde AWS | ✅ | Vía `/api/aws/metrics` |
| Gráficos CloudWatch | ✅ | AreaChart con datos reales |
| Suspense boundary | ✅ | Envuelto en `<Suspense>` |
| Dimensiones ECS | ✅ | Fix aplicado con `dimensions` param |

### 2.5 Operation Detail (`/accounts/[id]/services/[sid]/operations/[oid]`)

| Item | Estado | Detalle |
|---|---|---|
| Fetch real desde AWS | ✅ | Usa CredentialStore |
| Gráficos de latencia/RPS | ✅ | AreaChart conectado |
| Estados de carga | ✅ | Skeleton + spinner |

### 2.6 Incidents (`/incidents`)

| Item | Estado | Detalle |
|---|---|---|
| Datos reales | ❌ | 100% mock data |
| CloudTrail integrado | ❌ | API route existe pero página no la consume |
| Tabla con filtros | ❌ | Solo renderiza datos estáticos |

### 2.7 Settings (`/settings`)

| Item | Estado | Detalle |
|---|---|---|
| CRUD de credenciales | ✅ | Crear, editar, borrar, listar |
| Test de conexión | ✅ | Vía STS `GetCallerIdentity` |
| Persistencia en disco | ✅ | `.data/credentials.json` |
| **Encriptación de secrets** | ❌ | Secret keys en texto plano en JSON |

---

## 3. Gaps por Pilar

### Pilar 1: Pipeline de Datos (Ingestión → Storage → Analytics)

| # | Gap | Prioridad | Esfuerzo | Detalle técnico |
|---|---|---|---|---|
| 1.1 | **Sin streaming en tiempo real** | 🔴 P0 | 2-3 semanas | No hay NATS JetStream. El polling HTTP cada 60s no es tiempo real. |
| 1.2 | **Sin OpenTelemetry Collectors** | 🔴 P0 | 1-2 semanas | No hay OTEL collectors en EC2/ECS para capturar métricas, logs y trazas. |
| 1.3 | **Sin almacenamiento de métricas** | 🔴 P0 | 1-2 semanas | CloudWatch solo retiene 15 meses pero no tenemos copia local. Necesitamos VictoriaMetrics. |
| 1.4 | **Sin almacenamiento de logs** | 🟡 P1 | 2-3 semanas | No hay logs de EC2, ECS, ni Lambda. Arquitectura sugiere Quickwit o Elasticsearch. |
| 1.5 | **Sin tracing distribuido** | 🟡 P1 | 1-2 semanas | No hay Tempo ni Jaeger. No podemos tracear requests entre servicios. |
| 1.6 | **Sin retención de datos para analytics** | 🟡 P1 | 1 semana | Los datos históricos solo existen en CloudWatch. No hay base propia para training de modelos. |
| 1.7 | **Sin dashboard de health del pipeline** | 🟢 P2 | 3-5 días | No hay visibilidad de si los collectors están caídos o saturados. |

**Total Pilar 1: ~8-12 semanas**

### Pilar 2: Alerting & Slack

| # | Gap | Prioridad | Esfuerzo | Detalle técnico |
|---|---|---|---|---|
| 2.1 | **Sin engine de alertas** | 🔴 P0 | 2-3 semanas | No hay reglas de threshold (CPU > 90%, error rate > 5%). No hay AlertManager. |
| 2.2 | **Sin integración Slack** | 🔴 P0 | 1 semana | No hay Slack webhook ni Slack bot. El equipo usa Slack como plataforma de comunicación. |
| 2.3 | **Sin notificaciones push/email** | 🟡 P1 | 3-5 días | No hay SNS/SES configurado para notificaciones fuera de la plataforma. |
| 2.4 | **Sin on-call / escalation** | 🟡 P1 | 1-2 semanas | No hay políticas de escalamiento. Si alguien no responde, no hay fallback. |
| 2.5 | **Sin acknowledged/resolved workflows** | 🟢 P2 | 3-5 días | Los incidentes existen como UI pero no hay flujo de acknowledge → investigar → resolver. |

**Total Pilar 2: ~4-6 semanas**

### Pilar 3: IA/ML Pipeline

| # | Gap | Prioridad | Esfuerzo | Detalle técnico |
|---|---|---|---|---|
| 3.1 | **Sin anomaly detection en métricas** | 🟡 P1 | 3-4 semanas | No hay detección de anomalías en CPU, latencia, error rate. Arquitectura sugiere Prophet + custom model. |
| 3.2 | **Sin análisis semántico de logs** | 🟡 P1 | 4-6 semanas | No hay NLP sobre logs. No podemos preguntar "¿qué cambió a las 14:30?" |
| 3.3 | **Sin forecasting / predicción** | 🟢 P2 | 2-3 semanas | No hay modelos que predigan cuándo se va a llenar el disco o saturar la CPU. |
| 3.4 | **Sin RCA automatizado** | 🟢 P2 | 4-6 semanas | No hay correlación automática entre incidentes. "El error de DB causó el 503 en la API" no se detecta. |
| 3.5 | **Sin chatbot/assistant sobre la data** | 🟢 P2 | 4-6 semanas | No hay interfaz conversacional para preguntarle a la plataforma sobre el estado del sistema. |
| 3.6 | **Sin baseline de comportamiento** | 🟢 P2 | 2-3 semanas | No hay modelo de "comportamiento normal" para cada servicio. |

**Total Pilar 3: ~20-28 semanas (paralelizable con P1)**

### Pilar 4: Seguridad

| # | Gap | Prioridad | Esfuerzo | Detalle técnico |
|---|---|---|---|---|
| 4.1 | **Sin autenticación** | 🔴 P0 | 1-2 semanas | Cualquiera con la URL puede ver el dashboard. No hay login. |
| 4.2 | **AWS keys en texto plano** | 🔴 P0 | 2-3 días | `.data/credentials.json` guarda `secretAccessKey` sin encriptar. |
| 4.3 | **Sin HTTPS forzado** | 🔴 P0 | 1 día | No hay redirect HTTP→HTTPS. En producción es obligatorio. |
| 4.4 | **Sin rate limiting en API** | 🟡 P1 | 2-3 días | El endpoint de batch metrics puede hacer muchas llamadas a CloudWatch y generar costo. |
| 4.5 | **Sin CSP headers** | 🟡 P1 | 1 día | No hay Content-Security-Policy configurada. |
| 4.6 | **Sin autorización RBAC** | 🟡 P1 | 2-3 semanas | No hay roles (admin, viewer). Todos ven y editan todo. |
| 4.7 | **Sin audit logging** | 🟢 P2 | 1 semana | No hay registro de quién hizo qué cambio en settings. |

**Total Pilar 4: ~3-5 semanas**

### Pilar 5: Calidad de Código y Testing

| # | Gap | Prioridad | Esfuerzo | Detalle técnico |
|---|---|---|---|---|
| 5.1 | **Hydration error en Header** | 🔴 P1 | 1 día | `<PopoverTrigger>` → `<button>` → `<Button>` → `<button>`. El fix es el mismo que en Sidebar: usar `render` prop. |
| 5.2 | **Sin tests automatizados** | 🔴 P0 | 4-6 semanas | Playwright está instalado pero no hay 1 solo test. Cero tests unitarios, de integración o E2E. |
| 5.3 | **Mock data conviviendo con real** | 🟡 P1 | 2-3 días | Las páginas tienen lógica condicional mock/real que es frágil. Hay que eliminarla. |
| 5.4 | **Sin CI/CD pipeline** | 🔴 P0 | 3-5 días | No hay GitHub Actions, ni lint automatizado, ni build check en PRs. |
| 5.5 | **Sin type safety completo** | 🟡 P1 | 1 semana | Algunos `any` y `as any` en el código (especialmente en page.tsx línea 178). |
| 5.6 | **Sin estándar de manejo de errores** | 🟡 P1 | 3-5 días | Cada API route maneja errores distinto. Sin formato uniforme. |
| 5.7 | **Sin documentación de API** | 🟢 P2 | 2-3 días | Los endpoints no tienen documentación ni OpenAPI spec. |

**Total Pilar 5: ~5-7 semanas**

### Pilar 6: UX Productivo

| # | Gap | Prioridad | Esfuerzo | Detalle técnico |
|---|---|---|---|---|
| 6.1 | **Sin paginación en tablas** | 🟡 P1 | 2-3 días | Services, operations, incidents sin paginación. Con 100+ servicios, la UI colapsa. |
| 6.2 | **Sin filtros/búsqueda en tablas** | 🟡 P1 | 3-5 días | No se puede filtrar por estado, tipo, región desde la UI. |
| 6.3 | **SearchDialog usa mock data** | 🟡 P1 | 2-3 días | La búsqueda global (⌘K) solo busca en `src/data/mock.ts`, no en datos reales. |
| 6.4 | **Sin responsive design** | 🟡 P1 | 1 semana | El layout asume desktop. En tablets/móviles se rompe. |
| 6.5 | **Sin export de datos** | 🟢 P2 | 3-5 días | No se pueden exportar gráficos o tablas a PNG/PDF/CSV. |
| 6.6 | **Sin custom dashboards** | 🟢 P2 | 4-6 semanas | No se pueden crear dashboards custom tipo Grafana. |
| 6.7 | **Header usa mock incidents** | 🟡 P1 | 1 día | El badge de notificaciones y el popover de incidentes vienen de `mock.ts`. |
| 6.8 | **Breadcrumbs usan mock** | 🟢 P2 | 1 día | Los breadcrumbs del Header no reflejan la navegación real con datos reales. |
| 6.9 | **Sin keyboard shortcuts reales** | 🟢 P2 | 2-3 días | Los shortcuts (G+D, G+I) no funcionan — solo son decorativos en la ayuda. |

**Total Pilar 6: ~5-8 semanas**

### Pilar 7: Infraestructura & Deploy

| # | Gap | Prioridad | Esfuerzo | Detalle técnico |
|---|---|---|---|---|
| 7.1 | **Sin Dockerfile** | 🔴 P0 | 1 día | No hay contenedor para deploy. |
| 7.2 | **Sin docker-compose** | 🔴 P0 | 1 día | No hay orquestación local con dependencias (NATS, VictoriaMetrics, etc.). |
| 7.3 | **Sin estrategia de deploy** | 🔴 P0 | 1 día | No hay script de build + deploy para producción. |
| 7.4 | **Sin monitoreo del monitor** | 🟡 P1 | 2-3 días | Si la plataforma se cae, no hay alerta. Necesitamos healthcheck + uptime monitor. |
| 7.5 | **Sin backup de configuración** | 🟡 P1 | 1 día | `.data/credentials.json` no tiene backup. Si se pierde el disco, se pierden las creds. |
| 7.6 | **Sin secret management** | 🟡 P1 | 2-3 días | Las credenciales deberían ir a un vault (AWS Secrets Manager, HashiCorp Vault) en vez de JSON plano. |
| 7.7 | **Sin environment config** | 🟡 P1 | 1 día | No hay separación dev/staging/prod. Misma configuración para todo. |
| 7.8 | **Sin logs de la plataforma misma** | 🟢 P2 | 2-3 días | La app no logea sus propias operaciones (errores, accesos, rendimiento). |

**Total Pilar 7: ~1-2 semanas (rápido de implementar)**

---

## 4. Quick-Wins (Primera Semana)

Estos items se pueden resolver en **3-5 días** y tienen alto impacto:

| Gap | Tiempo | Impacto |
|---|---|---|
| 4.2 — Encriptar AWS keys en storage | 2-3h | ❌ Crítico: seguridad |
| 5.1 — Fix hydration error Header | 30 min | ✅ UX limpio |
| 4.3 — Forzar HTTPS | 1h | ❌ Crítico: seguridad |
| 7.1 — Dockerfile + docker-compose | 2-3h | ✅ Facilita deploy |
| 6.7 — Header con incidentes reales | 2h | ✅ Datos reales |
| 6.3 — SearchDialog con datos reales | 3-4h | ✅ Búsqueda real |
| 6.9 — Implementar keyboard shortcuts reales | 2h | ✅ UX avanzado |
| 4.4 — Rate limiting en API routes | 3-4h | ❌ Crítico: costo AWS |
| 5.6 — Estandarizar manejo de errores en API | 3h | ✅ Consistencia |

---

## 5. Roadmap Recomendado (Fases)

### Fase 0: Quick-Wins (Semana 1)
- Hydration error Header (`render` prop en PopoverTrigger)
- Encriptar secrets en storage (AES-256-GCM)
- HTTPS + CSP headers
- Dockerfile + docker-compose
- Rate limiting en API routes
- SearchDialog con datos reales
- Header con incidentes reales (CloudTrail)

### Fase 1: Pipeline de Datos (Semanas 2-5)
- Desplegar NATS JetStream (3 nodos)
- Desplegar OpenTelemetry Collectors en EC2/ECS
- OTEL → VictoriaMetrics (métricas), Quickwit (logs), Tempo (trazas)
- Migrar dashboard a streaming vs polling
- Conectar todas las páginas a datos reales (eliminar mock)

### Fase 2: Alerting & Slack (Semanas 5-7)
- Configurar AlertManager con reglas de threshold
- Slack webhook + Slack bot (@ObsBot)
- Workflow de incidentes (acknowledge → resolve)
- Políticas de escalamiento

### Fase 3: Calidad & Testing (Semanas 7-10)
- Playwright E2E tests (login, dashboard, service detail)
- Unit tests (API routes, store, utils)
- CI/CD pipeline (GitHub Actions)
- Paginación + filtros en todas las tablas

### Fase 4: IA/ML (Semanas 10-16)
- Anomaly detection con Prophet
- NLP sobre logs con Quickwit + LLM
- Forecasting de métricas
- RCA automatizado

### Fase 5: Productivo Final (Semana 16+)
- Autenticación (Auth0 o NextAuth)
- RBAC (admin, viewer)
- Custom dashboards
- Export de datos
- Monitoreo del monitor (Sentry + uptime)

---

## 6. Conclusión

### Lo que ya está sólido:
- **Frontend**: Arquitectura limpia, shadcn/ui completo, TanStack Query, tema dark/light, good UX patterns (ErrorBoundary, Skeleton, Suspense).
- **Conexión AWS**: SDKs instalados para 12 servicios, endpoints funcionales (STS, CloudWatch, CloudTrail), credentials CRUD completo.

### El gap más grande:
**La plataforma no tiene datos propios.** Depende 100% de llamadas en vivo a CloudWatch. No hay retención histórica, no hay logs, no hay trazas. Sin un pipeline de datos (NATS → OTEL → VictoriaMetrics/Quickwit), no se puede hacer IA/ML, ni alerting inteligente, ni forensics.

### Estimación total:

| Fase | Tiempo | Equipo requerido |
|---|---|---|
| Fase 0 — Quick-Wins | 1 semana | 1 senior |
| Fase 1 — Pipeline | 4 semanas | 2 seniors (infra + backend) |
| Fase 2 — Alerting | 2 semanas | 1 senior |
| Fase 3 — Calidad | 3 semanas | 1 senior + 1 QA |
| Fase 4 — IA/ML | 6 semanas | 1 ML engineer + 1 backend |
| Fase 5 — Productivo | 4 semanas | 1 full-stack + 1 DevOps |

**Total: ~20 semanas (5 meses) con equipo de 2-3 personas.**

---

*Documento generado por Kowa · Basado en análisis de código real + `docs/observability-architecture.md`*