import { User } from '@prisma/client';
export declare class UsersRepository {
    findById(id: string): Promise<User | null>;
    updateProfile(id: string, data: {
        name?: string;
        passwordHash?: string;
    }): Promise<User>;
    deleteUser(id: string): Promise<void>;
}
