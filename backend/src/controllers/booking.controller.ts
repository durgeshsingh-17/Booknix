import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { ROLES } from '../types/roles';
import * as bookingService from '../services/booking.service';

export const getAvailableSlots = asyncHandler(async (req: Request, res: Response) => {
  const { serviceId, date, staffId } = req.query as { serviceId: string; date: string; staffId?: string };
  const slots = await bookingService.getAvailableSlots({
    salonId: req.tenant!._id as unknown as Types.ObjectId,
    serviceId,
    date,
    staffId,
  });
  res.json({ success: true, data: { date, slots } });
});

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  // req.authUser is populated by authenticateOptional (publicOrCustomerChain)
  // when a valid token was sent — could be a logged-in customer OR an
  // admin/staff member creating a booking on someone's behalf, so these
  // map to two different fields, not one.
  const isCustomer = req.authUser?.role === ROLES.CUSTOMER;

  const booking = await bookingService.createBooking({
    salonId: req.tenant!._id as unknown as Types.ObjectId,
    serviceId: req.body.serviceId,
    staffId: req.body.staffId,
    date: req.body.date,
    time: req.body.time,
    customer: req.body.customer,
    notes: req.body.notes,
    createdBy: !isCustomer ? (req.authUser?.id ?? null) : null,
    authenticatedCustomerId: isCustomer ? req.authUser!.id : null,
  });
  res.status(201).json({ success: true, data: booking });
});

export const lookupBooking = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId, token } = req.query as { bookingId: string; token: string };
  const booking = await bookingService.findBookingByLookup(req.tenant!._id as unknown as Types.ObjectId, bookingId, token);
  res.json({ success: true, data: booking });
});

export const listAdminBookings = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, status, staffId, page, limit } = req.query as unknown as {
    from?: string;
    to?: string;
    status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
    staffId?: string;
    page: number;
    limit: number;
  };
  const result = await bookingService.listBookings({
    salonId: req.tenant!._id as unknown as Types.ObjectId,
    from,
    to,
    status,
    staffId,
    page,
    limit,
  });
  res.json({ success: true, data: result });
});

export const updateBookingStatus = asyncHandler(async (req: Request, res: Response) => {
  const booking = await bookingService.updateBookingStatus(req.tenant!._id as unknown as Types.ObjectId, req.params.id as string, req.body.status);
  res.json({ success: true, data: booking });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await bookingService.cancelBooking(req.tenant!._id as unknown as Types.ObjectId, req.params.id as string);
  res.json({ success: true, data: booking });
});
