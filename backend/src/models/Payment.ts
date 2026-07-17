import mongoose, { Schema, Document, Types } from 'mongoose';

export type PaymentProviderName = 'razorpay' | 'stripe';
export type PaymentDocStatus = 'created' | 'paid' | 'failed' | 'refunded';

export interface IPayment extends Document {
  salonId: Types.ObjectId;
  bookingId: Types.ObjectId;
  provider: PaymentProviderName;
  providerOrderId: string;
  providerPaymentId: string;
  amount: number;
  currency: string;
  status: PaymentDocStatus;
  rawWebhookPayload: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    provider: { type: String, enum: ['razorpay', 'stripe'], required: true },
    providerOrderId: { type: String, required: true, index: true },
    providerPaymentId: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
    rawWebhookPayload: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

export default mongoose.model<IPayment>('Payment', PaymentSchema);
