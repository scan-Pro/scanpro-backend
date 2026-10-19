import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { StorageCleanupWorker } from './modules/uploads/service/storage-cleanup.worker.js';

const app = createApp();
const cleanupWorker = new StorageCleanupWorker();
let cleanupRunActive = false;

const runCleanup = async (): Promise<void> => {
  if (cleanupRunActive) return;
  cleanupRunActive = true;
  try {
    const result = await cleanupWorker.runOnce();
    if (
      result.fileJobsClaimed ||
      result.accountJobsClaimed ||
      result.fileJobsFailed ||
      result.accountsBlocked
    ) {
      console.info('[StorageCleanupWorker] Run finished', result);
    }
  } catch (error) {
    console.error('[StorageCleanupWorker] Run failed; durable jobs remain in database for recovery:', error);
  } finally {
    cleanupRunActive = false;
  }
};

const server = app.listen(env.PORT, () => {
  console.log(`🚀 ScanPro Backend Server running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
  console.log(`📚 Swagger API Docs available at: http://localhost:${env.PORT}/docs`);
  console.log(`📡 Health check available at: http://localhost:${env.PORT}/api/v1/health`);
  void runCleanup();
});

// Jobs are database-backed and claimed with leases, so multiple app instances
// can poll safely. The DB lease, not this in-process flag, is the cross-instance fence.
const cleanupTimer = setInterval(() => void runCleanup(), 15_000);
cleanupTimer.unref();

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Received shutdown signal, closing server gracefully...');
  clearInterval(cleanupTimer);
  server.close(() => {
    void prisma.$disconnect().finally(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
