import mongoose, { Schema, Document, Types } from 'mongoose';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid' | 'failed' | 'refunded';

export interface IBooking extends Document {
  salonId: Types.ObjectId;
  serviceId: Types.ObjectId;
  staffId: Types.ObjectId | null;
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  /** The CRM-style Customer profile this booking belongs to — set on every
   * booking (guest or logged-in) via find-or-create-by-phone, so every
   * booking is always linked to a customer record, not just an inline snapshot. */
  customerId: Types.ObjectId | null;
  customerUserId: Types.ObjectId | null;
  /** Opaque unguessable token letting a guest (no login) view/pay for this
   * one booking via a bookmarked link, without exposing it by a guessable id. */
  publicToken: string;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  isCancelled: boolean;
  paymentStatus: PaymentStatus;
  paymentId: Types.ObjectId | null;
  notes: string;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', default: null },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, default: '', trim: true },
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    customerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    publicToken: { type: String, required: true, unique: true },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'], default: 'confirmed' },
    isCancelled: { type: Boolean, default: false },
    paymentStatus: { type: String, enum: ['unpaid', 'deposit_paid', 'paid', 'failed', 'refunded'], default: 'unpaid' },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// The true double-booking guarantee lives in BookingSlotLock's unique index
// (one lock document per 15-min slot a booking occupies); these indexes are
// for query performance only.
BookingSchema.index({ salonId: 1, staffId: 1, startTime: 1 });
BookingSchema.index({ salonId: 1, startTime: 1 });
BookingSchema.index({ salonId: 1, customerId: 1, startTime: -1 });

export default mongoose.model<IBooking>('Booking', BookingSchema);
