import { jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
type VerifyKey = Parameters<typeof jwtVerify>[1];
export declare class JwksCacheService {
    private readonly log;
    private cache;
    private readonly ttlMs;
    private get jwksUrl();
    private fetchJwks;
    private ensureFresh;
    getKeyByKid(kid: string): Promise<VerifyKey>;
    verifyJwtRS256(token: string, expectedAud: string, expectedIss: string): Promise<JWTPayload>;
}
export {};
//# sourceMappingURL=jwks-cache.service.d.ts.map