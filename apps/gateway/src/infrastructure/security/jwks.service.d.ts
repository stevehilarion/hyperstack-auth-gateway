import { EnvService } from '../../config/env/env.service';
export declare class JwksService {
    private readonly env;
    private readonly log;
    private byKid;
    private expiresAt;
    private etag;
    private readonly STALE_ERROR_MS;
    constructor(env: EnvService);
    private get jwksUrl();
    private pickTtlMs;
    private pemFromJwk;
    private parseMaxAge;
    private readLocalPem;
    private refresh;
    getPemByKid(kid?: string): Promise<string | null>;
}
//# sourceMappingURL=jwks.service.d.ts.map