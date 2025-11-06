import { AuthProxyService } from '../../../infrastructure/http/auth-proxy.service';
export declare class HealthController {
    private readonly auth;
    constructor(auth: AuthProxyService);
    check(): Promise<{
        ok: boolean;
        service: string;
        uptimeMs: number;
        totalLatencyMs: number;
        dependencies: {
            auth: {
                ok: boolean;
                latencyMs: number;
            };
        };
    }>;
}
//# sourceMappingURL=health.controller.d.ts.map