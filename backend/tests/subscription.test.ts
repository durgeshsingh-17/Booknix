import request from 'supertest';
import { createApp } from '../src/app';
import Salon from '../src/models/Salon';

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

async function registerSalon() {
  const register = await request(app).post('/api/v1/auth/register-salon').send(salonPayload);
  const accessToken = register.body.data.accessToken as string;
  const salonId = register.body.data.salon.id as string;
  return { accessToken, salonId, auth: { Authorization: `Bearer ${accessToken}`, 'x-salon-slug': salonPayload.slug } };
}

describe('Subscription gating', () => {
  it('allows content creation for a brand-new salon (defaults to active)', async () => {
    const { auth } = await registerSalon();
    const res = await request(app).post('/api/v1/services/admin').set(auth).send({ name: 'Haircut', category: 'unisex', durationMinutes: 30, price: 300 });
    expect(res.status).toBe(201);
  });

  it('blocks creating services/staff/gallery once a subscription is cancelled, but not bookings or settings', async () => {
    const { auth, salonId } = await registerSalon();

    const serviceRes = await request(app)
      .post('/api/v1/services/admin')
      .set(auth)
      .send({ name: 'Haircut', category: 'unisex', durationMinutes: 30, price: 300 });
    expect(serviceRes.status).toBe(201);

    await Salon.findByIdAndUpdate(salonId, { subscriptionStatus: 'cancelled' });

    const blockedService = await request(app)
      .post('/api/v1/services/admin')
      .set(auth)
      .send({ name: 'Shave', category: 'men', durationMinutes: 15, price: 100 });
    expect(blockedService.status).toBe(402);

    const blockedStaff = await request(app).post('/api/v1/staff/admin').set(auth).send({ name: 'Ravi' });
    expect(blockedStaff.status).toBe(402);

    // Settings updates (account management) must still work — a lapsed
    // subscription shouldn't also lock someone out of fixing their billing
    // details or contact info.
    const settingsUpdate = await request(app).put('/api/v1/salon/admin').set(auth).send({ name: 'Glow Salon Updated' });
    expect(settingsUpdate.status).toBe(200);

    // Existing bookings management must still work too — blocking revenue
    // operations on top of a lapsed subscription would be self-defeating.
    const bookingsList = await request(app).get('/api/v1/bookings/admin').set(auth);
    expect(bookingsList.status).toBe(200);
  });
});
