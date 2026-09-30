import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('5001'),
  // Secrets and credentials MUST NOT have defaults: if they're missing from
  // the environment, the server should fail to start rather than silently
  // signing tokens / connecting with a value that's publicly visible in
  // this repository's git history.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET is required and must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET is required and must be at least 32 characters'),
  JWT_ISSUER: z.string().min(1).default('scaniro-api'),
  JWT_AUDIENCE: z.string().min(1).default('scaniro-client'),
  // Kept short since access tokens are stateless (no revocation list) and
  // are re-minted transparently via refresh-token rotation on the client.
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('90d'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  AWS_REGION: z.string().default('us-east-005'),
  AWS_ENDPOINT: z.string().optional().default(''),
  AWS_S3_BUCKET: z.string().default('scaniro-app'),
  CORS_ORIGIN: z.string().default('*'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid or missing environment variables:');
    console.error(result.error.format());
    console.error(
      '⚠️  Refusing to start with insecure default secrets. Set these values in your .env file (see .env.example).'
    );
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
