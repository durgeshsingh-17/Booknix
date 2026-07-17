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

async function setupSalonWithServiceAndStaff() {
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

  return { accessToken, serviceId: serviceRes.body.data._id as string, staffId: staffRes.body.data._id as string };
}

function tomorrowDateStr(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  const parts = d.toISOString().split('T');
  return parts[0] as string;
}

describe('Booking flow', () => {
  it('lists available slots and lets a customer book one', async () => {
    const { serviceId, staffId } = await setupSalonWithServiceAndStaff();
    const date = tomorrowDateStr();

    const slotsRes = await request(app)
      .get('/api/v1/bookings/available-slots')
      .set('x-salon-slug', salonPayload.slug)
      .query({ serviceId, date });
    expect(slotsRes.status).toBe(200);
    expect(Array.isArray(slotsRes.body.data.slots)).toBe(true);
    expect(slotsRes.body.data.slots.length).toBeGreaterThan(0);

    const time = slotsRes.body.data.slots[0];
    const bookRes = await request(app)
      .post('/api/v1/bookings')
      .set('x-salon-slug', salonPayload.slug)
      .send({ serviceId, staffId, date, time, customer: { name: 'Anita', phone: '9999999999' } });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body.data.status).toBe('confirmed');
  });

  it('prevents double-booking the same staff+slot under concurrent requests', async () => {
    const { serviceId, staffId } = await setupSalonWithServiceAndStaff();
    const date = tomorrowDateStr();

    const slotsRes = await request(app)
      .get('/api/v1/bookings/available-slots')
      .set('x-salon-slug', salonPayload.slug)
      .query({ serviceId, date });
    const time = slotsRes.body.data.slots[0];

    const attempt = () =>
      request(app)
        .post('/api/v1/bookings')
        .set('x-salon-slug', salonPayload.slug)
        .send({ serviceId, staffId, date, time, customer: { name: 'Racer', phone: '8888888888' } });

    const results = await Promise.all([attempt(), attempt(), attempt(), attempt(), attempt()]);
    const succeeded = results.filter((r) => r.status === 201);
    const conflicted = results.filter((r) => r.status === 409);

    expect(succeeded.length).toBe(1);
    expect(conflicted.length).toBe(4);
  });

  it('rejects booking a slot outside working hours and in the past', async () => {
    const { serviceId, staffId } = await setupSalonWithServiceAndStaff();
    const date = tomorrowDateStr();

    const outsideHours = await request(app)
      .post('/api/v1/bookings')
      .set('x-salon-slug', salonPayload.slug)
      .send({ serviceId, staffId, date, time: '23:45', customer: { name: 'Night Owl', phone: '7777777777' } });
    expect(outsideHours.status).toBe(400);

    const past = await request(app)
      .post('/api/v1/bookings')
      .set('x-salon-slug', salonPayload.slug)
      .send({ serviceId, staffId, date: '2020-01-01', time: '10:00', customer: { name: 'Time Traveler', phone: '6666666666' } });
    expect(past.status).toBe(400);
  });

  it('frees the slot again after cancellation', async () => {
    const { serviceId, staffId } = await setupSalonWithServiceAndStaff();
    const accessToken = (
      await request(app).post('/api/v1/auth/login').send({ email: salonPayload.email, password: salonPayload.password })
    ).body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${accessToken}`, 'x-salon-slug': salonPayload.slug };
    const date = tomorrowDateStr();

    const slotsRes = await request(app).get('/api/v1/bookings/available-slots').set('x-salon-slug', salonPayload.slug).query({ serviceId, date });
    const time = slotsRes.body.data.slots[0];

    const booked = await request(app)
      .post('/api/v1/bookings')
      .set('x-salon-slug', salonPayload.slug)
      .send({ serviceId, staffId, date, time, customer: { name: 'Anita', phone: '9999999999' } });
    const bookingId = booked.body.data._id as string;

    const cancel = await request(app).delete(`/api/v1/bookings/admin/${bookingId}`).set(auth);
    expect(cancel.status).toBe(200);
    // Regression check: the admin UI renders service/staff names straight off
    // this response, so it must come back populated, not as bare ObjectIds.
    expect(cancel.body.data.serviceId).toMatchObject({ name: 'Haircut' });
    expect(cancel.body.data.staffId).toMatchObject({ name: 'Ravi' });

    const rebooked = await request(app)
      .post('/api/v1/bookings')
      .set('x-salon-slug', salonPayload.slug)
      .send({ serviceId, staffId, date, time, customer: { name: 'Someone Else', phone: '6555555555' } });
    expect(rebooked.status).toBe(201);
  });

  it('keeps service/staff populated after an admin status change', async () => {
    const { serviceId, staffId } = await setupSalonWithServiceAndStaff();
    const accessToken = (
      await request(app).post('/api/v1/auth/login').send({ email: salonPayload.email, password: salonPayload.password })
    ).body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${accessToken}`, 'x-salon-slug': salonPayload.slug };
    const date = tomorrowDateStr();

    const slotsRes = await request(app).get('/api/v1/bookings/available-slots').set('x-salon-slug', salonPayload.slug).query({ serviceId, date });
    const time = slotsRes.body.data.slots[0];

    const booked = await request(app)
      .post('/api/v1/bookings')
      .set('x-salon-slug', salonPayload.slug)
      .send({ serviceId, staffId, date, time, customer: { name: 'Anita', phone: '9999999999' } });
    const bookingId = booked.body.data._id as string;

    const updated = await request(app).patch(`/api/v1/bookings/admin/${bookingId}/status`).set(auth).send({ status: 'completed' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.status).toBe('completed');
    expect(updated.body.data.serviceId).toMatchObject({ name: 'Haircut' });
    expect(updated.body.data.staffId).toMatchObject({ name: 'Ravi' });
  });
});
