import { Router } from 'express';
import * as controller from '../controllers/booking.controller';
import { validate } from '../middleware/validate.middleware';
import {
  availabilityQuerySchema,
  createBookingSchema,
  updateBookingStatusSchema,
  listBookingsQuerySchema,
  lookupBookingQuerySchema,
} from '../validators/booking.validators';
import { idParamSchema } from '../validators/service.validators';
import { publicTenantChain, publicOrCustomerChain, staffOrAdminChain } from '../middleware/chains';

const router = Router();

// Public booking flow — anonymous customers on the storefront. Booking
// creation uses publicOrCustomerChain (not plain publicTenantChain) so a
// logged-in customer's booking links to their account automatically while
// guest checkout (no login) still works unchanged.
router.get('/available-slots', ...publicTenantChain, validate({ query: availabilityQuerySchema }), controller.getAvailableSlots);
router.post('/', ...publicOrCustomerChain, validate({ body: createBookingSchema }), controller.createBooking);

// Guest access to a single booking (view status / pay) via its unguessable
// publicToken — no login needed, this is what fixes "Pay Now disappears
// after refresh" for anonymous customers.
router.get('/lookup', ...publicTenantChain, validate({ query: lookupBookingQuerySchema }), controller.lookupBooking);

// Admin/staff management
router.get('/admin', ...staffOrAdminChain, validate({ query: listBookingsQuerySchema }), controller.listAdminBookings);
router.patch('/admin/:id/status', ...staffOrAdminChain, validate({ params: idParamSchema, body: updateBookingStatusSchema }), controller.updateBookingStatus);
router.delete('/admin/:id', ...staffOrAdminChain, validate({ params: idParamSchema }), controller.cancelBooking);

export default router;
