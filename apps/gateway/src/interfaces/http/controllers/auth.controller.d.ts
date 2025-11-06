import type { Request, Response } from 'express';
import { AuthProxyService } from '../../../infrastructure/http/auth-proxy.service';
export declare class AuthController {
    private readonly proxy;
    constructor(proxy: AuthProxyService);
    health(res: Response): Promise<void>;
    register(body: unknown, dev: string | undefined, req: Request, res: Response): Promise<void>;
    login(body: unknown, dev: string | undefined, req: Request, res: Response): Promise<void>;
    refresh(body: unknown, dev: string | undefined, req: Request, res: Response): Promise<void>;
    logout(body: unknown, res: Response): Promise<void>;
    logoutAll(auth: string | undefined, res: Response): Promise<void>;
    me(auth: string | undefined, res: Response): Promise<void>;
}
//# sourceMappingURL=auth.controller.d.ts.map