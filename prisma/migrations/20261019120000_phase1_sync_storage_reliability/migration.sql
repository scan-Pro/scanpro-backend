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
  ADD INDEX `pending_deletions_status_lease_created_idx` (`status`, `lease_expires_at`, `created_at`),
  ADD INDEX `pending_deletions_user_status_idx` (`user_id`, `status`);

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
  INDEX `upload_grants_user_cleanup_idx` (`user_id`, `cleanup_done`),
  INDEX `upload_grants_expiry_cleanup_idx` (`expires_at`, `cleanup_done`),
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
  INDEX `account_deletion_jobs_status_lease_created_idx` (`status`, `lease_expires_at`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
