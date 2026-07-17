import { Router } from 'express';
import * as controller from '../controllers/gallery.controller';
import { validate } from '../middleware/validate.middleware';
import { createGallerySchema, updateGallerySchema } from '../validators/gallery.validators';
import { idParamSchema } from '../validators/service.validators';
import { publicTenantChain, staffOrAdminChain, contentAdminChain } from '../middleware/chains';
import { uploadImage } from '../middleware/upload.middleware';

const router = Router();

router.get('/', ...publicTenantChain, controller.listPublicGallery);

router.get('/admin', ...staffOrAdminChain, controller.listAdminGallery);
router.post('/admin', ...contentAdminChain, uploadImage.single('image'), validate({ body: createGallerySchema }), controller.uploadGalleryImage);
router.put('/admin/:id', ...contentAdminChain, validate({ params: idParamSchema, body: updateGallerySchema }), controller.updateGalleryImage);
router.delete('/admin/:id', ...contentAdminChain, validate({ params: idParamSchema }), controller.deleteGalleryImage);

export default router;
