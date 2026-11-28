import { Router } from 'express';
import { AuthController } from '../controller/auth.controller.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from '../validation/auth.validation.js';
import { authRateLimiter } from '../../../middlewares/rate-limit.middleware.js';

const router = Router();
const authController = new AuthController();

router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/verify-otp', authRateLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/resend-otp', authRateLimiter, validate(resendOtpSchema), authController.resendOtp);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authRateLimiter, validate(refreshTokenSchema), authController.refresh);
router.post('/logout', validate(logoutSchema), authController.logout);

export const authRoutes = router;
