import { getStripeClient } from '../../config/stripe';
import { env } from '../../config/env';
import { PaymentProvider, CreateOrderInput, CreateOrderResult } from './provider';

export const stripeProvider: PaymentProvider = {
  name: 'stripe',
  async createOrder({ amount, currency, receipt }: CreateOrderInput): Promise<CreateOrderResult> {
    const paymentIntent = await getStripeClient().paymentIntents.create({
      amount: Math.round(amount * 100), // smallest currency unit
      currency: currency.toLowerCase(),
      metadata: { receipt },
      // Stripe's dashboard now enables this by default for new accounts and
      // expects it explicitly from the API for anything other than plain
      // card payments (UPI, wallets, etc.) to be offered automatically.
      automatic_payment_methods: { enabled: true },
    });
    return {
      providerOrderId: paymentIntent.id,
      clientPayload: {
        publishableKey: env.STRIPE_PUBLISHABLE_KEY,
        clientSecret: paymentIntent.client_secret,
      },
    };
  },
};
