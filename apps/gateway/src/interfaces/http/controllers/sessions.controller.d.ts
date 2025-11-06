import type { Request, Response } from 'express';
import { AuthProxyService } from '../../../infrastructure/http/auth-proxy.service';
declare class RevokeSessionDto {
    sid: string;
}
export declare class SessionsController {
    private readonly proxy;
    constructor(proxy: AuthProxyService);
    list(auth: string | undefined, req: Request, res: Response): Promise<void>;
    revoke(body: RevokeSessionDto, auth: string | undefined, req: Request, res: Response): Promise<void>;
}
export {};
//# sourceMappingURL=sessions.controller.d.ts.map