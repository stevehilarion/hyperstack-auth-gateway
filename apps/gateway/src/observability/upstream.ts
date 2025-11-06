import { context, trace } from '@opentelemetry/api';
import { httpFetch, HttpClientOptions } from '../infrastructure/http/http-client';
import client from 'prom-client';
import { registry } from './metrics';

const upstreamRequestsTotal = new client.Counter({
  name: 'upstream_requests_total',
  help: 'Total de requests a servicios upstream',
  labelNames: ['target', 'method', 'status_family', 'outcome'], // outcome: success|error|timeout
});

const upstreamRequestDurationSeconds = new client.Histogram({
  name: 'upstream_request_duration_seconds',
  help: 'Latencia de requests a upstream (segundos)',
  labelNames: ['target', 'method', 'status_family', 'outcome'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
});

registry.registerMetric(upstreamRequestsTotal);
registry.registerMetric(upstreamRequestDurationSeconds);

function family(code: number) {
  if (code >= 200 && code < 300) return '2xx';
  if (code >= 300 && code < 400) return '3xx';
  if (code >= 400 && code < 500) return '4xx';
  if (code >= 500 && code < 600) return '5xx';
  return 'other';
}

function parseTarget(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean)[0] || '';
    return seg ? `${u.host}/${seg}` : u.host;
  } catch {
    return 'unknown';
  }
}

export async function upstreamFetch(
  url: string,
  init: HttpClientOptions = {},
) {
  void trace.getTracer('gateway-upstream');

  const target = parseTarget(url);
  const method = (init.method || 'GET').toUpperCase();

  const start = process.hrtime.bigint();

  const h: Record<string, string> = {};
  if (init.headers) {
    for (const [k, v] of Object.entries(init.headers)) {
      if (v == null) continue;
      h[k.toLowerCase()] = String(v);
    }
  }
  if (!h['content-type']) h['content-type'] = 'application/json';

  return await context.with(context.active(), async () => {
    try {
      const res = await httpFetch(url, { ...init, headers: h });
      const end = process.hrtime.bigint();
      const dur = Number(end - start) / 1e9;

      const statusFam = family(res.status);
      const outcome = res.ok ? 'success' : 'error';

      upstreamRequestsTotal.inc({ target, method, status_family: statusFam, outcome });
      upstreamRequestDurationSeconds.observe(
        { target, method, status_family: statusFam, outcome },
        dur,
      );

      return res;
    } catch (err: any) {
      // timeout/abort/network -> status_family=other, outcome=timeout|error
      const end = process.hrtime.bigint();
      const dur = Number(end - start) / 1e9;

      const outcome =
        err?.name === 'AbortError'
          ? 'timeout'
          : /ECONN(REFUSED|RESET)|ETIMEDOUT/i.test(String(err?.code || err?.cause?.code || ''))
          ? 'timeout'
          : 'error';

      upstreamRequestsTotal.inc({ target, method, status_family: 'other', outcome });
      upstreamRequestDurationSeconds.observe(
        { target, method, status_family: 'other', outcome },
        dur,
      );

      throw err;
    }
  });
}
