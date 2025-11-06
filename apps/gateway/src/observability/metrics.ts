import client from 'prom-client';

export const registry = new client.Registry();

registry.setDefaultLabels({
  service: process.env.OTEL_SERVICE_NAME || 'gateway',
  env: process.env.NODE_ENV || 'development',
});

client.collectDefaultMetrics({
  register: registry,
  // aumenta precisión de event loop, costo mínimo
  eventLoopMonitoringPrecision: 10,
});

const statusFamily = (code: number) => {
  if (code >= 200 && code < 300) return '2xx';
  if (code >= 300 && code < 400) return '3xx';
  if (code >= 400 && code < 500) return '4xx';
  if (code >= 500 && code < 600) return '5xx';
  return 'other';
};

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de requests HTTP',
  labelNames: ['route', 'method', 'status_family'],
});
registry.registerMetric(httpRequestsTotal);

export const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total de errores HTTP por tipo',
  labelNames: ['type'], // jwt | throttled | upstream | unknown
});
registry.registerMetric(httpErrorsTotal);

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Latencia por request (segundos)',
  labelNames: ['route', 'method', 'status_family'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
});
registry.registerMetric(httpRequestDurationSeconds);

export { statusFamily };
