export interface HttpClientOptions extends RequestInit {
    headers?: Record<string, string>;
    /** timeout total de la petición (ms). Si no se define: UPSTREAM_TIMEOUT_MS o 800ms */
    timeoutMs?: number;
}
export declare class UpstreamError extends Error {
    readonly code?: string;
    readonly retriable: boolean;
    readonly upstreamOrigin: string;
    constructor(message: string, params: {
        cause?: any;
        code?: string;
        retriable: boolean;
        upstreamOrigin: string;
    });
}
export declare function httpFetch(url: string, options?: HttpClientOptions): Promise<Response>;
//# sourceMappingURL=http-client.d.ts.map