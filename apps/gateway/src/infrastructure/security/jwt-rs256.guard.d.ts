import { CanActivate, ExecutionContext } from '@nestjs/common';
import { EnvService } from '../../config/env/env.service';
import { JwksService } from './jwks.service';
export declare class JwtRs256Guard implements CanActivate {
    private readonly jwks;
    private readonly env;
    constructor(jwks: JwksService, env: EnvService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
//# sourceMappingURL=jwt-rs256.guard.d.ts.map