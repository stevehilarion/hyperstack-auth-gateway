import { z } from 'zod';
export declare const envSchema: z.ZodPipe<z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<{
        development: "development";
        test: "test";
        production: "production";
    }>>;
    GATEWAY_PORT: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    PORT: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    AUTH_SERVICE_URL: z.ZodString;
    REDIS_HOST: z.ZodDefault<z.ZodString>;
    REDIS_PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    ALLOWED_ORIGINS: z.ZodOptional<z.ZodString>;
    JWT_ISS: z.ZodDefault<z.ZodString>;
    JWT_AUD: z.ZodDefault<z.ZodString>;
}, z.core.$strip>, z.ZodTransform<{
    NODE_ENV: "development" | "test" | "production";
    AUTH_SERVICE_URL: string;
    REDIS_HOST: string;
    REDIS_PORT: number;
    ALLOWED_ORIGINS: string[];
    GATEWAY_PORT: number;
    jwt: {
        publicPem: string;
        iss: string;
        aud: string;
    };
}, {
    NODE_ENV: "development" | "test" | "production";
    AUTH_SERVICE_URL: string;
    REDIS_HOST: string;
    REDIS_PORT: number;
    JWT_ISS: string;
    JWT_AUD: string;
    GATEWAY_PORT?: number | undefined;
    PORT?: number | undefined;
    ALLOWED_ORIGINS?: string | undefined;
}>>;
export type EnvVars = z.infer<typeof envSchema>;
//# sourceMappingURL=env.schema.d.ts.map