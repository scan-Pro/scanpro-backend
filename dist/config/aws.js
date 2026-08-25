import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';
export const s3Client = new S3Client({
    region: env.AWS_REGION,
    endpoint: env.AWS_ENDPOINT && env.AWS_ENDPOINT.trim() !== '' ? env.AWS_ENDPOINT.trim() : undefined,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        }
        : undefined,
});
//# sourceMappingURL=aws.js.map