import { UsersRepository } from '../repository/users.repository.js';
import { UpdateProfileDto, ChangePasswordDto } from '../dto/users.dto.js';
export interface UserProfile {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class UsersService {
    private readonly usersRepository;
    constructor(usersRepository?: UsersRepository);
    getProfile(userId: string): Promise<UserProfile>;
    updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile>;
    changePassword(userId: string, dto: ChangePasswordDto): Promise<void>;
    deleteAccount(userId: string): Promise<void>;
}
