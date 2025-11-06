type ProxyResult<T> = {
    data: T;
    headers: Record<string, string>;
    status: number;
};
export declare class AuthProxyService {
    private base;
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
    private readonly bulkhead;
    private normalizeBase;
    private isIdempotent;
    private computeBackoff;
    private onSuccess;
    private onFailure;
    private isRetryable;
    private buildHeaders;
    private coreRequest;
    private request;
    health(): Promise<ProxyResult<{
        ok: boolean;
        service?: string;
        dependencies?: any;
    }>>;
    register(payload: unknown, extraHeaders?: Record<string, string>): Promise<ProxyResult<unknown>>;
    login(payload: unknown, extraHeaders?: Record<string, string>): Promise<ProxyResult<unknown>>;
    refresh(payload: unknown, extraHeaders?: Record<string, string>): Promise<ProxyResult<unknown>>;
    logout(payload: unknown): Promise<ProxyResult<unknown>>;
    logoutAll(authHeader?: string): Promise<ProxyResult<unknown>>;
    me(authHeader?: string): Promise<ProxyResult<unknown>>;
}
export {};
//# sourceMappingURL=bulkhead.d.ts.map