import { Router } from 'express';
import * as controller from '../controllers/payment.controller';
import { validate } from '../middleware/validate.middleware';
import { createOrderSchema, createSubscriptionSchema, createStaffSubscriptionSchema, paymentIdParamSchema } from '../validators/payment.validators';
import { publicTenantChain, adminChain } from '../middleware/chains';

const router = Router();

router.post('/create-order', ...publicTenantChain, validate({ body: createOrderSchema }), controller.createOrder);

// Starting/renewing the salon's own subscription is an account-management
// action, not "content" — intentionally on adminChain (not contentAdminChain)
// so a salon whose subscription lapsed can still use this route to pay again.
router.post('/create-subscription', ...adminChain, validate({ body: createSubscriptionSchema }), controller.createSubscription);

// Same reasoning for an individual staff member's "barber seat" subscription.
router.post('/create-staff-subscription', ...adminChain, validate({ body: createStaffSubscriptionSchema }), controller.createStaffSubscription);

router.post('/:paymentId/refund', ...adminChain, validate({ params: paymentIdParamSchema }), controller.refundPayment);

// Webhook bodies arrive as a raw Buffer (see app.ts — mounted before the JSON
// parser) so the HMAC/signature check runs against the exact bytes sent.
router.post('/webhook/razorpay', controller.razorpayWebhook);
router.post('/webhook/stripe', controller.stripeWebhook);

export default router;
