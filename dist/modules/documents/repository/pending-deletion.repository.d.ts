export interface PendingDeletionRecord {
    id: string;
    fileUrl: string;
    documentId: string | null;
    userId: string;
    attempts: number;
    lastError: string | null;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    createdAt: Date;
    updatedAt: Date;
}
export declare class PendingDeletionRepository {
    createMany(entries: {
        fileUrl: string;
        documentId: string | null;
        userId: string;
    }[]): Promise<void>;
    markCompleted(id: string): Promise<void>;
    markFailed(id: string, error: string): Promise<void>;
    markRetrying(id: string): Promise<void>;
    findPending(limit?: number): Promise<PendingDeletionRecord[]>;
    findFailed(limit?: number, maxAttempts?: number): Promise<PendingDeletionRecord[]>;
    deleteOldCompleted(olderThanDays?: number): Promise<number>;
}
