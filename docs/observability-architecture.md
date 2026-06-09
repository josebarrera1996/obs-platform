# ObsPlatform — Arquitectura de Observabilidad Productiva

> **Autor**: Kowa · **Fecha**: junio 2026  
> **Objetivo**: Transformar el mockup actual en una plataforma de observabilidad productiva para monitoreo de infraestructura AWS (EC2, ECS), con integración Slack, capacidades de IA/ML, y retención de datos para analytics.

---

## Tabla de Contenidos

1. [Estado Actual](#1-estado-actual)
2. [Requisitos de Negocio](#2-requisitos-de-negocio)
3. [Arquitectura de Referencia — Cómo lo hacen los líderes](#3-arquitectura-de-referencia)
4. [Propuesta A: Hybrid Open-Source Stack](#4-propuesta-a-hybrid-open-source-stack)
5. [Propuesta B: Elastic Stack (ELK)](#5-propuesta-b-elastic-stack-elk)
6. [Comparativa detallada](#6-comparativa-detallada)
7. [Pipeline de IA/ML](#7-pipeline-de-iaml)
8. [Integración con Slack](#8-integración-con-slack)
9. [Recomendación Final](#9-recomendación-final)
10. [Roadmap de Implementación](#10-roadmap-de-implementación)
11. [Arquitectura de Datos — Flujo completo](#11-arquitectura-de-datos)
12. [Apéndice: Stack Tecnológico del Portal](#12-apéndice-stack-tecnológico-del-portal)

---

## 1. Estado Actual

El portal de observabilidad (`ObsPlatform`) cuenta actualmente con:

| Capa | Estado | Stack |
|---|---|---|
| **Frontend** | ✅ Funcional | Next.js 16 + React 19 + Tailwind v4 + shadcn/ui v4 + Recharts |
| **Routing** | 6 páginas | Dashboard, Account Detail, Service Detail, Operation Detail, Incidents, 404 |
| **Estado** | TanStack Query v5 | Stale time 30s, refetch 60s |
| **Mock Data** | 5 cuentas, 35 servicios, 25 operaciones, 9 incidentes | `src/data/mock.ts` |
| **Backend real** | ❌ Inexistente | Datos estáticos |
| **Ingestión** | ❌ Inexistente | Sin conexión a infraestructura real |
| **Alerting** | ❌ Inexistente | Sin notificaciones |
| **IA/ML** | ❌ Inexistente | Sin anomalías, sin RCA |

**Conclusión**: El frontend está listo para producción. El gap está en todo el pipeline de datos: ingestión → procesamiento → almacenamiento → analítica → alerting.

---

## 2. Requisitos de Negocio

### Infraestructura a monitorear
- **AWS EC2**: instancias de cómputo (CPU, memoria, disco, red)
- **AWS ECS**: múltiples productos corriendo como servicios containerizados (Fargate o EC2-backed)
- **APIs internas**: health checks, latencia, tasas de error
- **Bases de datos**: RDS, DynamoDB, ElastiCache (métricas de query performance)

### Capacidades requeridas
| Requisito | Prioridad | Detalle |
|---|---|---|
| **Real-time monitoring** | P0 | Dashboards con <5s de latencia de datos |
| **Log retention** | P0 | Retener logs al menos 30 días para analytics |
| **AI Anomaly Detection** | P0 | Detectar patrones anómalos sin thresholds manuales |
| **AI Root Cause Analysis** | P1 | Sugerir causas raíz ante incidentes |
| **Slack Integration** | P0 | Alertas, notificaciones, y comandos desde Slack |
| **Multi-account** | P1 | Múltiples cuentas AWS, múltiples productos |
| **Historical analytics** | P1 | Entrenar modelos sobre datos históricos |
| **Baja latencia** | P0 | Consultas de logs/métricas <1s en hot tier |

---

## 3. Arquitectura de Referencia

### Cómo lo hacen los líderes

```
                        DATADOG                              GRAFANA LGTM
                   ┌─────────────────┐                 ┌─────────────────┐
  COLECTORES       │ Agent (Go)      │                 │ Grafana Alloy   │
                   │ 100+ built-in   │                 │ (OTel-based)    │
                   └────────┬────────┘                 └────────┬────────┘
                            │                                   │
                   ┌────────▼────────┐                 ┌────────▼────────┐
  COLA             │ KAFKA ✅        │                 │ ❌ Sin cola     │
  (BUFFER)         │ Particionado    │                 │ Push directo    │
                   │ Replayable      │                 │ Riesgo pérdida  │
                   └────────┬────────┘                 └────────┬────────┘
                            │                                   │
                   ┌────────▼────────┐                 ┌────────▼────────┐
  PROCESAMIENTO    │ Flink / Go      │                 │ Loki/Tempo      │
                   │ Stream proc.    │                 │ /Mimir          │
                   │ Enriquecimiento │                 │ Procesan directo│
                   └────────┬────────┘                 └────────┬────────┘
                            │                                   │
                   ┌────────▼────────┐                 ┌────────▼────────┐
  ALMACENAMIENTO   │ Multi-tier      │                 │ Object Storage  │
                   │ RAM→SSD→S3→Glac │                 │ (S3/GCS)        │
                   └────────┬────────┘                 └────────┬────────┘
                            │                                   │
                   ┌────────▼────────┐                 ┌────────▼────────┐
  ML/AI            │ Watchdog (ML)   │                 │ ❌ No nativo    │
                   │ Anomaly detect  │                 │ Se delega a     │
                   │ Forecasting     │                 │ herramientas ext│
                   └─────────────────┘                 └─────────────────┘
```

**Lecciones aprendidas:**

1. **Kafka es el diferenciador**. Datadog no pierde datos en picos porque Kafka absorbe la presión. LGTM pierde datos si el backend se satura.
2. **Multi-tier storage es obligatorio**. No podés consultar datos de hace 6 meses con la misma latencia que datos de hace 5 minutos. Hot/Warm/Cold es el estándar.
3. **El ML es el nuevo campo de batalla**. Datadog invierte fuerte en Watchdog (anomaly detection automático). LGTM no tiene equivalente nativo.
4. **Elastic (ELK) ocupa un lugar intermedio**: tiene todo en uno (ingestión, búsqueda, ML, visualización) pero con mayor costo operativo y de licenciamiento.

---

## 4. Propuesta A: Hybrid Open-Source Stack

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AWS INFRASTRUCTURE                                │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  EC2 #1  │  │  EC2 #2  │  │ ECS Svc A│  │ ECS Svc B│  ...          │
│  │  OTel    │  │  OTel    │  │  OTel    │  │  OTel    │               │
│  │  Agent   │  │  Agent   │  │  Sidecar │  │  Sidecar │               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │              │              │              │                     │
│       └──────────────┴──────────────┴──────────────┘                     │
│                          │ OTLP (gRPC/HTTP)                              │
└──────────────────────────┼──────────────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │   NATS JETSTREAM        │  ◄── COLA DE MENSAJES
              │   · Sub-millisecond     │      (la más rápida, CNCF)
              │   · At-least-once       │
              │   · Stream replay       │
              │   · 10M msgs/sec        │
              └────────────┬────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
  │  OTEL       │  │  OTEL       │  │  OTEL       │
  │  COLLECTOR  │  │  COLLECTOR  │  │  COLLECTOR  │
  │  (metrics)  │  │  (logs)     │  │  (traces)   │
  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
         │                 │                 │
  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
  │ VICTORIA    │  │  QUICKWIT   │  │  GRAFANA    │
  │ METRICS     │  │  (logs)     │  │  TEMPO      │
  │ (TSDB)      │  │  (search)   │  │  (traces)   │
  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
              ┌────────────▼────────────┐
              │   S3 (Object Storage)    │  ◄── COLD TIER
              │   · Compressed           │      Datos >7 días
              │   · Parquet format       │
              └──────────────────────────┘
```

### Componentes

| Componente | Rol | ¿Por qué? |
|---|---|---|
| **OpenTelemetry Collector** | Recolección universal | Estándar CNCF. Agents en cada host + sidecars en ECS |
| **NATS JetStream** | Message Queue | 10x más rápido que Kafka, 5x más simple de operar. Latencia sub-ms |
| **VictoriaMetrics** | Métricas (TSDB) | Compatible con Prometheus pero 10x más rápido en ingestión. Compresión 10:1 |
| **Quickwit** | Logs + Búsqueda | Alternativa a Elasticsearch escrita en Rust. 10x más barata en storage (object storage nativo). Sub-segundo en búsquedas |
| **Grafana Tempo** | Trazas distribuidas | Object storage nativo, sin índice, escalable |
| **S3** | Cold storage | Datos comprimidos >7 días para ML training |
| **PostgreSQL** | Metadata | Configuración, cuentas, usuarios, preferencias |
| **AlertManager** | Reglas de alerta | Routing a Slack, PagerDuty, email |
| **ObsPortal** | Frontend unificado | Ya construido en Next.js 16 |

### Ventajas

- ✅ **Sin vendor lock-in**. Todo open-source, self-hosted.
- ✅ **Bajo costo operativo**. NATS + VictoriaMetrics + Quickwit son eficientes en recursos.
- ✅ **Escalabilidad horizontal**. Cada componente escala independientemente.
- ✅ **Quickwit reemplaza Elasticsearch** con 10x menos costo de storage.
- ✅ **NATS JetStream es más simple que Kafka** para equipos pequeños.

### Desventajas

- ❌ Requiere integrar 5-6 componentes distintos.
- ❌ El ML pipeline hay que construirlo custom (no viene out-of-the-box).
- ❌ Más superficie de monitoreo y operación.

---

## 5. Propuesta B: Elastic Stack (ELK)

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AWS INFRASTRUCTURE                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  EC2 #1  │  │  EC2 #2  │  │ ECS Svc A│  │ ECS Svc B│               │
│  │ Elastic  │  │ Elastic  │  │ Elastic  │  │ Elastic  │               │
│  │ Agent    │  │ Agent    │  │ Agent    │  │ Agent    │               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │              │              │              │                     │
│       └──────────────┴──────────────┴──────────────┘                     │
│                          │ HTTP / Fleet API                              │
└──────────────────────────┼──────────────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │   ELASTICSEARCH          │  ◄── UNIFIED DATA LAYER
              │   · Métricas             │      Todo en un solo engine:
              │   · Logs                 │      ingesta, búsqueda,
              │   · Trazas (APM)         │      analítica, ML
              │   · Índices separados    │
              │                          │
              │  ┌──────────────────┐    │
              │  │  ML Jobs (nativo)│    │  ◄── ANOMALY DETECTION
              │  │  · Anomaly det.  │    │      out-of-the-box
              │  │  · Forecasting   │    │
              │  │  · NLP (ESRE)    │    │
              │  └──────────────────┘    │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │   KIBANA                │  ◄── VISUALIZACIÓN NATIVA
              │   · Dashboards          │      Se puede usar Kibana
              │   · APM UI              │      O nuestro ObsPortal
              │   · Alerting            │      como frontend custom
              │   · Fleet Management    │
              └──────────────────────────┘
```

### Componentes

| Componente | Rol | ¿Por qué? |
|---|---|---|
| **Elastic Agent** | Recolección unificada | Un solo agente para métricas, logs, trazas. Fleet management centralizado |
| **Elasticsearch** | Motor unificado | Almacena y consulta TODO (métricas, logs, trazas) en un solo engine |
| **Elastic ML** | Anomaly detection | Jobs nativos: single metric, multi-metric, population, categorization |
| **Elastic APM** | Trazas distribuidas | Integrado en el stack, sin componente externo |
| **Kibana** | Visualización | Se puede usar como fallback, pero nuestro ObsPortal sería el frontend |
| **Elastic Alerting** | Reglas + conectores | Conectores nativos: Slack, Jira, ServiceNow, email, PagerDuty |
| **Fleet** | Gestión de agentes | Políticas centralizadas, actualizaciones, health de agents |

### Ventajas

- ✅ **Un solo vendor, un solo stack**. Menos integración.
- ✅ **ML out-of-the-box**: anomaly detection, forecasting, log categorization sin construir nada.
- ✅ **Fleet Management**: gestionar 50+ agents desde un solo panel.
- ✅ **Alerting con conectores nativos**: Slack, Jira, etc. sin AlertManager.
- ✅ **ESRE (Elasticsearch Relevance Engine)**: NLP sobre logs, búsqueda semántica.
- ✅ **Ecosistema maduro**: documentación, comunidad, soporte enterprise.

### Desventajas

- ❌ **Costo de licenciamiento**. Elasticsearch es gratis (Elastic License 2.0 / SSPL), pero features enterprise (ML avanzado, alerting avanzado, Fleet a escala) requieren licencia Platinum/Enterprise.
- ❌ **Consumo de recursos**. Elasticsearch es pesado en RAM y CPU. Un cluster productivo empieza en 16 GB RAM por nodo.
- ❌ **Operación compleja**. Shard management, rebalancing, snapshot policies requieren expertise.
- ❌ **Vendor lock-in**. Si bien es open source, migrar fuera de Elastic es costoso.

---

## 6. Comparativa Detallada

| Dimensión | Propuesta A (Hybrid OS) | Propuesta B (Elastic) |
|---|---|---|
| **Recolección** | OTel Collector (estándar CNCF) | Elastic Agent (propietario) |
| **Message Queue** | NATS JetStream | ❌ No tiene (Elasticsearch es el buffer) |
| **Métricas** | VictoriaMetrics | Elasticsearch (data streams) |
| **Logs** | Quickwit (Rust, 10x más barato) | Elasticsearch |
| **Trazas** | Grafana Tempo | Elastic APM |
| **ML/Anomaly Detection** | ❌ Hay que construirlo | ✅ Nativo (single/multi-metric, categorization) |
| **NLP sobre logs** | ❌ Hay que integrarlo | ✅ ESRE (built-in) |
| **Alerting** | AlertManager + webhooks | ✅ Nativo con conectores |
| **Fleet Management** | ❌ Manual | ✅ Fleet (centralizado) |
| **Licenciamiento** | 100% open-source (MIT/Apache) | Elastic License 2.0 / SSPL. Features avanzados = pago |
| **Costo infra (50 hosts)** | ~$300-500/mes | ~$800-1500/mes (o licencia) |
| **Curva de aprendizaje** | Alta (6 herramientas) | Media (1 ecosistema) |
| **Escalabilidad** | Horizontal, cada capa independiente | Horizontal, pero más rígido |
| **Integración c/Slack** | Vía AlertManager + webhooks | Nativo (Elastic Alerts → Slack connector) |
| **Customización** | Máxima (cada pieza es intercambiable) | Limitada al ecosistema Elastic |

---

## 7. Pipeline de IA/ML

Este es el componente diferencial del portal.

### 7.1 Capacidades de IA necesarias

| Capacidad | Descripción | Prioridad |
|---|---|---|
| **Anomaly Detection** | Detectar spikes de latencia, caídas de RPS, errores sin thresholds manuales | P0 |
| **Log Pattern Recognition** | Agrupar logs similares, detectar nuevos patrones de error | P0 |
| **Root Cause Analysis (RCA)** | Ante un incidente, sugerir el servicio/origen más probable | P1 |
| **Forecasting** | Predecir saturación de recursos (CPU, memoria, disco) | P1 |
| **Incident Correlation** | Correlacionar métricas + logs + trazas para armar timeline del incidente | P1 |
| **NLQ (Natural Language Query)** | "¿Cuál fue la latencia p95 del servicio checkout ayer?" | P2 |
| **Behavioral Baseline** | Aprender el patrón normal de cada servicio para detectar desviaciones | P0 |

### 7.2 Arquitectura del ML Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                    ML PIPELINE                                │
│                                                               │
│  ┌───────────┐   ┌───────────┐   ┌───────────────────────┐  │
│  │ S3        │   │ Quickwit  │   │ VictoriaMetrics       │  │
│  │ (histórico│   │ (logs     │   │ (métricas time-series)│  │
│  │  logs)    │   │  recient) │   │                       │  │
│  └─────┬─────┘   └─────┬─────┘   └───────────┬───────────┘  │
│        │               │                     │               │
│        └───────────────┼─────────────────────┘               │
│                        │                                     │
│            ┌───────────▼───────────┐                         │
│            │   FEATURE STORE       │  ◄── PostgreSQL          │
│            │   · Aggregaciones     │      Features pre-       │
│            │   · Ventanas (1h,24h) │      computadas para     │
│            │   · Embeddings        │      training            │
│            └───────────┬───────────┘                         │
│                        │                                     │
│        ┌───────────────┼───────────────┐                     │
│        │               │               │                     │
│  ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐               │
│  │ ANOMALY   │  │ LOG       │  │ FORECAST  │               │
│  │ DETECTION │  │ CLUSTERING│  │ MODEL     │               │
│  │           │  │           │  │           │               │
│  │ Isolation │  │ Log       │  │ Prophet   │               │
│  │ Forest    │  │ embeddings│  │ / TFT     │               │
│  │ + LSTM-AE│  │ + HDBSCAN │  │           │               │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘               │
│        │               │               │                     │
│        └───────────────┼───────────────┘                     │
│                        │                                     │
│            ┌───────────▼───────────┐                         │
│            │   INFERENCE ENGINE    │  ◄── FastAPI (Python)    │
│            │   · Real-time scoring │      Modelos servidos    │
│            │   · Batch predictions │      vía REST/gRPC       │
│            └───────────┬───────────┘                         │
│                        │                                     │
│            ┌───────────▼───────────┐                         │
│            │   ObsPortal API       │  ◄── Next.js API Routes  │
│            │   · /api/anomalies    │      El frontend consume │
│            │   · /api/rca          │      estas APIs          │
│            │   · /api/forecast     │                         │
│            └───────────────────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 Algoritmos propuestos

| Caso de Uso | Algoritmo | ¿Por qué? |
|---|---|---|
| **Anomaly Detection (métricas)** | Isolation Forest + LSTM Autoencoder | IF detecta anomalías puntuales, LSTM-AE aprende patrones temporales normales |
| **Log Pattern Recognition** | Sentence Transformers (embeddings) + HDBSCAN | Agrupa logs semánticamente sin necesidad de regex manuales |
| **Forecasting** | Facebook Prophet o Temporal Fusion Transformer | Prophet es simple y efectivo para seasonality. TFT si hay muchas features |
| **RCA** | Graph Neural Network sobre service topology + Bayesian inference | Propaga probabilidad de falla a través del grafo de dependencias |
| **NLQ** | LLM (GPT-4o / Claude) con RAG sobre documentación de servicios | Text-to-SQL/metrics para queries en lenguaje natural |

### 7.4 Entrenamiento y retraining

```
┌──────────────────────────────────────────────────────────┐
│  TRAINING PIPELINE                                        │
│                                                           │
│  FRECUENCIA:                                              │
│  · Behavioral baselines: cada 24h (ventana de 7 días)    │
│  · Log clustering: cada 1h (logs nuevos)                  │
│  · Forecasting: cada 6h (re-entrenar con datos frescos)  │
│                                                           │
│  INFRA:                                                   │
│  · GPU opcional (T4/L4 en AWS) para LLM embeddings        │
│  · CPU suficiente para Isolation Forest y Prophet         │
│  · MLflow para tracking de experimentos                   │
│                                                           │
│  VALIDACIÓN:                                              │
│  · Precision@K para anomaly detection                     │
│  · Silhouette score para log clustering                   │
│  · MAPE para forecasting                                  │
└──────────────────────────────────────────────────────────┘
```

---

## 8. Integración con Slack

### 8.1 Flujo de alertas

```
┌──────────┐    ┌──────────────┐    ┌───────────┐    ┌──────────┐
│ VICTORIA │    │ ALERTMANAGER │    │ SLACK     │    │ SLACK    │
│ METRICS  │───▶│ · Evalúa     │───▶│ WEBHOOK   │───▶│ CHANNEL  │
│          │    │   reglas     │    │           │    │ #incident│
│ QUICKWIT │    │ · Agrupa     │    └───────────┘    └────┬─────┘
│ (logs)   │    │ · Silencia   │                         │
└──────────┘    └──────────────┘              ┌──────────▼─────┐
                                              │ INTERACTIVIDAD │
                                              │ · /obs status  │
                                              │ · /obs ack     │
                                              │ · /obs resolve │
                                              └────────────────┘
```

### 8.2 Capacidades Slack

| Funcionalidad | Tipo | Descripción |
|---|---|---|
| **Alertas** | Push | Mensaje en `#incidents` con: severity, servicio, métrica afectada, link al dashboard |
| **Daily Digest** | Push programado | Resumen diario a las 9am: incidentes ayer, servicios degradados, anomalías detectadas |
| **Slash Commands** | Interactivo | `/obs status` → estado de todos los servicios. `/obs incident <id>` → detalle |
| **Botón "Investigar"** | Interactivo | En cada alerta, botón que dispara análisis de IA y postea RCA preliminar en thread |
| **Acknowledge/Resolve** | Interactivo | Botones en el mensaje: Acknowledge, Escalate, Resolve |
| **War Room** | Colaboración | Ante incidentes críticos, crear canal temporal con todas las partes relevantes |

---

## 9. Recomendación Final

### 🏆 **Recomendación: Propuesta A (Hybrid Open-Source) con ML Pipeline Custom**

**Justificación:**

1. **Menor costo a largo plazo**. Elastic License Enterprise cuesta ~$95-175 por nodo/mes. Para 10 nodos son $950-$1,750/mes solo en licencia. La propuesta A no tiene costo de licencia.

2. **NATS JetStream es el diferenciador**. Elasticsearch no tiene cola de mensajes — si Elasticsearch se satura, los agents pierden datos. NATS garantiza entrega y permite replay.

3. **Quickwit es el futuro**. Escrito en Rust, object storage nativo, 10x más barato en storage que Elasticsearch para logs. Para una empresa que crece, el costo de almacenar logs en Elasticsearch se vuelve prohibitivo.

4. **Flexibilidad**. Cada componente se puede reemplazar sin tocar los demás. ¿Quickwit no escala? → migrate logs a Elasticsearch solo para logs. ¿VictoriaMetrics no alcanza? → podés agregar Mimir. Elastic es monolítico.

5. **El ML pipeline custom** es una inversión inicial, pero te da control total. Con Elastic ML estás limitado a lo que Elastic ofrece. Con un pipeline custom podés integrar LLMs, modelos custom, y RAG sobre tu documentación interna.

### ⚠️ Cuándo elegir Elastic

Elegí Elastic si:
- El equipo es chico (<5 personas) y no puede mantener 6 herramientas
- Necesitás ML out-of-the-box **ya**, sin esperar a construir el pipeline
- El costo de licencia no es problema
- Querés Fleet Management centralizado para 100+ agents

### 🔄 Estrategia híbrida (opción C)

Existe un camino intermedio:
- **Usar Elasticsearch solo para logs** (donde su motor de búsqueda brilla)
- **VictoriaMetrics para métricas** (donde Elasticsearch es débil)
- **NATS como cola universal**
- **ML pipeline custom** consumiendo de ambas fuentes

---

## 10. Roadmap de Implementación

### Fase 1: Fundamentos (Semana 1-2)
- [ ] Desplegar NATS JetStream cluster (3 nodos)
- [ ] Desplegar OpenTelemetry Collectors en EC2 y ECS
- [ ] Configurar pipelines OTel: métricas → VictoriaMetrics, logs → Quickwit, trazas → Tempo
- [ ] Desplegar VictoriaMetrics (single node → cluster)
- [ ] Desplegar Quickwit (single node → cluster)
- [ ] Desplegar Grafana Tempo
- [ ] Conectar ObsPortal a APIs reales (reemplazar mock data)

### Fase 2: Alerting + Slack (Semana 3)
- [ ] Configurar AlertManager con reglas básicas (CPU > 80%, error rate > 5%)
- [ ] Integrar Slack webhook para alertas
- [ ] Implementar Slash Commands básicos (`/obs status`)
- [ ] Crear canal `#incidents` con alertas formateadas

### Fase 3: ML Pipeline (Semana 4-6)
- [ ] Configurar Feature Store (PostgreSQL + agregaciones)
- [ ] Implementar Anomaly Detection (Isolation Forest) sobre métricas
- [ ] Implementar Log Clustering (Sentence Transformers + HDBSCAN)
- [ ] Exponer APIs: `/api/anomalies`, `/api/rca`, `/api/forecast`
- [ ] Conectar ObsPortal a ML APIs

### Fase 4: Features Avanzadas (Semana 7-8)
- [ ] Forecasting (Prophet) para predicción de recursos
- [ ] RCA engine (Graph NN + Bayesian inference)
- [ ] Botón "Investigar con IA" en Slack → thread con análisis
- [ ] Daily Digest automatizado en Slack

### Fase 5: Maduración (Semana 9-12)
- [ ] NLQ: queries en lenguaje natural
- [ ] Behavioral baselines por servicio
- [ ] Incident correlation automática
- [ ] Dashboards customizables en ObsPortal
- [ ] Exportación de datos para compliance/auditoría

---

## 11. Arquitectura de Datos — Flujo Completo

```
                        ┌──────────────────────────────┐
                        │     AWS INFRASTRUCTURE        │
                        │                               │
                        │  EC2 ──┐    ECS ──┐          │
                        │        │          │          │
                        │  ┌─────▼──────────▼─────┐    │
                        │  │  OpenTelemetry Agent │    │
                        │  │  · Host metrics      │    │
                        │  │  · Container metrics │    │
                        │  │  · Log tailing       │    │
                        │  │  · Traces (OTLP)     │    │
                        │  └──────────┬──────────┘    │
                        └─────────────┼───────────────┘
                                      │ OTLP (gRPC)
                         ┌────────────▼────────────┐
                         │    NATS JETSTREAM        │
                         │                          │
                         │  Stream: metrics         │
                         │  Stream: logs            │
                         │  Stream: traces          │
                         │                          │
                         │  Retention: 7d           │
                         │  Replicas: 3             │
                         │  Storage: local SSD      │
                         └────────────┬─────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
    ┌─────────▼──────┐    ┌──────────▼──────┐    ┌──────────▼──────┐
    │ OTEL COLLECTOR │    │ OTEL COLLECTOR  │    │ OTEL COLLECTOR  │
    │ (metrics)      │    │ (logs)          │    │ (traces)        │
    │                │    │                 │    │                 │
    │ · Aggregation  │    │ · Parsing       │    │ · Sampling      │
    │ · Filtering    │    │ · Enrichment    │    │ · Tail-based    │
    │ · Relabeling   │    │ · Masking PII   │    │                 │
    └─────────┬──────┘    └──────────┬──────┘    └──────────┬──────┘
              │                       │                       │
    ┌─────────▼──────┐    ┌──────────▼──────┐    ┌──────────▼──────┐
    │ VICTORIAMETRICS│    │    QUICKWIT     │    │  GRAFANA TEMPO  │
    │                │    │                 │    │                 │
    │ · PromQL       │    │ · Full-text     │    │ · TraceQL       │
    │ · MetricsQL    │    │   search        │    │ · Trace ID      │
    │ · Downsampling │    │ · Aggregations  │    │   lookup        │
    │ · Retention    │    │ · Retention 30d │    │ · Retention 7d  │
    │   2y (S3)      │    │   then → S3     │    │   then → S3     │
    └─────────┬──────┘    └──────────┬──────┘    └──────────┬──────┘
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │    S3 + GLACIER          │
                         │                          │
                         │  Format: Parquet         │
                         │  Compression: ZSTD       │
                         │  Partition: YYYY/MM/DD   │
                         │                          │
                         │  Hot (<7d): Standard     │
                         │  Warm (7-30d): IA        │
                         │  Cold (>30d): Glacier    │
                         └──────────────────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │    ML PIPELINE           │
                         │                          │
                         │  Lee de S3 (batch)       │
                         │  + Quickwit/Victoria     │
                         │  (real-time)             │
                         │                          │
                         │  → Anomaly Detection     │
                         │  → Log Clustering        │
                         │  → Forecasting           │
                         │  → RCA Engine            │
                         └────────────┬────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │    OBSPORTAL API         │
                         │    (Next.js 16)          │
                         │                          │
                         │  GET /api/accounts       │
                         │  GET /api/metrics        │
                         │  GET /api/logs           │
                         │  GET /api/traces         │
                         │  GET /api/anomalies      │
                         │  GET /api/rca            │
                         │  GET /api/forecast       │
                         └────────────┬────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │    OBSPORTAL UI          │
                         │    (React 19 + Tremor)   │
                         │                          │
                         │  Dashboard · Accounts    │
                         │  Services · Operations   │
                         │  Incidents · Traces      │
                         └──────────────────────────┘
```

---

## 12. Apéndice: Stack Tecnológico del Portal

| Capa | Tecnología | Versión (junio 2026) |
|---|---|---|
| Framework | Next.js | 16.2.7 (LTS) |
| Runtime | React | 19.2.4 |
| Estilos | Tailwind CSS | v4.2 |
| UI Kit | shadcn/ui | CLI v4 (Base UI) |
| Gráficos | Recharts + Tremor | latest |
| Data Fetching | TanStack Query | v5.100+ |
| Estado | Zustand | latest |
| Tipografía | Inter (Google Fonts) | latest |
| Íconos | Lucide React | latest |
| Fechas | date-fns | v4 |
| Package Manager | Bun | 1.3.x |
| Lint/Format | Biome | latest |

---

> **Próximo paso**: Iniciar Fase 1 — desplegar NATS JetStream y OpenTelemetry Collectors.
