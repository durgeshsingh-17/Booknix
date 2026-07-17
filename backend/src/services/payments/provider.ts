export interface CreateOrderInput {
  amount: number; // in rupees (major currency unit)
  currency: string;
  receipt: string;
}

export interface CreateOrderResult {
  providerOrderId: string;
  clientPayload: Record<string, unknown>;
}

export interface PaymentProvider {
  name: 'razorpay' | 'stripe';
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
}
