import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const sentryEnv = import.meta.env.VITE_SENTRY_ENV;
const sentrySampleRate = Number.parseFloat(
  import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0',
);

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

let sentryEnabled = false;
let posthogEnabled = false;

export function initTelemetry() {
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: sentryEnv,
      tracesSampleRate: Number.isFinite(sentrySampleRate) ? sentrySampleRate : 0,
    });
    sentryEnabled = true;
  }

  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      autocapture: true,
    });
    posthogEnabled = true;
  }
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (sentryEnabled) {
    Sentry.captureException(error, { extra: context });
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (posthogEnabled) {
    posthog.capture(event, properties);
  }
}
