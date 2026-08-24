import { Router } from 'express';
import { UsersController } from '../controller/users.controller.js';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import { updateProfileSchema, changePasswordSchema } from '../validation/users.validation.js';

const router = Router();
const usersController = new UsersController();

router.use(authenticate);

router.get('/profile', usersController.getProfile);
router.patch('/profile', validate(updateProfileSchema), usersController.updateProfile);
router.post('/change-password', validate(changePasswordSchema), usersController.changePassword);
router.delete('/account', usersController.deleteAccount);

export const usersRoutes = router;
