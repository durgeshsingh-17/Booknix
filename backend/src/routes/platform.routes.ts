import { Router } from 'express';
import * as controller from '../controllers/platform.controller';
import { validate } from '../middleware/validate.middleware';
import { listSalonsQuerySchema, setSalonActiveSchema, setSubscriptionStatusSchema, salonIdParamSchema } from '../validators/platform.validators';
import { superadminChain } from '../middleware/chains';

const router = Router();

// Public and unauthenticated on purpose — this is Caddy's On-Demand TLS "ask"
// callback (see /Caddyfile), called before Caddy will issue a certificate for
// a hostname it hasn't seen before. It reveals nothing beyond a yes/no.
router.get('/verify-domain', controller.verifyDomainForTls);

router.get('/salons', ...superadminChain, validate({ query: listSalonsQuerySchema }), controller.listSalons);
router.get('/salons/:id', ...superadminChain, validate({ params: salonIdParamSchema }), controller.getSalon);
router.patch('/salons/:id/active', ...superadminChain, validate({ params: salonIdParamSchema, body: setSalonActiveSchema }), controller.setSalonActive);
router.patch(
  '/salons/:id/subscription-status',
  ...superadminChain,
  validate({ params: salonIdParamSchema, body: setSubscriptionStatusSchema }),
  controller.setSubscriptionStatus,
);

export default router;
