import { Router } from 'express';
import * as controller from '../controllers/customerAuth.controller';
import { validate } from '../middleware/validate.middleware';
import { requestOtpSchema, verifyOtpSchema, customerRefreshSchema } from '../validators/customerAuth.validators';
import { publicTenantChain, customerChain } from '../middleware/chains';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/request-otp', authLimiter, ...publicTenantChain, validate({ body: requestOtpSchema }), controller.requestOtp);
router.post('/verify-otp', authLimiter, ...publicTenantChain, validate({ body: verifyOtpSchema }), controller.verifyOtp);
router.post('/refresh', authLimiter, ...publicTenantChain, validate({ body: customerRefreshSchema }), controller.refresh);
router.post('/logout', ...customerChain, controller.logout);

export default router;
