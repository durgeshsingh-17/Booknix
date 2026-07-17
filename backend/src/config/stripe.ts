import Stripe from 'stripe';
import { env } from './env';
import { ApiError } from '../utils/ApiError';

let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, 'Online payment is not available for this salon right now — please pay at the salon.');
  }
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return client;
}
