# Storage cleanup and account-deletion operations

## Runtime behavior

The API persists cleanup rows before acknowledging a document deletion or account-deletion request. The server polls durable work every 15 seconds. File work is claimed with a lease token and `RETRYING` status; a worker may acknowledge a job only while its claim token still matches.

The worker deletes objects only through the configured bucket and a persisted object key. It never extracts a bucket/key from an arbitrary URL during job execution. Missing or unvalidated legacy keys become `DEAD_LETTER` records and intentionally block account finalization.

The initial additive migration leaves historical `pending_deletions` rows without a verified `bucket/object_key` unresolved. Do not fill those fields with guessed values. Use the provider's object inventory and exact owner path segments to confirm targets first.

## Requeueing a reviewed cleanup object

Run only after confirming the object's exact bucket and key in the storage console/inventory. Never pass a key copied from an untrusted URL.

```bash
npm run build
node --env-file=.env dist/scripts/requeue-storage-cleanup.js \
  --file-job <cleanup-job-id> \
  --bucket <exact-configured-bucket> \
  --key <exact-object-key-containing-the-owner-id-segment>
```

The command refuses buckets other than `AWS_S3_BUCKET`, non-canonical keys, and keys without the job owner's exact path segment. After the file job completes, an account deletion can be requeued if its only blocker was an operator-reviewed file target.

## Requeueing an account deletion job

```bash
node --env-file=.env dist/scripts/requeue-storage-cleanup.js --account-job <account-deletion-job-id>
```

This operation is accepted only for a `FAILED` account job with no `DEAD_LETTER` file cleanup rows. Fix/requeue those object jobs first.

## Legacy orphan objects

A database scan cannot find objects that no longer have any database reference or upload-grant record. Complete coverage needs a controlled inventory of the configured bucket and a reviewed backfill/report using exact owner ID path segments. This code does not claim automatic discovery of all such historical orphans.

## Operational cautions

- Do not deploy this branch before `npm test`, `npm run build`, `npx prisma validate`, and the additive migration have been verified against a disposable MySQL database.
- The worker is not a reason to skip backup/restore or storage retention planning.
- Inspect dead-letter counts and `account_deletion_jobs.last_error` before approving a deletion as complete.
- Completed account deletion receipts remain in `account_deletion_jobs` after the user row has been removed.
