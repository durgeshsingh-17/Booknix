import { Router } from 'express';
import * as controller from '../controllers/service.controller';
import { validate } from '../middleware/validate.middleware';
import { createServiceSchema, updateServiceSchema, idParamSchema } from '../validators/service.validators';
import { publicTenantChain, staffOrAdminChain, contentAdminChain } from '../middleware/chains';

const router = Router();

router.get('/', ...publicTenantChain, controller.listPublicServices);

router.get('/admin', ...staffOrAdminChain, controller.listAdminServices);
router.post('/admin', ...contentAdminChain, validate({ body: createServiceSchema }), controller.createService);
router.put('/admin/:id', ...contentAdminChain, validate({ params: idParamSchema, body: updateServiceSchema }), controller.updateService);
router.delete('/admin/:id', ...contentAdminChain, validate({ params: idParamSchema }), controller.deleteService);

export default router;
