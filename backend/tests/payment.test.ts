import crypto from 'crypto';

const refundMock = jest.fn().mockResolvedValue({ id: 'rfnd_test123' });

jest.mock('../src/config/razorpay', () => ({
  getRazorpayClient: () => ({
    orders: {
      create: jest.fn().mockResolvedValue({ id: 'order_test123', amount: 30000, currency: 'INR' }),
    },
    payments: {
      refund: (...args: unknown[]) => refundMock(...args),
    },
  }),
}));

jest.mock('../src/config/stripe', () => ({
  getStripeClient: () => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ id: 'pi_test123', client_secret: 'secret_abc' }),
    },
    webhooks: {
      constructEvent: (body: Buffer, signature: string, secret: string) => {
        if (signature !== `valid-sig-${secret}`) throw new Error('Invalid signature');
        return JSON.parse(body.toString('utf8'));
      },
    },
  }),
}));

import request from 'supertest';
import { createApp } from '../src/app';
import Payment from '../src/models/Payment';
import Booking from '../src/models/Booking';

const app = createApp();

const salonPayload = {
  salonName: 'Glow Salon',
  slug: 'glow-salon',
  subdomain: 'glow',
  phone: '9876543210',
  ownerName: 'Priya Sharma',
  email: 'priya@glowsalon.test',
  password: 'SuperSecret123',
};

function tomorrowDateStr(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0] as string;
}

async function setupBookingWithAuth() {
  const register = await request(app).post('/api/v1/auth/register-salon').send(salonPayload);
  const accessToken = register.body.data.accessToken as string;
  const auth = { Authorization: `Bearer ${accessToken}`, 'x-salon-slug': salonPayload.slug };

  const serviceRes = await request(app)
    .post('/api/v1/services/admin')
    .set(auth)
    .send({ name: 'Haircut', category: 'unisex', durationMinutes: 30, price: 300 });
  const staffRes = await request(app)
    .post('/api/v1/staff/admin')
    .set(auth)
    .send({ name: 'Ravi', specialties: [serviceRes.body.data._id] });

  const date = tomorrowDateStr();
  const slotsRes = await request(app)
    .get('/api/v1/bookings/available-slots')
    .set('x-salon-slug', salonPayload.slug)
    .query({ serviceId: serviceRes.body.data._id, date });
  const time = slotsRes.body.data.slots[0];

  const bookingRes = await request(app)
    .post('/api/v1/bookings')
    .set('x-salon-slug', salonPayload.slug)
    .send({ serviceId: serviceRes.body.data._id, staffId: staffRes.body.data._id, date, time, customer: { name: 'Anita', phone: '9999999999' } });

  return { bookingId: bookingRes.body.data._id as string, auth };
}

async function setupBooking() {
  const { bookingId } = await setupBookingWithAuth();
  return bookingId;
}

describe('Payments', () => {
  it('creates a Razorpay order for a booking', async () => {
    const bookingId = await setupBooking();
    const res = await request(app).post('/api/v1/payments/create-order').set('x-salon-slug', salonPayload.slug).send({ bookingId, provider: 'razorpay' });

    expect(res.status).toBe(201);
    expect(res.body.data.orderId).toBe('order_test123');

    const payment = await Payment.findOne({ providerOrderId: 'order_test123' });
    expect(payment).not.toBeNull();
    expect(payment?.status).toBe('created');
  });

  it('reuses the existing order instead of creating a duplicate on repeated attempts', async () => {
    const bookingId = await setupBooking();
    const first = await request(app).post('/api/v1/payments/create-order').set('x-salon-slug', salonPayload.slug).send({ bookingId, provider: 'razorpay' });
    const second = await request(app).post('/api/v1/payments/create-order').set('x-salon-slug', salonPayload.slug).send({ bookingId, provider: 'razorpay' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.paymentId).toBe(first.body.data.paymentId);
    expect(second.body.data.orderId).toBe(first.body.data.orderId);

    const count = await Payment.countDocuments({ bookingId, provider: 'razorpay' });
    expect(count).toBe(1);
  });

  it('marks the booking paid when a valid Razorpay webhook arrives', async () => {
    const bookingId = await setupBooking();
    await request(app).post('/api/v1/payments/create-order').set('x-salon-slug', salonPayload.slug).send({ bookingId, provider: 'razorpay' });

    const payload = {
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: 'order_test123', id: 'pay_test123' } } },
    };
    const rawBodyString = JSON.stringify(payload);
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET as string;
    const signature = crypto.createHmac('sha256', secret).update(Buffer.from(rawBodyString)).digest('hex');

    // Send the raw JSON string (not a Buffer) — supertest/superagent would
    // otherwise re-serialize a Buffer object when Content-Type is JSON,
    // corrupting the exact bytes the signature was computed over.
    const res = await request(app).post('/api/v1/payments/webhook/razorpay').set('Content-Type', 'application/json').set('x-razorpay-signature', signature).send(rawBodyString);

    expect(res.status).toBe(200);
    const booking = await Booking.findById(bookingId);
    expect(booking?.paymentStatus).toBe('paid');
  });

  it('rejects a Razorpay webhook with a bad signature', async () => {
    const payload = { event: 'payment.captured', payload: { payment: { entity: { order_id: 'order_test123', id: 'pay_test123' } } } };
    const rawBody = Buffer.from(JSON.stringify(payload));

    const res = await request(app)
      .post('/api/v1/payments/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'not-the-right-signature')
      .send(rawBody);

    expect(res.status).toBe(401);
  });

  it('marks the booking as payment-failed (not just "unpaid") when a payment.failed webhook arrives', async () => {
    const bookingId = await setupBooking();
    await request(app).post('/api/v1/payments/create-order').set('x-salon-slug', salonPayload.slug).send({ bookingId, provider: 'razorpay' });

    const payload = {
      event: 'payment.failed',
      payload: { payment: { entity: { order_id: 'order_test123', id: 'pay_test_failed' } } },
    };
    const rawBodyString = JSON.stringify(payload);
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET as string;
    const signature = crypto.createHmac('sha256', secret).update(Buffer.from(rawBodyString)).digest('hex');

    const res = await request(app)
      .post('/api/v1/payments/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(rawBodyString);

    expect(res.status).toBe(200);
    const booking = await Booking.findById(bookingId);
    expect(booking?.paymentStatus).toBe('failed');

    const payment = await Payment.findOne({ providerOrderId: 'order_test123' });
    expect(payment?.status).toBe('failed');
  });

  it('lets a salon admin refund a paid booking, reflected on both the Payment and the Booking', async () => {
    const { bookingId, auth } = await setupBookingWithAuth();
    const orderRes = await request(app).post('/api/v1/payments/create-order').set('x-salon-slug', salonPayload.slug).send({ bookingId, provider: 'razorpay' });
    const paymentId = orderRes.body.data.paymentId as string;

    const payload = {
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: 'order_test123', id: 'pay_test_refund' } } },
    };
    const rawBodyString = JSON.stringify(payload);
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET as string;
    const signature = crypto.createHmac('sha256', secret).update(Buffer.from(rawBodyString)).digest('hex');
    await request(app).post('/api/v1/payments/webhook/razorpay').set('Content-Type', 'application/json').set('x-razorpay-signature', signature).send(rawBodyString);

    const refundRes = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set(auth);
    expect(refundRes.status).toBe(200);
    expect(refundRes.body.data.status).toBe('refunded');
    expect(refundMock).toHaveBeenCalledWith('pay_test_refund', { amount: 30000 });

    const booking = await Booking.findById(bookingId);
    expect(booking?.paymentStatus).toBe('refunded');
  });

  it('rejects refunding a payment that was never actually paid', async () => {
    const { bookingId, auth } = await setupBookingWithAuth();
    const orderRes = await request(app).post('/api/v1/payments/create-order').set('x-salon-slug', salonPayload.slug).send({ bookingId, provider: 'razorpay' });
    const paymentId = orderRes.body.data.paymentId as string;

    const refundRes = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set(auth);
    expect(refundRes.status).toBe(400);
  });
});
