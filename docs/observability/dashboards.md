# Observability Dashboards

## Quick Links

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| **Grafana** | http://localhost:3000 | Metrics visualization |
| **Jaeger** | http://localhost:16686 | Distributed tracing |
| **Prometheus** | http://localhost:9090 | Metrics queries |
| **Sentry** | https://sentry.io | Error tracking |

## Grafana Dashboards

### API Performance Dashboard

Key panels:
- Request rate (req/s)
- Error rate (%)
- P50/P95/P99 latency
- Status code distribution

Import from: `docs/observability/grafana/api-performance.json`

### Database Performance Dashboard

Key panels:
- Query count per request
- N+1 detection warnings
- Connection pool utilization
- Slow query frequency

### Business Metrics Dashboard

Key panels:
- Active users
- Teams created
- Queries submitted
- Approval rate

## Prometheus Queries

### Request Rate
```promql
sum(rate(http_request_duration_ms_count[5m])) by (route)
```

### Error Rate
```promql
sum(rate(http_request_duration_ms_count{status_code=~"5.."}[5m]))
/ sum(rate(http_request_duration_ms_count[5m]))
```

### P95 Latency
```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_ms_bucket[5m])) by (le, route)
)
```

### Top Slow Routes
```promql
topk(10,
  histogram_quantile(0.95,
    sum(rate(http_request_duration_ms_bucket[5m])) by (le, route)
  )
)
```

## Jaeger Tracing

### Viewing Traces

1. Open Jaeger UI: http://localhost:16686
2. Select service: `quorum-sql-server`
3. Set time range and search

### Key Traces to Monitor

- **Auth flows**: Login, register, session validation
- **Query operations**: Create, update, submit for approval
- **Approval workflow**: Submit → Approve → Status update

### Trace Sampling

Production sampling rate: 10% (`tracesSampleRate: 0.1`)
Development: 100% (`tracesSampleRate: 1.0`)

## Sentry Error Tracking

### Dashboard URL
https://sentry.io/organizations/YOUR_ORG/projects/quorum-sql-server/

### Key Views

1. **Issues**: Grouped errors by type
2. **Performance**: Transaction timing
3. **Releases**: Error rate by version

### Custom Tags

All errors include:
- `requestId`: Correlation ID
- `method`: HTTP method
- `url`: Request path
- `userId`: (when available)

## Docker Compose Setup

Add to `docker-compose.yml` for local observability:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus:/etc/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "4318:4318"    # OTLP HTTP
    environment:
      - COLLECTOR_OTLP_ENABLED=true

volumes:
  grafana-data:
```

## Environment Variables

```bash
# Metrics
ENABLE_METRICS=true
METRICS_AUTH_TOKEN=your-secret-token

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_SERVICE_NAME=quorum-sql-server

# Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx
```
