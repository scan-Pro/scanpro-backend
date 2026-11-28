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

  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.verifyOtp(req.body);
      ApiResponse.success(res, 'OTP verified successfully');
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.forgotPassword(req.body);
      ApiResponse.success(res, 'If the account exists, a password reset code has been sent');
    } catch (error) {
      next(error);
    }
  };

  resendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.resendOtp(req.body);
      ApiResponse.success(res, 'If the request is eligible, a new code has been sent');
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.resetPassword(req.body);
      ApiResponse.success(res, 'Password reset successfully');
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
