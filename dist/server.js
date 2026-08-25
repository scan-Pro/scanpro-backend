import { createApp } from './app.js';
import { env } from './config/env.js';
const app = createApp();
const server = app.listen(env.PORT, () => {
    console.log(`🚀 ScanPro Backend Server running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
    console.log(`📚 Swagger API Docs available at: http://localhost:${env.PORT}/docs`);
    console.log(`📡 Health check available at: http://localhost:${env.PORT}/api/v1/health`);
});
// Graceful Shutdown
const shutdown = () => {
    console.log('Received shutdown signal, closing server gracefully...');
    server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
//# sourceMappingURL=server.js.map