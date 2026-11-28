import { Router } from 'express';
import { AuthController } from '../controller/auth.controller.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import { registerSchema, loginSchema, refreshTokenSchema, logoutSchema } from '../validation/auth.validation.js';
import { authRateLimiter } from '../../../middlewares/rate-limit.middleware.js';

const router = Router();
const authController = new AuthController();

router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authRateLimiter, validate(refreshTokenSchema), authController.refresh);
router.post('/logout', validate(logoutSchema), authController.logout);

export const authRoutes = router;
