import { Router } from 'express';
import * as controller from '../controllers/staff.controller';
import { validate } from '../middleware/validate.middleware';
import { createStaffSchema, updateStaffSchema, updateStaffSubscriptionSchema } from '../validators/staff.validators';
import { idParamSchema } from '../validators/service.validators';
import { publicTenantChain, staffOrAdminChain, contentAdminChain, adminChain } from '../middleware/chains';

const router = Router();

router.get('/', ...publicTenantChain, controller.listPublicStaff);

router.get('/admin', ...staffOrAdminChain, controller.listAdminStaff);
router.post('/admin', ...contentAdminChain, validate({ body: createStaffSchema }), controller.createStaff);
router.put('/admin/:id', ...contentAdminChain, validate({ params: idParamSchema, body: updateStaffSchema }), controller.updateStaff);
router.delete('/admin/:id', ...contentAdminChain, validate({ params: idParamSchema }), controller.deleteStaff);

// Subscription management is account/billing administration, not "content"
// — intentionally plain adminChain (not contentAdminChain) so a salon whose
// own subscription lapsed can still manage which barbers are active.
router.patch(
  '/admin/:id/subscription',
  ...adminChain,
  validate({ params: idParamSchema, body: updateStaffSubscriptionSchema }),
  controller.updateStaffSubscription,
);

export default router;
