import request from 'supertest';
import { createApp } from '../src/app';
import User from '../src/models/User';
import { ROLES } from '../src/types/roles';
import { hashValue } from '../src/utils/password';
import { signAccessToken } from '../src/utils/jwt';

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

async function createSuperadminToken(): Promise<string> {
  const passwordHash = await hashValue('SuperSecret123');
  const superadmin = await User.create({
    name: 'Platform Superadmin',
    email: 'superadmin@platform.test',
    passwordHash,
    role: ROLES.SUPERADMIN,
    salonId: null,
  });
  return signAccessToken({ id: String(superadmin._id), role: ROLES.SUPERADMIN, salonId: null });
}

describe('Platform admin routes', () => {
  it('lets a superadmin list salons across tenants', async () => {
    await request(app).post('/api/v1/auth/register-salon').send(salonPayload);
    const token = await createSuperadminToken();

    const res = await request(app).get('/api/v1/platform/salons').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items.some((s: { slug: string }) => s.slug === 'glow-salon')).toBe(true);
  });

  it('lets a superadmin suspend and reactivate a salon', async () => {
    const register = await request(app).post('/api/v1/auth/register-salon').send(salonPayload);
    const salonId = register.body.data.salon.id as string;
    const token = await createSuperadminToken();

    const suspend = await request(app)
      .patch(`/api/v1/platform/salons/${salonId}/active`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(suspend.status).toBe(200);
    expect(suspend.body.data.isActive).toBe(false);

    const reactivate = await request(app)
      .patch(`/api/v1/platform/salons/${salonId}/active`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.data.isActive).toBe(true);
  });

  it('rejects a non-superadmin trying to access platform routes', async () => {
    const register = await request(app).post('/api/v1/auth/register-salon').send(salonPayload);
    const accessToken = register.body.data.accessToken as string;

    const res = await request(app).get('/api/v1/platform/salons').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });
});
