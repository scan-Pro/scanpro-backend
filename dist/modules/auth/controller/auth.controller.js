import { AuthService } from '../service/auth.service.js';
import { ApiResponse } from '../../../common/response/api-response.js';
export class AuthController {
    authService;
    constructor(authService = new AuthService()) {
        this.authService = authService;
    }
    register = async (req, res, next) => {
        try {
            const result = await this.authService.register(req.body);
            ApiResponse.created(res, 'User registered successfully', result);
        }
        catch (error) {
            next(error);
        }
    };
    login = async (req, res, next) => {
        try {
            const result = await this.authService.login(req.body);
            ApiResponse.success(res, 'Login successful', result);
        }
        catch (error) {
            next(error);
        }
    };
    refresh = async (req, res, next) => {
        try {
            const tokens = await this.authService.refreshTokens(req.body);
            ApiResponse.success(res, 'Tokens refreshed successfully', tokens);
        }
        catch (error) {
            next(error);
        }
    };
    logout = async (req, res, next) => {
        try {
            const { refreshToken } = req.body;
            await this.authService.logout(refreshToken);
            ApiResponse.success(res, 'Logged out successfully');
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=auth.controller.js.map