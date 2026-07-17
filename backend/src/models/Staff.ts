import mongoose, { Schema, Document, Types } from 'mongoose';

const WorkingHourSchema = new Schema(
  {
    day: { type: String, enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], required: true },
    open: { type: String, default: '09:00' },
    close: { type: String, default: '19:00' },
    isClosed: { type: Boolean, default: false },
  },
  { _id: false },
);

export type StaffPlan = 'trial' | 'basic' | 'pro';
export type StaffSubscriptionStatus = 'active' | 'past_due' | 'cancelled';

export interface IStaff extends Document {
  salonId: Types.ObjectId;
  userId: Types.ObjectId | null;
  name: string;
  avatar: string;
  specialties: Types.ObjectId[];
  workingHours: { day: string; open: string; close: string; isClosed: boolean }[] | null;
  isActive: boolean;
  /** Per-seat "barber subscription": each staff member has their own billing
   * status, independent of (and in addition to) the salon's own subscription
   * — only an active, non-expired subscriber can receive new bookings. */
  plan: StaffPlan;
  subscriptionStatus: StaffSubscriptionStatus;
  /** null = no expiry tracked (e.g. manually-managed "active" status) — only
   * enforced when set. */
  subscriptionExpiresAt: Date | null;
  razorpaySubscriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const StaffSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: '' },
    specialties: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
    // null = inherit the salon's default working hours; set to override per-staff.
    workingHours: { type: [WorkingHourSchema], default: null },
    isActive: { type: Boolean, default: true },
    plan: { type: String, enum: ['trial', 'basic', 'pro'], default: 'trial' },
    // Defaults to 'active' so every existing/new staff member stays bookable
    // until a subscription is explicitly cancelled or lapses — matches the
    // same "never breaks existing behavior by default" pattern as Salon's.
    subscriptionStatus: { type: String, enum: ['active', 'past_due', 'cancelled'], default: 'active' },
    subscriptionExpiresAt: { type: Date, default: null },
    razorpaySubscriptionId: { type: String, default: null, index: true },
  },
  { timestamps: true },
);

StaffSchema.index({ salonId: 1, isActive: 1 });

export default mongoose.model<IStaff>('Staff', StaffSchema);
