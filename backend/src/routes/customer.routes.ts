import { Router } from 'express';
import * as controller from '../controllers/customerAuth.controller';
import { customerChain } from '../middleware/chains';

const router = Router();

router.get('/me', ...customerChain, controller.me);
router.get('/bookings', ...customerChain, controller.myBookings);

export default router;
