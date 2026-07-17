import Razorpay from 'razorpay';
import { env } from './env';
import { ApiError } from '../utils/ApiError';

let client: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    // A controlled, client-safe error (rather than a generic thrown Error)
    // so this surfaces as a clean 503 even in production, not a bare 500
    // whose message the error middleware would otherwise have to redact.
    throw new ApiError(503, 'Online payment is not available for this salon right now — please pay at the salon.');
  }
  if (!client) {
    client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return client;
}
