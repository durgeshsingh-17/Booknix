import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Staff from '../models/Staff';
import { bookableStaffQueryFilter } from '../utils/staffEligibility';

export const listPublicStaff = asyncHandler(async (req: Request, res: Response) => {
  // A barber whose subscription has lapsed shouldn't even be visible as a
  // choice on the public storefront, not just unselectable — otherwise a
  // customer could still pick them and only find out at booking time.
  const staff = await Staff.find({ salonId: req.tenant!._id, ...bookableStaffQueryFilter() })
    .select('name avatar specialties')
    .populate('specialties', 'name category');
  res.json({ success: true, data: staff });
});

export const listAdminStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await Staff.find({ salonId: req.tenant!._id }).populate('specialties', 'name category');
  res.json({ success: true, data: staff });
});

export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await Staff.create({ ...req.body, salonId: req.tenant!._id });
  res.status(201).json({ success: true, data: staff });
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await Staff.findOneAndUpdate({ _id: req.params.id, salonId: req.tenant!._id }, req.body, { new: true });
  if (!staff) throw ApiError.notFound('Staff member not found');
  res.json({ success: true, data: staff });
});

export const deleteStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await Staff.findOneAndDelete({ _id: req.params.id, salonId: req.tenant!._id });
  if (!staff) throw ApiError.notFound('Staff member not found');
  res.json({ success: true, data: null });
});

/** Manual admin control over a staff member's subscription — works without
 * any Razorpay plan configuration, so a salon can always activate/deactivate
 * a barber's booking eligibility directly (Razorpay-driven subscriptions in
 * payment.routes.ts are an alternative path to the same fields, not the only one). */
export const updateStaffSubscription = asyncHandler(async (req: Request, res: Response) => {
  const staff = await Staff.findOneAndUpdate({ _id: req.params.id, salonId: req.tenant!._id }, req.body, { new: true });
  if (!staff) throw ApiError.notFound('Staff member not found');
  res.json({ success: true, data: staff });
});
