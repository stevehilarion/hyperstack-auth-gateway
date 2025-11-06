import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { env } from 'node:process';
import pkg from '../../package.json' assert { type: 'json' };

let sdk: NodeSDK | null = null;

export async function startOtel() {
  if (sdk) return;

  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
  const serviceName = env.OTEL_SERVICE_NAME || 'gateway';
  const deployment = env.NODE_ENV || 'development';
  const version = (pkg as any).version || '0.0.0';

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
      headers: env.OTEL_EXPORTER_OTLP_HEADERS, // opcional
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
