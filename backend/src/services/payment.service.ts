import crypto from 'crypto';
import { Types } from 'mongoose';
import Payment from '../models/Payment';
import Booking from '../models/Booking';
import Service from '../models/Service';
import Salon from '../models/Salon';
import Staff from '../models/Staff';
import { ApiError } from '../utils/ApiError';
import { razorpayProvider } from './payments/razorpayProvider';
import { stripeProvider } from './payments/stripeProvider';
import { PaymentProvider } from './payments/provider';
import { env } from '../config/env';
import { getRazorpayClient } from '../config/razorpay';
import { getStripeClient } from '../config/stripe';
import { logger } from '../config/logger';

const providers: Record<'razorpay' | 'stripe', PaymentProvider> = {
  razorpay: razorpayProvider,
  stripe: stripeProvider,
};

export async function createOrderForBooking(salonId: Types.ObjectId, bookingId: string, providerName: 'razorpay' | 'stripe') {
  const booking = await Booking.findOne({ _id: bookingId, salonId });
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.paymentStatus === 'paid') throw ApiError.badRequest('This booking has already been paid');

  // A customer who backs out of checkout and hits "Pay Now" again shouldn't
  // rack up a fresh order every time — reuse the still-open one so the
  // provider dashboard doesn't fill up with abandoned orders.
  const existing = await Payment.findOne({ bookingId: booking._id, provider: providerName, status: 'created' });
  if (existing) {
    if (providerName === 'razorpay') {
      // Razorpay order details (amount/currency/order_id) are static and safe
      // to reconstruct from what we already stored — no need to call their API again.
      return {
        paymentId: String(existing._id),
        keyId: env.RAZORPAY_KEY_ID,
        orderId: existing.providerOrderId,
        amount: Math.round(existing.amount * 100),
        currency: existing.currency,
      };
    }
    // Stripe's client_secret isn't persisted (it's only meant to be read once
    // by the client that created it), so reopening means re-fetching the
    // PaymentIntent to get a fresh one for the same underlying intent.
    const paymentIntent = await getStripeClient().paymentIntents.retrieve(existing.providerOrderId);
    return {
      paymentId: String(existing._id),
      publishableKey: env.STRIPE_PUBLISHABLE_KEY,
      clientSecret: paymentIntent.client_secret,
    };
  }

  const service = await Service.findById(booking.serviceId);
  if (!service) throw ApiError.notFound('Service not found for this booking');

  const provider = providers[providerName];
  let result;
  try {
    result = await provider.createOrder({ amount: service.price, currency: 'INR', receipt: String(booking._id) });
  } catch (error) {
    // Razorpay/Stripe SDKs often reject with a plain object rather than an
    // Error instance (e.g. Razorpay auth failures), which the generic error
    // handler can't safely relay to the client and would otherwise surface
    // as an opaque, undiagnosable 500. Log the raw provider error server-side
    // and turn it into a clean, client-safe 502 instead.
    logger.error(`${providerName} order creation failed`, { error, bookingId: String(booking._id) });
    throw ApiError.badGateway('Could not reach the payment gateway — please try again in a moment, or pay at the salon.');
  }

  const payment = await Payment.create({
    salonId,
    bookingId: booking._id,
    provider: providerName,
    providerOrderId: result.providerOrderId,
    amount: service.price,
    currency: 'INR',
    status: 'created',
  });

  booking.paymentId = payment._id as never;
  await booking.save();

  return { paymentId: String(payment._id), ...result.clientPayload };
}

/**
 * Starts a Razorpay Subscription for the salon's chosen plan tier. Requires
 * the corresponding Plan to already exist in the Razorpay dashboard
 * (Subscriptions > Plans) with its id set as RAZORPAY_PLAN_ID_BASIC/_PRO —
 * Razorpay has no API to create Plans on the fly from arbitrary price
 * points, they're dashboard-configured products. See docs/SAAS_SCALING.md.
 */
export async function createSubscriptionForSalon(salonId: Types.ObjectId, planTier: 'basic' | 'pro') {
  const planId = planTier === 'basic' ? env.RAZORPAY_PLAN_ID_BASIC : env.RAZORPAY_PLAN_ID_PRO;
  if (!planId) {
    throw ApiError.badRequest(
      `Razorpay plan for "${planTier}" is not configured yet — set RAZORPAY_PLAN_ID_${planTier.toUpperCase()} in the backend .env once you've created the plan in your Razorpay dashboard.`,
    );
  }

  const salon = await Salon.findById(salonId);
  if (!salon) throw ApiError.notFound('Salon not found');

  const subscription = await getRazorpayClient().subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    // Razorpay requires a finite total_count even for an effectively
    // open-ended subscription; 100 monthly cycles (~8 years) is the
    // commonly recommended stand-in for "renews indefinitely."
    total_count: 100,
  });

  salon.razorpaySubscriptionId = subscription.id;
  await salon.save();

  return { subscriptionId: subscription.id, keyId: env.RAZORPAY_KEY_ID };
}

/**
 * Starts a Razorpay Subscription for one specific staff member's "barber
 * seat" — independent of the salon's own subscription. Same Plan-id
 * requirement/caveat as createSubscriptionForSalon above.
 */
export async function createSubscriptionForStaff(salonId: Types.ObjectId, staffId: string, planTier: 'basic' | 'pro') {
  const planId = planTier === 'basic' ? env.RAZORPAY_PLAN_ID_BASIC : env.RAZORPAY_PLAN_ID_PRO;
  if (!planId) {
    throw ApiError.badRequest(
      `Razorpay plan for "${planTier}" is not configured yet — set RAZORPAY_PLAN_ID_${planTier.toUpperCase()} in the backend .env once you've created the plan in your Razorpay dashboard.`,
    );
  }

  const staff = await Staff.findOne({ _id: staffId, salonId });
  if (!staff) throw ApiError.notFound('Staff member not found');

  const subscription = await getRazorpayClient().subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    total_count: 100,
  });

  staff.razorpaySubscriptionId = subscription.id;
  staff.plan = planTier;
  await staff.save();

  return { subscriptionId: subscription.id, keyId: env.RAZORPAY_KEY_ID };
}

/**
 * Refunds a paid booking's payment via the original provider and reflects
 * it on both the Payment record and the Booking itself. Full refund only
 * (no partial-amount support yet) — the common case for a salon cancelling
 * a prepaid appointment.
 */
export async function refundPayment(salonId: Types.ObjectId, paymentId: string) {
  const payment = await Payment.findOne({ _id: paymentId, salonId });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status !== 'paid') throw ApiError.badRequest('Only a paid payment can be refunded');

  if (payment.provider === 'razorpay') {
    await getRazorpayClient().payments.refund(payment.providerPaymentId, {
      amount: Math.round(payment.amount * 100),
    });
  } else {
    await getStripeClient().refunds.create({ payment_intent: payment.providerPaymentId });
  }

  payment.status = 'refunded';
  await payment.save();
  await Booking.findByIdAndUpdate(payment.bookingId, { paymentStatus: 'refunded' });

  return payment;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function handleRazorpayWebhook(rawBody: Buffer, signature: string | undefined) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw ApiError.internal('Razorpay webhook secret is not configured');
  if (!signature) throw ApiError.unauthorized('Missing webhook signature');

  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  if (!timingSafeEqualHex(expected, signature)) {
    throw ApiError.unauthorized('Invalid webhook signature');
  }

  const event = JSON.parse(rawBody.toString('utf8'));
  const eventType = event.event as string;

  if (eventType.startsWith('subscription.')) {
    await handleRazorpaySubscriptionEvent(eventType, event);
    return;
  }

  const paymentEntity = event.payload?.payment?.entity;
  if (!paymentEntity) return;

  const payment = await Payment.findOne({ providerOrderId: paymentEntity.order_id, provider: 'razorpay' });
  if (!payment) {
    logger.warn('Razorpay webhook for unknown order', { orderId: paymentEntity.order_id });
    return;
  }

  if (eventType === 'payment.captured') {
    payment.status = 'paid';
    payment.providerPaymentId = paymentEntity.id;
    payment.rawWebhookPayload = event;
    await payment.save();
    await Booking.findByIdAndUpdate(payment.bookingId, { paymentStatus: 'paid' });
  } else if (eventType === 'payment.failed') {
    payment.status = 'failed';
    payment.rawWebhookPayload = event;
    await payment.save();
    // Previously only the Payment record reflected this — the booking itself
    // stayed 'unpaid' forever, indistinguishable from "never attempted."
    // Customers need to actually see "Payment Failed" and be prompted to retry.
    await Booking.findByIdAndUpdate(payment.bookingId, { paymentStatus: 'failed' });
  }
}

function subscriptionStatusFor(eventType: string): 'active' | 'past_due' | 'cancelled' | null {
  switch (eventType) {
    case 'subscription.activated':
    case 'subscription.charged':
    case 'subscription.resumed':
      return 'active';
    case 'subscription.pending':
    case 'subscription.halted':
      // Payment retry window / dunning — degrade gracefully rather than an
      // immediate hard lock (see subscription.middleware.ts / staffEligibility.ts,
      // both of which only block on 'cancelled', not 'past_due').
      return 'past_due';
    case 'subscription.cancelled':
    case 'subscription.completed':
      return 'cancelled';
    default:
      return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRazorpaySubscriptionEvent(eventType: string, event: any) {
  const subscriptionEntity = event.payload?.subscription?.entity;
  if (!subscriptionEntity) return;

  const nextStatus = subscriptionStatusFor(eventType);
  if (!nextStatus) return;

  // A subscription id can belong to either a salon (salon-wide plan) or an
  // individual staff member ("barber seat") — check both, since Razorpay's
  // webhook payload has no way to tell us which kind this is upfront.
  const salon = await Salon.findOne({ razorpaySubscriptionId: subscriptionEntity.id });
  if (salon) {
    salon.subscriptionStatus = nextStatus;
    await salon.save();
    return;
  }

  const staff = await Staff.findOne({ razorpaySubscriptionId: subscriptionEntity.id });
  if (staff) {
    staff.subscriptionStatus = nextStatus;
    await staff.save();
    return;
  }

  logger.warn('Razorpay subscription webhook for unknown subscription', { subscriptionId: subscriptionEntity.id });
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  if (!env.STRIPE_WEBHOOK_SECRET) throw ApiError.internal('Stripe webhook secret is not configured');
  if (!signature) throw ApiError.unauthorized('Missing webhook signature');

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid webhook signature');
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as { id: string };
    const payment = await Payment.findOne({ providerOrderId: paymentIntent.id, provider: 'stripe' });
    if (!payment) {
      logger.warn('Stripe webhook for unknown payment intent', { id: paymentIntent.id });
      return;
    }
    payment.status = 'paid';
    payment.providerPaymentId = paymentIntent.id;
    payment.rawWebhookPayload = event;
    await payment.save();
    await Booking.findByIdAndUpdate(payment.bookingId, { paymentStatus: 'paid' });
  } else if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as { id: string };
    const payment = await Payment.findOne({ providerOrderId: paymentIntent.id, provider: 'stripe' });
    if (payment) {
      payment.status = 'failed';
      payment.rawWebhookPayload = event;
      await payment.save();
      await Booking.findByIdAndUpdate(payment.bookingId, { paymentStatus: 'failed' });
    }
  }
}
