import { Router } from 'express';
import authRoutes from './auth.routes';
import salonRoutes from './salon.routes';
import serviceRoutes from './service.routes';
import staffRoutes from './staff.routes';
import galleryRoutes from './gallery.routes';
import bookingRoutes from './booking.routes';
import paymentRoutes from './payment.routes';
import platformRoutes from './platform.routes';
import customerAuthRoutes from './customerAuth.routes';
import customerRoutes from './customer.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Salon SaaS API is running' });
});

router.use('/auth', authRoutes);
router.use('/salon', salonRoutes);
router.use('/services', serviceRoutes);
router.use('/staff', staffRoutes);
router.use('/gallery', galleryRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/platform', platformRoutes);
router.use('/customer-auth', customerAuthRoutes);
router.use('/customer', customerRoutes);

export default router;
