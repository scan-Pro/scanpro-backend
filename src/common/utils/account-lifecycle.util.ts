import type { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '../errors/app-error.js';

/**
 * Locks the owning user row until the surrounding interactive transaction
 * commits. All owner mutations and account deletion must use this lock to
 * close the check-then-write race across concurrent requests.
 */
export async function lockUserLifecycle(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<'ACTIVE' | 'DELETING'> {
  const rows = await tx.$queryRaw<Array<{ id: string; lifecycle_status: string }>>`
    SELECT id, lifecycle_status FROM users WHERE id = ${userId} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }
  const status = rows[0].lifecycle_status;
  if (status !== 'ACTIVE' && status !== 'DELETING') {
    throw new ConflictError('User lifecycle state is invalid', 'USER_LIFECYCLE_INVALID');
  }
  return status;
}

export async function assertUserActive(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const status = await lockUserLifecycle(tx, userId);
  if (status !== 'ACTIVE') {
    throw new ConflictError(
      'Account deletion is in progress; mutations are not allowed',
      'ACCOUNT_DELETION_IN_PROGRESS',
    );
  }
}
