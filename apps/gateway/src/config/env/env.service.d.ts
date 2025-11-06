import { EnvVars } from './env.schema';
export declare class EnvService {
    private readonly env;
    constructor(env: EnvVars);
    get gateway(): {
        port: number;
        authServiceUrl: string;
    };
    get jwt(): {
        publicPem: string;
        iss: string;
        aud: string;
    };
    get redis(): {
        host: string;
        port: number;
    };
    get raw(): EnvVars;
    static instance: EnvService;
    static init(env: EnvVars): void;
    static getStatic(): EnvService;
}
//# sourceMappingURL=env.service.d.ts.map