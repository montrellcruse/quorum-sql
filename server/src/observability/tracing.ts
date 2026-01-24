import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'quorum-sql-server';

let sdk: NodeSDK | null = null;

export function initTracing(): void {
  if (!OTEL_EXPORTER_OTLP_ENDPOINT) {
    console.log('OpenTelemetry: OTEL_EXPORTER_OTLP_ENDPOINT not set, tracing disabled');
    return;
  }

  const exporter = new OTLPTraceExporter({
    url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: OTEL_SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation to reduce noise
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log(`OpenTelemetry: Tracing enabled, exporting to ${OTEL_EXPORTER_OTLP_ENDPOINT}`);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk?.shutdown()
      .then(() => console.log('OpenTelemetry: SDK shut down successfully'))
      .catch((err) => console.error('OpenTelemetry: Error shutting down SDK', err));
  });
}

export function getTracingEnabled(): boolean {
  return sdk !== null;
}
