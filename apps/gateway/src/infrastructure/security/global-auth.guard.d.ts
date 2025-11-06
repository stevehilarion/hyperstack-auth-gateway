import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtRs256Guard } from './jwt-rs256.guard';
export declare class GlobalJwtGuard implements CanActivate {
    private readonly jwtGuard;
    constructor(jwtGuard: JwtRs256Guard);
    canActivate(ctx: ExecutionContext): Promise<boolean>;
}
//# sourceMappingURL=global-auth.guard.d.ts.map