import { Router } from 'express';
import { UploadsController } from '../controller/uploads.controller.js';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import { getPresignedUrlSchema } from '../validation/uploads.validation.js';
const router = Router();
const uploadsController = new UploadsController();
router.use(authenticate);
router.post('/presigned-url', validate(getPresignedUrlSchema), uploadsController.getPresignedUrl);
export const uploadsRoutes = router;
//# sourceMappingURL=uploads.routes.js.map