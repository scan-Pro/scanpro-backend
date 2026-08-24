import { Router } from 'express';
import { DocumentsController } from '../controller/documents.controller.js';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validation.middleware.js';
import { createDocumentSchema, updateDocumentSchema, documentIdParamSchema, favoriteToggleSchema, moveFolderSchema, searchDocumentsSchema, } from '../validation/documents.validation.js';
const router = Router();
const documentsController = new DocumentsController();
router.use(authenticate);
router.post('/', validate(createDocumentSchema), documentsController.createDocument);
router.get('/', validate(searchDocumentsSchema), documentsController.getDocuments);
router.get('/:id', validate(documentIdParamSchema), documentsController.getDocumentById);
router.patch('/:id', validate(updateDocumentSchema), documentsController.updateDocument);
router.delete('/:id', validate(documentIdParamSchema), documentsController.deleteDocument);
router.patch('/:id/favorite', validate(favoriteToggleSchema), documentsController.toggleFavorite);
router.patch('/:id/folder', validate(moveFolderSchema), documentsController.moveToFolder);
export const documentsRoutes = router;
//# sourceMappingURL=documents.routes.js.map