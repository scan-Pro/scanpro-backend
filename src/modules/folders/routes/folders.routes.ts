import { Router } from 'express';
import { FoldersController } from '../controller/folders.controller.js';
import { authenticate, requireActiveAccount } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import { createFolderSchema, updateFolderSchema, folderIdParamSchema } from '../validation/folders.validation.js';

const router = Router();
const foldersController = new FoldersController();

router.use(authenticate);

router.post('/', requireActiveAccount, validate(createFolderSchema), foldersController.createFolder);
router.get('/', foldersController.getFolders);
router.get('/:id', validate(folderIdParamSchema), foldersController.getFolderById);
router.patch('/:id', requireActiveAccount, validate(updateFolderSchema), foldersController.updateFolder);
router.delete('/:id', requireActiveAccount, validate(folderIdParamSchema), foldersController.deleteFolder);

export const foldersRoutes = router;
