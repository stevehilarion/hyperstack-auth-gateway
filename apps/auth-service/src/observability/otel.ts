import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const pkgVersion = process.env.npm_package_version || '0.0.0';

let sdk: NodeSDK | null = null;

export async function startOtel() {
  if (sdk) return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
  const serviceName = process.env.OTEL_SERVICE_NAME || 'auth-service';
  const deployment = process.env.NODE_ENV || 'development';
  const version = pkgVersion;

  process.env.OTEL_TRACES_SAMPLER ??= process.env.OTEL_TRACES_SAMPLER || 'parentbased_traceidratio';
  process.env.OTEL_TRACES_SAMPLER_ARG ??= process.env.OTEL_TRACES_SAMPLER_ARG || '1.0';

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: version,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: deployment,
  });

  const headers =
    (process.env.OTEL_EXPORTER_OTLP_HEADERS as unknown as Partial<Record<string, unknown>>) ||
    undefined;

  sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
      headers,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req: any) => req?.url?.startsWith?.('/metrics'),
        },
        '@opentelemetry/instrumentation-undici': { enabled: true },
      }),
    ],
  });

  await sdk.start();

  const shutdown = () => sdk?.shutdown().catch(() => {});
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('beforeExit', shutdown);
}
