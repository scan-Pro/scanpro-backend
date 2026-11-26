import { Router } from 'express';
import { UsersController } from '../controller/users.controller.js';
import { authenticate, requireActiveAccount } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import { updateProfileSchema, changePasswordSchema } from '../validation/users.validation.js';

const router = Router();
const usersController = new UsersController();

router.use(authenticate);

router.get('/profile', usersController.getProfile);
router.patch('/profile', requireActiveAccount, validate(updateProfileSchema), usersController.updateProfile);
router.post('/change-password', requireActiveAccount, validate(changePasswordSchema), usersController.changePassword);
// Account deletion must remain callable while already DELETING; it is idempotent.
router.delete('/account', usersController.deleteAccount);

export const usersRoutes = router;
