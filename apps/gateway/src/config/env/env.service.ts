import { EnvVars } from './env.schema';

export class EnvService {
  constructor(private readonly env: EnvVars) {}

  // ---- Gateway ----
  get gateway() {
    return {
      port: this.env.GATEWAY_PORT,
      authServiceUrl: this.env.AUTH_SERVICE_URL,
    };
  }
get jwt() {
  return this.env.jwt;
}

  // ---- Redis ----
  get redis() {
    return {
      host: this.env.REDIS_HOST,
      port: this.env.REDIS_PORT,
    };
  }

  // acceso raw opcional
  get raw(): EnvVars {
    return this.env;
  }

  static instance: EnvService;

  static init(env: EnvVars) {
    EnvService.instance = new EnvService(env);
  }

  static getStatic() {
    return EnvService.instance;
  }
}
