-- Additive Phase 1 sync/storage reliability migration.
-- Preserve the initial baseline migration unchanged.

ALTER TABLE `users`
  ADD COLUMN `lifecycle_status` ENUM('ACTIVE', 'DELETING') NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE `pending_deletions`
  MODIFY COLUMN `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `bucket` VARCHAR(100) NULL,
  ADD COLUMN `object_key` VARCHAR(500) NULL,
  ADD COLUMN `available_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `claim_token` VARCHAR(36) NULL,
  ADD COLUMN `lease_expires_at` DATETIME(3) NULL;

-- Existing URL-only jobs cannot safely be deleted automatically without
-- proving their exact configured bucket/key. Preserve them for review.
UPDATE `pending_deletions`
SET `status` = 'FAILED',
    `last_error` = 'Legacy cleanup target needs operator-reviewed bucket/key inventory'
WHERE `bucket` IS NULL OR `object_key` IS NULL;

CREATE INDEX `pending_deletions_claim_idx`
  ON `pending_deletions` (`status`, `available_at`, `created_at`);
CREATE INDEX `pending_deletions_object_idx`
  ON `pending_deletions` (`bucket`, `object_key`);

CREATE TABLE `document_tombstones` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `document_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `document_tombstones_user_document_key` (`user_id`, `document_id`),
  INDEX `document_tombstones_user_created_idx` (`user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `upload_grants` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `bucket` VARCHAR(100) NULL,
  `object_key` VARCHAR(500) NULL,
  `file_url` VARCHAR(500) NOT NULL,
  `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` DATETIME(3) NOT NULL,
  `cleanup_done` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `upload_grants_bucket_object_key_key` (`bucket`, `object_key`),
  INDEX `upload_grants_user_expiry_idx` (`user_id`, `expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `account_deletion_jobs` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `last_error` TEXT NULL,
  `claim_token` VARCHAR(36) NULL,
  `lease_expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `account_deletion_jobs_user_id_key` (`user_id`),
  INDEX `account_deletion_jobs_claim_idx` (`status`, `lease_expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `account_deletion_receipts` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `completed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `objects_queued` INTEGER NOT NULL DEFAULT 0,
  UNIQUE INDEX `account_deletion_receipts_user_id_key` (`user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
