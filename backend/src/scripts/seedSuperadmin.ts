/**
 * One-time bootstrap: creates (or updates the password of) the platform
 * superadmin account from SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD in .env.
 * Run with: npm run seed:superadmin
 */
import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import User from '../models/User';
import { ROLES } from '../types/roles';
import { hashValue } from '../utils/password';

async function main() {
  if (!env.SUPERADMIN_EMAIL || !env.SUPERADMIN_PASSWORD) {
    throw new Error('Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env before running this script');
  }

  await connectDB();

  const passwordHash = await hashValue(env.SUPERADMIN_PASSWORD);
  const existing = await User.findOne({ email: env.SUPERADMIN_EMAIL.toLowerCase() });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = ROLES.SUPERADMIN;
    existing.isActive = true;
    await existing.save();
    logger.info(`Updated existing superadmin account: ${env.SUPERADMIN_EMAIL}`);
  } else {
    await User.create({
      name: 'Platform Superadmin',
      email: env.SUPERADMIN_EMAIL.toLowerCase(),
      passwordHash,
      role: ROLES.SUPERADMIN,
      salonId: null,
    });
    logger.info(`Created superadmin account: ${env.SUPERADMIN_EMAIL}`);
  }

  await disconnectDB();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to seed superadmin:', error);
  process.exit(1);
});
