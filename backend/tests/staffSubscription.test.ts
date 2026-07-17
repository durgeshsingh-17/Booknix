import request from 'supertest';
import { createApp } from '../src/app';

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

async function setup() {
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

describe('Staff (barber) subscription gating', () => {
  it('a new staff member defaults to an active subscription and is immediately bookable', async () => {
    const { serviceId } = await setup();
    const date = tomorrowDateStr();
    const slots = await request(app).get('/api/v1/bookings/available-slots').set('x-salon-slug', salonPayload.slug).query({ serviceId, date });
    expect(slots.body.data.slots.length).toBeGreaterThan(0);
  });

  it('excludes a staff member with a cancelled subscription from the public listing and from availability', async () => {
    const { auth, serviceId, staffId } = await setup();

    await request(app).patch(`/api/v1/staff/admin/${staffId}/subscription`).set(auth).send({ subscriptionStatus: 'cancelled' });

    const publicList = await request(app).get('/api/v1/staff').set('x-salon-slug', salonPayload.slug);
    expect(publicList.body.data.find((s: { _id: string }) => s._id === staffId)).toBeUndefined();

    const date = tomorrowDateStr();
    const slots = await request(app).get('/api/v1/bookings/available-slots').set('x-salon-slug', salonPayload.slug).query({ serviceId, date });
    expect(slots.body.data.slots.length).toBe(0);
  });

  it('rejects a booking against an explicitly-chosen staff member whose subscription is cancelled', async () => {
    const { auth, serviceId, staffId } = await setup();
    await request(app).patch(`/api/v1/staff/admin/${staffId}/subscription`).set(auth).send({ subscriptionStatus: 'cancelled' });

    const date = tomorrowDateStr();
    const booked = await request(app)
      .post('/api/v1/bookings')
      .set('x-salon-slug', salonPayload.slug)
      .send({ serviceId, staffId, date, time: '10:00', customer: { name: 'Anita', phone: '9999999999' } });
    expect(booked.status).toBe(404);
  });

  it('treats an expired subscriptionExpiresAt as not bookable even when subscriptionStatus is still active', async () => {
    const { auth, serviceId, staffId } = await setup();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await request(app)
      .patch(`/api/v1/staff/admin/${staffId}/subscription`)
      .set(auth)
      .send({ subscriptionStatus: 'active', subscriptionExpiresAt: yesterday.toISOString() });

    const date = tomorrowDateStr();
    const slots = await request(app).get('/api/v1/bookings/available-slots').set('x-salon-slug', salonPayload.slug).query({ serviceId, date });
    expect(slots.body.data.slots.length).toBe(0);
  });

  it('a future subscriptionExpiresAt does not block bookings', async () => {
    const { auth, serviceId, staffId } = await setup();
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    await request(app)
      .patch(`/api/v1/staff/admin/${staffId}/subscription`)
      .set(auth)
      .send({ subscriptionStatus: 'active', subscriptionExpiresAt: nextYear.toISOString() });

    const date = tomorrowDateStr();
    const slots = await request(app).get('/api/v1/bookings/available-slots').set('x-salon-slug', salonPayload.slug).query({ serviceId, date });
    expect(slots.body.data.slots.length).toBeGreaterThan(0);
  });

  it('reactivating a cancelled staff subscription makes them bookable again', async () => {
    const { auth, serviceId, staffId } = await setup();
    await request(app).patch(`/api/v1/staff/admin/${staffId}/subscription`).set(auth).send({ subscriptionStatus: 'cancelled' });
    await request(app).patch(`/api/v1/staff/admin/${staffId}/subscription`).set(auth).send({ subscriptionStatus: 'active' });

    const date = tomorrowDateStr();
    const slots = await request(app).get('/api/v1/bookings/available-slots').set('x-salon-slug', salonPayload.slug).query({ serviceId, date });
    expect(slots.body.data.slots.length).toBeGreaterThan(0);
  });
});
