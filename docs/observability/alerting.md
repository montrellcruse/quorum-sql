# Alerting Configuration

This document describes alerting rules for Quorum SQL monitoring.

## Prometheus Alert Rules

Create a file `prometheus/alerts.yml` with these rules:

```yaml
groups:
  - name: quorum-sql
    interval: 30s
    rules:
      # High Error Rate
      - alert: HighErrorRate
        expr: |
          sum(rate(http_request_duration_ms_count{status_code=~"5.."}[5m]))
          / sum(rate(http_request_duration_ms_count[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"

      # High Latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_ms_bucket[5m])) by (le)
          ) > 2000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "P95 latency is {{ $value }}ms (threshold: 2000ms)"

      # Service Down
      - alert: ServiceDown
        expr: up{job="quorum-sql-server"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Quorum SQL server is down"
          description: "The server has been unreachable for more than 1 minute"

      # Database Connection Issues
      - alert: DatabaseConnectionFailure
        expr: |
          sum(rate(http_request_duration_ms_count{route="/health/db",status_code!="200"}[5m])) > 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connectivity issues"
          description: "Health check /health/db is failing"

      # High Query Count (N+1 detection)
      - alert: PossibleNPlusOne
        expr: |
          rate(quorum_sql_high_query_count_total[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Possible N+1 queries detected"
          description: "High query count warnings are being logged frequently"
```

## Environment Variables for Alerting

```bash
# Prometheus Alertmanager
ALERTMANAGER_URL=http://alertmanager:9093

# PagerDuty (optional)
PAGERDUTY_ROUTING_KEY=your-routing-key

# Slack (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## Alertmanager Configuration

Example `alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
    - match:
        severity: warning
      receiver: 'slack'

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:8080/webhook'

  - name: 'pagerduty'
    pagerduty_configs:
      - routing_key: '${PAGERDUTY_ROUTING_KEY}'
        severity: critical

  - name: 'slack'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .Annotations.description }}'
```

## Alert Severity Levels

| Level | Response Time | Examples |
|-------|---------------|----------|
| **critical** | 15 min | Service down, database failure, >10% error rate |
| **warning** | 1 hour | High latency, N+1 queries, degraded performance |
| **info** | Next business day | Capacity warnings, deprecation notices |

## Testing Alerts

```bash
# Trigger a test alert via Alertmanager API
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "info"
    },
    "annotations": {
      "summary": "Test alert",
      "description": "This is a test alert"
    }
  }]'
```
