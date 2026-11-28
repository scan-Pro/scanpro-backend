ALTER TABLE `users`
  ADD COLUMN `email_verified` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `email_otps` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `purpose` ENUM('SIGNUP', 'PASSWORD_RESET') NOT NULL,
  `code_hash` CHAR(64) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `email_otps_email_purpose_key` (`email`, `purpose`),
  INDEX `email_otps_expires_at_idx` (`expires_at`),
  INDEX `email_otps_user_id_idx` (`user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `email_otps`
  ADD CONSTRAINT `email_otps_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
