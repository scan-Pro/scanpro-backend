import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { AccountDeletionService } from './modules/users/service/account-deletion.service.js';

const app = createApp();
const deletionService = new AccountDeletionService();
let workerRunning = false;

const runCleanupWorkers = async (): Promise<void> => {
  // Avoid overlapping worker loops inside one process. MySQL SKIP LOCKED and
  // per-job claim tokens additionally fence work across multiple instances.
  if (workerRunning || env.NODE_ENV === 'test') return;
  workerRunning = true;
  try {
    await deletionService.processPendingDeletionBatch(20);
    await deletionService.processAccountDeletionBatch(5);
  } catch (error) {
    console.error('[StorageCleanup] Worker iteration failed', error);
  } finally {
    workerRunning = false;
  }
};

const cleanupTimer = setInterval(() => {
  void runCleanupWorkers();
}, 5_000);
cleanupTimer.unref();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 ScanPro Backend Server running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
  console.log(`📚 Swagger API Docs available at: http://localhost:${env.PORT}/docs`);
  console.log(`📡 Health check available at: http://localhost:${env.PORT}/api/v1/health`);
  void runCleanupWorkers();
});

// Graceful Shutdown
const shutdown = () => {
  console.log('Received shutdown signal, closing server gracefully...');
  clearInterval(cleanupTimer);
  server.close(() => {
    void prisma.$disconnect().finally(() => {
      console.log('HTTP server and database connections closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
