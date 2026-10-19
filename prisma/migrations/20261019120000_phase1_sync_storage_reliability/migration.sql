-- Additive Phase 1 sync/storage reliability migration.
-- Do not modify the verified initial baseline migration.

ALTER TABLE `users`
  ADD COLUMN `lifecycle_status` ENUM('ACTIVE', 'DELETING') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `deletion_started_at` DATETIME(3) NULL;

ALTER TABLE `pending_deletions`
  MODIFY COLUMN `file_url` VARCHAR(500) NULL,
  MODIFY COLUMN `status` ENUM('PENDING', 'RETRYING', 'COMPLETED', 'FAILED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `bucket` VARCHAR(100) NULL,
  ADD COLUMN `object_key` VARCHAR(500) NULL,
  ADD COLUMN `object_identity` CHAR(64) NULL,
  ADD COLUMN `not_before` DATETIME(3) NULL,
  ADD COLUMN `lease_token` CHAR(36) NULL,
  ADD COLUMN `lease_expires_at` DATETIME(3) NULL,
  ADD UNIQUE INDEX `pending_deletions_object_identity_key` (`object_identity`),
  ADD INDEX `pending_deletions_status_lease_expires_at_created_at_idx` (`status`, `lease_expires_at`, `created_at`),
  ADD INDEX `pending_deletions_user_id_status_idx` (`user_id`, `status`);

CREATE TABLE `document_tombstones` (
  `user_id` VARCHAR(191) NOT NULL,
  `document_id` VARCHAR(191) NOT NULL,
  `deleted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`, `document_id`),
  INDEX `document_tombstones_deleted_at_idx` (`deleted_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `upload_grants` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `bucket` VARCHAR(100) NOT NULL,
  `object_key` VARCHAR(500) NOT NULL,
  `object_identity` CHAR(64) NOT NULL,
  `file_url` VARCHAR(500) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `cleanup_done` BOOLEAN NOT NULL DEFAULT false,
  `cleanup_state` ENUM('ACTIVE', 'PENDING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `upload_grants_object_identity_key` (`object_identity`),
  INDEX `upload_grants_user_id_cleanup_done_idx` (`user_id`, `cleanup_done`),
  INDEX `upload_grants_expires_at_cleanup_done_idx` (`expires_at`, `cleanup_done`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `account_deletion_jobs` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'CLEANING', 'FAILED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `last_error` TEXT NULL,
  `lease_token` CHAR(36) NULL,
  `lease_expires_at` DATETIME(3) NULL,
  `started_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `account_deletion_jobs_user_id_key` (`user_id`),
  INDEX `account_deletion_jobs_status_lease_expires_at_created_at_idx` (`status`, `lease_expires_at`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- Legacy pending rows have only a URL, not a verified bucket/key. Preserve them
-- for operator-reviewed inventory; never guess their deletion target.
UPDATE `pending_deletions`
SET `status` = 'DEAD_LETTER',
    `last_error` = COALESCE(`last_error`, 'Legacy cleanup target has no verified bucket/key; operator inventory required.')
WHERE `status` IN ('PENDING', 'FAILED', 'RETRYING')
  AND (`bucket` IS NULL OR `object_key` IS NULL OR `object_identity` IS NULL);
