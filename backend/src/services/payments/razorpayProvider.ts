import { getRazorpayClient } from '../../config/razorpay';
import { env } from '../../config/env';
import { PaymentProvider, CreateOrderInput, CreateOrderResult } from './provider';

export const razorpayProvider: PaymentProvider = {
  name: 'razorpay',
  async createOrder({ amount, currency, receipt }: CreateOrderInput): Promise<CreateOrderResult> {
    const order = await getRazorpayClient().orders.create({
      amount: Math.round(amount * 100), // paise
      currency,
      receipt,
    });
    return {
      providerOrderId: String(order.id),
      clientPayload: {
        keyId: env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      },
    };
  },
};
