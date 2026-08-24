import { AuthRepository } from '../repository/auth.repository.js';
import { RegisterDto, LoginDto, RefreshTokenDto } from '../dto/auth.dto.js';
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface AuthResult {
    user: {
        id: string;
        name: string;
        email: string;
        createdAt: Date;
    };
    tokens: AuthTokens;
}
export declare class AuthService {
    private readonly authRepository;
    constructor(authRepository?: AuthRepository);
    register(dto: RegisterDto): Promise<AuthResult>;
    login(dto: LoginDto): Promise<AuthResult>;
    refreshTokens(dto: RefreshTokenDto): Promise<AuthTokens>;
    logout(refreshToken: string): Promise<void>;
    private generateTokens;
}
