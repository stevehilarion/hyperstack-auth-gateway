export declare class AuthClientService {
    private base;
    private normalizeBase;
    private request;
    revokeBySid(sid: string, auth?: string): Promise<unknown>;
    listSessions(auth?: string): Promise<unknown>;
    health(): Promise<{
        ok: boolean;
    }>;
    register(payload: unknown, extraHeaders?: Record<string, string>): Promise<unknown>;
    login(payload: unknown, extraHeaders?: Record<string, string>): Promise<unknown>;
    refresh(payload: unknown, extraHeaders?: Record<string, string>): Promise<unknown>;
    logout(payload: unknown): Promise<unknown>;
    logoutAll(authHeader?: string): Promise<unknown>;
    me(authHeader?: string): Promise<unknown>;
}
//# sourceMappingURL=auth-client.service.d.ts.map