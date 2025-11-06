import client from 'prom-client';
export declare const registry: client.Registry<"text/plain; version=0.0.4; charset=utf-8">;
declare const statusFamily: (code: number) => "2xx" | "3xx" | "4xx" | "5xx" | "other";
export declare const httpRequestsTotal: client.Counter<"route" | "method" | "status_family">;
export declare const httpErrorsTotal: client.Counter<"type">;
export declare const httpRequestDurationSeconds: client.Histogram<"route" | "method" | "status_family">;
export { statusFamily };
//# sourceMappingURL=metrics.d.ts.map