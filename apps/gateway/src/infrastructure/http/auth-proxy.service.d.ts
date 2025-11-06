type ProxyResult<T> = {
    data: T;
    headers: Record<string, string>;
    status: number;
};
export declare class AuthProxyService {
    private base;
    private readonly bulkhead;
    private state;
    private failures;
    private firstFailureAt;
    private openUntil;
    private halfOpenProbeInFlight;
    private readonly DEFAULT_TIMEOUT_MS;
    private readonly MAX_RETRIES;
    private readonly BASE_BACKOFF_MS;
    private readonly JITTER_MS;
    private readonly CB_FAILURE_THRESHOLD;
    private readonly CB_ROLLING_WINDOW_MS;
    private readonly CB_OPEN_COOLDOWN_MS;
    private normalizeBase;
    private isIdempotent;
    private computeBackoff;
    private onSuccess;
    private onFailure;
    private isNetworkError;
    private isRetryable;
    private buildHeaders;
    private coreRequest;
    private request;
    health(rid?: string): Promise<ProxyResult<{
        ok: boolean;
    }>>;
    register(payload: unknown, extraHeaders?: Record<string, string>, rid?: string): Promise<ProxyResult<unknown>>;
    login(payload: unknown, extraHeaders?: Record<string, string>, rid?: string): Promise<ProxyResult<unknown>>;
    refresh(payload: unknown, extraHeaders?: Record<string, string>, rid?: string): Promise<ProxyResult<unknown>>;
    logout(payload: unknown, rid?: string): Promise<ProxyResult<unknown>>;
    logoutAll(authHeader?: string, rid?: string): Promise<ProxyResult<unknown>>;
    me(authHeader?: string, rid?: string): Promise<ProxyResult<unknown>>;
    listSessions(authHeader?: string, rid?: string): Promise<ProxyResult<unknown>>;
    revokeSession(sid: string, authHeader?: string, rid?: string): Promise<ProxyResult<unknown>>;
}
export {};
//# sourceMappingURL=auth-proxy.service.d.ts.map