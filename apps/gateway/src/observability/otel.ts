import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { env } from 'node:process';

let sdk: NodeSDK | null = null;

function parseOtlpHeaders(str?: string): Record<string, string> | undefined {
  if (!str) return undefined;
  const entries = str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((kv) => {
      const [k, ...rest] = kv.split('=');
      const key = k?.trim();
      const val = rest.join('=').trim();
      return key && val ? [key, val] as const : null;
    })
    .filter((x): x is readonly [string, string] => !!x);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export async function startOtel() {
  if (sdk) return;

  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
  const serviceName = env.OTEL_SERVICE_NAME || 'gateway';
  const deployment = env.NODE_ENV || 'development';
  const version = process.env.npm_package_version || '0.0.0';

  const base = Resource.default();
  const svc = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: version,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: deployment,
  });

  sdk = new NodeSDK({
    resource: base.merge(svc),
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
      headers: parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req: any) => req?.url?.startsWith?.('/metrics'),
        },
      }),
    ],
  });

  process.env.OTEL_TRACES_SAMPLER ??= env.OTEL_TRACES_SAMPLER || 'parentbased_traceidratio';
  process.env.OTEL_TRACES_SAMPLER_ARG ??= env.OTEL_TRACES_SAMPLER_ARG || '0.1';

  await sdk.start();
  const shutdown = () => sdk?.shutdown().catch(() => {});
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('beforeExit', shutdown);
}
