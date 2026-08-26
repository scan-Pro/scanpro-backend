import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform((val) => parseInt(val, 10)).default('5001'),
    DATABASE_URL: z.string().default('mysql://root:password@localhost:3306/scanpro_db'),
    JWT_ACCESS_SECRET: z.string().default('scanpro_jwt_access_super_secret_key_2026'),
    JWT_REFRESH_SECRET: z.string().default('scanpro_jwt_refresh_super_secret_key_2026'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('30d'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('90d'),
    AWS_ACCESS_KEY_ID: z.string().optional().default(''),
    AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
    AWS_REGION: z.string().default('us-east-005'),
    AWS_ENDPOINT: z.string().optional().default(''),
    AWS_S3_BUCKET: z.string().default('scaniro-app'),
    CORS_ORIGIN: z.string().default('*'),
});
const parseEnv = () => {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('❌ Invalid environment variables:', result.error.format());
        process.exit(1);
    }
    return result.data;
};
export const env = parseEnv();
//# sourceMappingURL=env.js.map