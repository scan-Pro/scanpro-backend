import bcrypt from 'bcrypt';
import { prisma } from '../../../config/database.js';
import { UsersRepository } from '../repository/users.repository.js';
import { UpdateProfileDto, ChangePasswordDto } from '../dto/users.dto.js';
import { NotFoundError, UnauthorizedError } from '../../../common/errors/app-error.js';
import { AuthRepository } from '../../auth/repository/auth.repository.js';
import { PendingDeletionRepository } from '../../documents/repository/pending-deletion.repository.js';
import { UploadsService } from '../../uploads/service/uploads.service.js';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository = new UsersRepository(),
    private readonly authRepository: AuthRepository = new AuthRepository(),
    private readonly pendingDeletionRepository: PendingDeletionRepository = new PendingDeletionRepository(),
    private readonly uploadsService: UploadsService = new UploadsService()
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const updated = await this.usersRepository.updateProfile(userId, {
      name: dto.name?.trim(),
    });

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const isValidPassword = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Current password does not match', 'INVALID_CURRENT_PASSWORD');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.usersRepository.updateProfile(userId, { passwordHash });

    // Revoke all existing refresh tokens so other sessions can't keep using
    // the old credentials once the password has changed.
    await this.authRepository.deleteAllUserRefreshTokens(userId);
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Collect all cloud assets owned by this user before cascade deletion removes ownership records
    const userDocs = await prisma.document.findMany({
      where: { userId },
      include: { pages: true },
    });

    const pendingEntries: { fileUrl: string; documentId: string | null; userId: string }[] = [];
    const seenUrls = new Set<string>();

    for (const doc of userDocs) {
      const docUrls: string[] = [];
      if (doc.thumbnailUrl) docUrls.push(doc.thumbnailUrl);
      if (doc.pdfUrl) docUrls.push(doc.pdfUrl);
      for (const page of doc.pages) {
        if (page.imageUrl) docUrls.push(page.imageUrl);
        if (page.thumbnailUrl) docUrls.push(page.thumbnailUrl);
      }

      for (const url of docUrls) {
        if (url.startsWith('http') && !seenUrls.has(url)) {
          seenUrls.add(url);
          pendingEntries.push({ fileUrl: url, documentId: doc.id, userId });
        }
      }
    }

    // Persist all cloud URLs in pending_deletions before removing user
    if (pendingEntries.length > 0) {
      await this.pendingDeletionRepository.createMany(pendingEntries);
    }

    // Irreversibly delete user (cascades to documents, folders, tokens)
    await this.usersRepository.deleteUser(userId);

    // Fire-and-forget B2 cleanup attempt
    const cloudUrls = pendingEntries.map((e) => e.fileUrl);
    if (cloudUrls.length > 0) {
      this._cleanupB2Files(cloudUrls, userId);
    }
  }

  /**
   * Attempts to delete B2 files belonging to the deleted user, updating
   * pending-deletion records with success or failure for the retry worker.
   */
  private _cleanupB2Files(urls: string[], userId: string): void {
    Promise.allSettled(
      urls.map((url) => this.uploadsService.deleteFileByUrl(url))
    ).then(async (results) => {
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const url = urls[i];
        if (result.status === 'fulfilled') {
          await this.pendingDeletionRepository.markCompletedByUrl(url);
        } else {
          const errorMsg = (result as PromiseRejectedResult).reason?.message ?? 'Unknown error';
          console.warn(
            `[UsersService] B2 deletion failed for user ${userId} (${url}):`,
            errorMsg
          );
          await this.pendingDeletionRepository.markFailedByUrl(url, errorMsg);
        }
      }
    });
  }
}
