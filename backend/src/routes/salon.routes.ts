import { Router } from 'express';
import * as controller from '../controllers/salon.controller';
import { validate } from '../middleware/validate.middleware';
import { updateSalonSchema } from '../validators/salon.validators';
import { publicTenantChain, adminChain } from '../middleware/chains';

const router = Router();

router.get('/', ...publicTenantChain, controller.getPublicSalonProfile);

router.get('/admin', ...adminChain, controller.getAdminSalonProfile);
router.put('/admin', ...adminChain, validate({ body: updateSalonSchema }), controller.updateSalonProfile);

export default router;
