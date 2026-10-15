import { DocumentsService } from './documents.service.js';

export class DeletionWorkerService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(
    private readonly documentsService: DocumentsService = new DocumentsService(),
    private readonly intervalMs: number = 60 * 1000 // default 60 seconds
  ) {}

  start(): void {
    if (this.timer) return;
    const initialDelay = 5000;
    this.timer = setTimeout(() => this._tick(), initialDelay);
    this.timer.unref();
    console.log('[DeletionWorkerService] Deletion retry worker started');
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      console.log('[DeletionWorkerService] Deletion retry worker stopped');
    }
  }

  async runOnce(limit: number = 50): Promise<{ processed: number; succeeded: number; failed: number }> {
    return this.documentsService.retryPendingDeletions(limit);
  }

  private async _tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const result = await this.documentsService.retryPendingDeletions();
      if (result.processed > 0) {
        console.log(
          `[DeletionWorkerService] Processed ${result.processed} pending deletion(s): ${result.succeeded} succeeded, ${result.failed} failed`
        );
      }
    } catch (err: any) {
      if (err?.code === 'P2022') {
        console.warn(
          `[DeletionWorkerService] Database migration pending: column '${err.meta?.column ?? 'unknown'}' not found in database. Please run 'npx prisma migrate deploy'.`
        );
      } else {
        console.error('[DeletionWorkerService] Error during deletion retry sweep:', err);
      }
    } finally {
      this.isRunning = false;
      this.timer = setTimeout(() => this._tick(), this.intervalMs);
      this.timer.unref();
    }
  }
}
