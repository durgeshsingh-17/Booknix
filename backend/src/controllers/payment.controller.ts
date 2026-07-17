import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import * as paymentService from '../services/payment.service';

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.createOrderForBooking(req.tenant!._id as unknown as Types.ObjectId, req.body.bookingId, req.body.provider);
  res.status(201).json({ success: true, data: result });
});

export const createSubscription = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.createSubscriptionForSalon(req.tenant!._id as unknown as Types.ObjectId, req.body.plan);
  res.status(201).json({ success: true, data: result });
});

export const createStaffSubscription = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.createSubscriptionForStaff(req.tenant!._id as unknown as Types.ObjectId, req.body.staffId, req.body.plan);
  res.status(201).json({ success: true, data: result });
});

export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await paymentService.refundPayment(req.tenant!._id as unknown as Types.ObjectId, req.params.paymentId as string);
  res.json({ success: true, data: payment });
});

export const razorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.header('x-razorpay-signature');
  await paymentService.handleRazorpayWebhook(req.body as Buffer, signature);
  res.json({ received: true });
});

export const stripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.header('stripe-signature');
  await paymentService.handleStripeWebhook(req.body as Buffer, signature);
  res.json({ received: true });
});
