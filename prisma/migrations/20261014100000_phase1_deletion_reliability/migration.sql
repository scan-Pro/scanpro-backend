ALTER TABLE `users`
  ADD COLUMN `lifecycle_status` ENUM('ACTIVE', 'DELETING') NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE `pending_deletions`
  ADD COLUMN `bucket` VARCHAR(100) NULL,
  ADD COLUMN `object_key` VARCHAR(500) NULL,
  ADD COLUMN `lease_token` VARCHAR(36) NULL,
  ADD COLUMN `lease_until` DATETIME(3) NULL,
  MODIFY `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING';

UPDATE `pending_deletions`
SET `status` = 'FAILED',
    `last_error` = 'Legacy URL requires operator-owned bucket inventory reconciliation'
WHERE `bucket` = '' OR `object_key` = '';

CREATE INDEX `pending_deletions_status_lease_created_idx`
  ON `pending_deletions`(`status`, `lease_until`, `created_at`);
CREATE INDEX `pending_deletions_bucket_object_idx`
  ON `pending_deletions`(`bucket`, `object_key`);

CREATE TABLE `document_deletion_tombstones` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `document_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `document_deletion_tombstones_user_document_key`(`user_id`, `document_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `document_deletion_tombstones_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `upload_grants` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `bucket` VARCHAR(100) NOT NULL,
  `object_key` VARCHAR(500) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `cleanup_done` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `upload_grants_bucket_object_key`(`bucket`, `object_key`),
  INDEX `upload_grants_user_expiry_idx`(`user_id`, `expires_at`),
  INDEX `upload_grants_cleanup_expiry_idx`(`cleanup_done`, `expires_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `upload_grants_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `account_deletion_jobs` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'DEAD_LETTER') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `last_error` TEXT NULL,
  `lease_token` VARCHAR(36) NULL,
  `lease_until` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `account_deletion_jobs_user_id_key`(`user_id`),
  INDEX `account_deletion_jobs_status_lease_created_idx`(`status`, `lease_until`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `account_deletion_jobs_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
