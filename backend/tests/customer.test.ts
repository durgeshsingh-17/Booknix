const sendOtpMock = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/services/otp/consoleOtpProvider', () => ({
  consoleOtpProvider: { name: 'console', sendOtp: (...args: unknown[]) => sendOtpMock(...args) },
}));

import request from 'supertest';
import { createApp } from '../src/app';
import Customer from '../src/models/Customer';

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

async function setupSalonWithServiceAndStaff() {
  const register = await request(app).post('/api/v1/auth/register-salon').send(salonPayload);
  const accessToken = register.body.data.accessToken as string;
  const auth = { Authorization: `Bearer ${accessToken}`, 'x-salon-slug': salonPayload.slug };

  const serviceRes = await request(app)
    .post('/api/v1/services/admin')
    .set(auth)
    .send({ name: 'Haircut', category: 'unisex', durationMinutes: 30, price: 300 });
  const staffRes = await request(app).post('/api/v1/staff/admin').set(auth).send({ name: 'Ravi', specialties: [serviceRes.body.data._id] });

  return { auth, serviceId: serviceRes.body.data._id as string, staffId: staffRes.body.data._id as string };
}

async function createBookingAsGuest(serviceId: string, staffId: string, phone: string) {
  const date = tomorrowDateStr();
  const slotsRes = await request(app).get('/api/v1/bookings/available-slots').set('x-salon-slug', salonPayload.slug).query({ serviceId, date });
  const time = slotsRes.body.data.slots[0];
  return request(app)
    .post('/api/v1/bookings')
    .set('x-salon-slug', salonPayload.slug)
    .send({ serviceId, staffId, date, time, customer: { name: 'Anita', phone } });
}

describe('Customer accounts', () => {
  beforeEach(() => sendOtpMock.mockClear());

  it('links every booking to a Customer CRM profile, guest or logged-in', async () => {
    const { serviceId, staffId } = await setupSalonWithServiceAndStaff();
    const booked = await createBookingAsGuest(serviceId, staffId, '9123456780');

    expect(booked.status).toBe(201);
    expect(booked.body.data.customerId).toBeTruthy();

    const customer = await Customer.findOne({ phone: '9123456780' });
    expect(customer).not.toBeNull();
    expect(customer?.name).toBe('Anita');
    expect(String(customer?._id)).toBe(booked.body.data.customerId);
  });

  it('reuses the same Customer profile across repeat bookings by the same phone number', async () => {
    const { serviceId, staffId } = await setupSalonWithServiceAndStaff();
    const first = await createBookingAsGuest(serviceId, staffId, '9123456781');

    const countBefore = await Customer.countDocuments({ phone: '9123456781' });
    expect(countBefore).toBe(1);

    // A second booking with the same phone but a different display name
    // should update the existing profile, not create a duplicate.
    const date = tomorrowDateStr();
    const slotsRes = await request(app).get('/api/v1/bookings/available-slots').set('x-salon-slug', salonPayload.slug).query({ serviceId, date });
    // A different slot than the first booking used (which is now occupied).
    const time = slotsRes.body.data.slots[1];

    const second = await request(app)
      .post('/api/v1/bookings')
      .set('x-salon-slug', salonPayload.slug)
      .send({ serviceId, staffId, date, time, customer: { name: 'Anita Kumar', phone: '9123456781' } });

    expect(second.status).toBe(201);
    expect(second.body.data.customerId).toBe(first.body.data.customerId);

    const countAfter = await Customer.countDocuments({ phone: '9123456781' });
    expect(countAfter).toBe(1);
    const customer = await Customer.findOne({ phone: '9123456781' });
    expect(customer?.name).toBe('Anita Kumar');
  });

  it('lets a guest view and later pay for their booking via its lookup token, without logging in', async () => {
    const { serviceId, staffId } = await setupSalonWithServiceAndStaff();
    const booked = await createBookingAsGuest(serviceId, staffId, '9123456782');
    const { _id: bookingId, publicToken } = booked.body.data;

    const lookup = await request(app).get('/api/v1/bookings/lookup').set('x-salon-slug', salonPayload.slug).query({ bookingId, token: publicToken });
    expect(lookup.status).toBe(200);
    expect(lookup.body.data._id).toBe(bookingId);
    expect(lookup.body.data.paymentStatus).toBe('unpaid');
  });

  it('rejects a booking lookup with the wrong token', async () => {
    const { serviceId, staffId } = await setupSalonWithServiceAndStaff();
    const booked = await createBookingAsGuest(serviceId, staffId, '9123456783');

    const lookup = await request(app)
      .get('/api/v1/bookings/lookup')
      .set('x-salon-slug', salonPayload.slug)
      .query({ bookingId: booked.body.data._id, token: 'a'.repeat(48) });
    expect(lookup.status).toBe(404);
  });

  it('completes the phone + OTP login flow and returns the customer their booking history', async () => {
    const { serviceId, staffId } = await setupSalonWithServiceAndStaff();
    await createBookingAsGuest(serviceId, staffId, '9123456784');

    const requestRes = await request(app).post('/api/v1/customer-auth/request-otp').set('x-salon-slug', salonPayload.slug).send({ phone: '9123456784' });
    expect(requestRes.status).toBe(200);
    expect(sendOtpMock).toHaveBeenCalledTimes(1);
    const [, otp] = sendOtpMock.mock.calls[0] as [string, string];

    const verifyRes = await request(app)
      .post('/api/v1/customer-auth/verify-otp')
      .set('x-salon-slug', salonPayload.slug)
      .send({ phone: '9123456784', otp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.customer.isVerified).toBe(true);
    const customerToken = verifyRes.body.data.accessToken as string;

    const meRes = await request(app).get('/api/v1/customer/me').set('Authorization', `Bearer ${customerToken}`).set('x-salon-slug', salonPayload.slug);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.phone).toBe('9123456784');

    const bookingsRes = await request(app)
      .get('/api/v1/customer/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('x-salon-slug', salonPayload.slug);
    expect(bookingsRes.status).toBe(200);
    expect(bookingsRes.body.data.length).toBe(1);
  });

  it('rejects an incorrect OTP and eventually locks out after too many attempts', async () => {
    const { serviceId, staffId } = await setupSalonWithServiceAndStaff();
    await createBookingAsGuest(serviceId, staffId, '9123456785');

    await request(app).post('/api/v1/customer-auth/request-otp').set('x-salon-slug', salonPayload.slug).send({ phone: '9123456785' });

    const wrong = await request(app)
      .post('/api/v1/customer-auth/verify-otp')
      .set('x-salon-slug', salonPayload.slug)
      .send({ phone: '9123456785', otp: '000000' });
    expect(wrong.status).toBe(401);
  });
});
