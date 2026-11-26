# Phase 1 Sync & Storage Reliability — Operational Notes

## Scope

This branch adds durable server-side document tombstones, upload-grant tracking, resumable account deletion, exact-key object cleanup, leased cleanup jobs, and a new additive MySQL migration. The baseline migration is intentionally unchanged.

## Behavior changes

- `POST /api/v1/uploads/presigned-url` persists an upload grant before returning its presigned URL.
- Document creation/update/deletion and folder/user mutations reject accounts whose lifecycle state is `DELETING`.
- A document delete writes a server-side `(user_id, document_id)` tombstone and exact cleanup intents in the same database transaction as deleting document metadata.
- `DELETE /api/v1/users/account` returns HTTP 202 and a durable job identifier while cleanup is pending. A repeat request after completion returns HTTP 200 with the durable completion receipt.
- The background worker waits until a known presigned grant has expired plus a five-minute margin before attempting deletion. URL-only legacy objects with no grant use a conservative 65-minute safety window.
- The worker deletes only recorded keys in the configured bucket, validates canonical namespace/owner path, propagates storage errors, and uses leases/claim tokens for acknowledgement.
- The account row remains until required cleanup is complete. A separate receipt and account-deletion job survive the final cascade.

## Required environment

Use the existing environment configuration. In production, confirm that `AWS_ENDPOINT`, `AWS_REGION`, and `AWS_S3_BUCKET` describe the real S3-compatible endpoint and bucket whose public URL scheme the app stores. Never place live credentials in repository files.

## Migration safety

Run `npx prisma generate`, `npx prisma validate`, and apply the additive migration against a disposable MySQL database before deployment. Do not run against production until reviewed and backed up.

The migration changes old URL-only `pending_deletions` rows to `FAILED` with an operator-review message because the schema alone cannot prove a safe bucket/key from arbitrary historical URLs. These rows are intentionally not auto-deleted.

## Legacy object inventory / operator handling

For any row marked for operator inventory:

1. Verify the canonical storage host and configured bucket from trusted deployment configuration.
2. Resolve the exact object key from the trusted B2/S3 inventory or existing trusted upload metadata.
3. Verify its owner ID and canonical namespace segment. Never infer ownership from a substring or blindly parse an untrusted URL.
4. Only after verification, record the exact bucket/key against the cleanup row and reconcile the corresponding upload grant if one exists.
5. Requeue the failed cleanup item through the restricted operational path and monitor it until it is `COMPLETED` or returns to a visible failure/dead-letter state.

Do not manually change status to `COMPLETED` to bypass the storage operation. Objects not referenced by a document or grant cannot be discovered reliably from Prisma records alone; those need an operator-reviewed bucket inventory/backfill.

## Retry and dead-letter handling

The worker retries transient object deletion failures with backoff. After five failed processing cycles, the item moves to `DEAD_LETTER` and no longer auto-retries.

- Requeue an item only after inspecting its recorded bucket/key and error.
- The internal `AccountDeletionService.requeueCleanupJob(jobId)` method accepts only `FAILED`/`DEAD_LETTER` items with exact bucket/key values and resets the linked failed account-deletion job where applicable.
- `AccountDeletionService.requeueAccountDeletionJob(jobId)` exists for controlled recovery of an account job that itself reached `FAILED`/`DEAD_LETTER`.
- These methods are internal service methods, not public unauthenticated HTTP endpoints. Use them only from a reviewed, restricted maintenance invocation.

## Verification status

The new CI workflow runs Prisma generation/validation, the Node test suite, and the TypeScript build on pull requests. This repository change has not been locally built or tested in this editing session, and the migration has not been applied to MySQL here. Treat CI and disposable-MySQL evidence as required before declaring the phase complete or deploying.

The storage-object safety tests cover owner/host/key validation, injected S3 deletion calls, and storage error propagation. The CI-only MySQL integration suite covers server tombstone rejection and a mocked-storage account-deletion flow through durable receipt finalization. These tests still do not replace multi-process concurrency, in-flight real upload/B2, device, or multi-device tests.
