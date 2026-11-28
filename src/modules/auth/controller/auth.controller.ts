import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../service/auth.service.js';
import { ApiResponse } from '../../../common/response/api-response.js';

export class AuthController {
  constructor(private readonly authService: AuthService = new AuthService()) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      ApiResponse.created(res, 'User registered successfully', result);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);
      ApiResponse.success(res, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokens = await this.authService.refreshTokens(req.body);
      ApiResponse.success(res, 'Tokens refreshed successfully', tokens);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawRefreshToken = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
      const refreshToken = typeof rawRefreshToken === 'string' ? rawRefreshToken : undefined;
      await this.authService.logout(refreshToken);
      ApiResponse.success(res, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  };
}
