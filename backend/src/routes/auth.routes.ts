import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { registerSalonSchema, loginSchema, refreshSchema } from '../validators/auth.validators';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/register-salon', authLimiter, validate({ body: registerSalonSchema }), authController.registerSalon);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/refresh', authLimiter, validate({ body: refreshSchema }), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
