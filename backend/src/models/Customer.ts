import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICustomer extends Document {
  salonId: Types.ObjectId;
  name: string;
  phone: string;
  email: string;
  isVerified: boolean;
  otpHash: string | null;
  otpExpiresAt: Date | null;
  otpAttempts: number;
  otpLastSentAt: Date | null;
  refreshTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true },
    // True once this phone number has completed OTP verification at least
    // once — a booking alone (guest checkout) creates/updates this record
    // but does not verify it, so a stranger can't "log in" just by knowing
    // someone else's phone number without ever proving they control it.
    isVerified: { type: Boolean, default: false },
    otpHash: { type: String, default: null, select: false },
    otpExpiresAt: { type: Date, default: null, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    otpLastSentAt: { type: Date, default: null, select: false },
    refreshTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true },
);

// One customer profile per phone number per salon — the same phone booking
// at two different salons on the platform gets two separate CRM records,
// consistent with the rest of the app's tenant-isolated data model.
CustomerSchema.index({ salonId: 1, phone: 1 }, { unique: true });

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
