import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-please-ignore-1234567890';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-please-ignore-1234567890';
// Placeholder so env.ts's zod parse succeeds at import time; the real in-memory
// replica-set URI is connected to directly in beforeAll below (not via connectDB()).
process.env.MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/salon-saas-test-placeholder';
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? 'test-razorpay-webhook-secret';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_secret';

let replSet: MongoMemoryReplSet;

// Transactions (used by booking/auth services) require a replica set, so tests
// spin up an in-memory 1-node replica set rather than a standalone mongod.
beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
}, 60000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});
