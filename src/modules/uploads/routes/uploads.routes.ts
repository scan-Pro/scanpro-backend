import { Router } from 'express';
import { UploadsController } from '../controller/uploads.controller.js';
import { authenticate, requireActiveAccount } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import { getPresignedUrlSchema } from '../validation/uploads.validation.js';

const router = Router();
const uploadsController = new UploadsController();

router.use(authenticate);
router.post('/presigned-url', requireActiveAccount, validate(getPresignedUrlSchema), uploadsController.getPresignedUrl);

export const uploadsRoutes = router;
