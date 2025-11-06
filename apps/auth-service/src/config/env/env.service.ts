import { AuthEnvVars } from './env.schema';

export class AuthEnvService {
  constructor(private readonly env: AuthEnvVars) {}

  get auth() {
    return {
      port: this.env.PORT,
      databaseUrl: this.env.AUTH_DATABASE_URL,
    };
  }

  get jwt() {
    return this.env.jwt;
  }

  get redis() {
    return this.env.redis;
  }

  get raw(): AuthEnvVars {
    return this.env;
  }

  /** --- SINGLETON --- */
  private static instance: AuthEnvService | null = null;

  static create(env: AuthEnvVars) {
    if (!this.instance) this.instance = new AuthEnvService(env);
    return this.instance;
  }

  static getStatic(): AuthEnvService {
    if (!this.instance) {
      throw new Error('AuthEnvService not initialized yet');
    }
    return this.instance;
  }
}
