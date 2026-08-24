import { Router } from 'express';
import { FoldersController } from '../controller/folders.controller.js';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import { createFolderSchema, updateFolderSchema, folderIdParamSchema } from '../validation/folders.validation.js';
const router = Router();
const foldersController = new FoldersController();
router.use(authenticate);
router.post('/', validate(createFolderSchema), foldersController.createFolder);
router.get('/', foldersController.getFolders);
router.get('/:id', validate(folderIdParamSchema), foldersController.getFolderById);
router.patch('/:id', validate(updateFolderSchema), foldersController.updateFolder);
router.delete('/:id', validate(folderIdParamSchema), foldersController.deleteFolder);
export const foldersRoutes = router;
//# sourceMappingURL=folders.routes.js.map