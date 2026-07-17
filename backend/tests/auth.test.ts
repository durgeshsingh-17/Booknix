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

describe('Auth flow', () => {
  it('registers a new salon + owner and returns tokens', async () => {
    const res = await request(app).post('/api/v1/auth/register-salon').send(salonPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe('salonAdmin');
    expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=/);
  });

  it('rejects duplicate slug', async () => {
    await request(app).post('/api/v1/auth/register-salon').send(salonPayload);
    const res = await request(app)
      .post('/api/v1/auth/register-salon')
      .send({ ...salonPayload, subdomain: 'glow2', email: 'other@glowsalon.test' });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong password', async () => {
    await request(app).post('/api/v1/auth/register-salon').send(salonPayload);

    const good = await request(app).post('/api/v1/auth/login').send({ email: salonPayload.email, password: salonPayload.password });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toBeDefined();

    const bad = await request(app).post('/api/v1/auth/login').send({ email: salonPayload.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  it('rejects /me without a token and accepts it with one', async () => {
    await request(app).post('/api/v1/auth/register-salon').send(salonPayload);

    const noToken = await request(app).get('/api/v1/auth/me');
    expect(noToken.status).toBe(401);

    const login = await request(app).post('/api/v1/auth/login').send({ email: salonPayload.email, password: salonPayload.password });
    const withToken = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(withToken.status).toBe(200);
    expect(withToken.body.data.role).toBe('salonAdmin');
  });

  it('refreshes tokens using the refresh cookie', async () => {
    await request(app).post('/api/v1/auth/register-salon').send(salonPayload);

    const login = await request(app).post('/api/v1/auth/login').send({ email: salonPayload.email, password: salonPayload.password });
    const cookie = login.headers['set-cookie']?.[0];
    expect(cookie).toBeDefined();

    const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie as string).send({});
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toBeDefined();
  });
});
