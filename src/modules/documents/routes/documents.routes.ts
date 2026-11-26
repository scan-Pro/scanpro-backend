import { Router } from 'express';
import { DocumentsController } from '../controller/documents.controller.js';
import { authenticate, requireActiveAccount } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentIdParamSchema,
  favoriteToggleSchema,
  moveFolderSchema,
  searchDocumentsSchema,
} from '../validation/documents.validation.js';

const router = Router();
const documentsController = new DocumentsController();

router.use(authenticate);

router.post('/', requireActiveAccount, validate(createDocumentSchema), documentsController.createDocument);
router.get('/', validate(searchDocumentsSchema), documentsController.getDocuments);
router.get('/:id', validate(documentIdParamSchema), documentsController.getDocumentById);
router.patch('/:id', requireActiveAccount, validate(updateDocumentSchema), documentsController.updateDocument);
router.delete('/:id', requireActiveAccount, validate(documentIdParamSchema), documentsController.deleteDocument);
router.patch('/:id/favorite', requireActiveAccount, validate(favoriteToggleSchema), documentsController.toggleFavorite);
router.patch('/:id/folder', requireActiveAccount, validate(moveFolderSchema), documentsController.moveToFolder);

export const documentsRoutes = router;
