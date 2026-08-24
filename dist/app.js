import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRateLimiter } from './middlewares/rate-limit.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { NotFoundError } from './common/errors/app-error.js';
// Route Imports
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/routes/auth.routes.js';
import { usersRoutes } from './modules/users/routes/users.routes.js';
import { foldersRoutes } from './modules/folders/routes/folders.routes.js';
import { documentsRoutes } from './modules/documents/routes/documents.routes.js';
import { uploadsRoutes } from './modules/uploads/routes/uploads.routes.js';
export const createApp = () => {
    const app = express();
    // Security Middlewares
    app.use(helmet());
    app.use(cors({
        origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
        credentials: true,
    }));
    // Rate Limiting
    app.use(apiRateLimiter);
    // Body Parsers
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    // API Routes (v1)
    const apiV1Router = express.Router();
    apiV1Router.use('/health', healthRoutes);
    apiV1Router.use('/auth', authRoutes);
    apiV1Router.use('/users', usersRoutes);
    apiV1Router.use('/folders', foldersRoutes);
    apiV1Router.use('/documents', documentsRoutes);
    apiV1Router.use('/uploads', uploadsRoutes);
    app.use('/api/v1', apiV1Router);
    // 404 Handler for undefined routes
    app.use((_req, _res, next) => {
        next(new NotFoundError('The requested endpoint was not found on this server', 'ENDPOINT_NOT_FOUND'));
    });
    // Global Centralized Error Handler
    app.use(errorHandler);
    return app;
};
//# sourceMappingURL=app.js.map