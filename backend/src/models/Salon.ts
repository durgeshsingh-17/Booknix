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

export interface IWorkingHour {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  open: string; // "HH:mm" 24-hour
  close: string; // "HH:mm" 24-hour
  isClosed: boolean;
}

export interface ISalon extends Document {
  name: string;
  slug: string;
  subdomain: string;
  ownerUserId: Types.ObjectId | null;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  geo: {
    lat: number | null;
    lng: number | null;
  };
  googleMapsEmbedUrl: string;
  phone: string;
  email: string;
  workingHours: IWorkingHour[];
  theme: {
    logoUrl: string;
    primaryColor: string;
    defaultMode: 'light' | 'dark' | 'system';
  };
  plan: 'trial' | 'basic' | 'pro';
  subscriptionStatus: 'active' | 'past_due' | 'cancelled';
  /** Razorpay subscription id (sub_xxx) once the salon has started a paid subscription — used to correlate incoming subscription webhooks back to this salon. */
  razorpaySubscriptionId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const SalonSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    subdomain: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
    },
    geo: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    googleMapsEmbedUrl: { type: String, default: '' },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    workingHours: {
      type: [WorkingHourSchema],
      default: () => DAYS.map((day) => ({ day, open: '09:00', close: '19:00', isClosed: false })),
    },
    theme: {
      logoUrl: { type: String, default: '' },
      primaryColor: { type: String, default: '#7B2D8E' },
      defaultMode: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    },
    plan: { type: String, enum: ['trial', 'basic', 'pro'], default: 'trial' },
    subscriptionStatus: { type: String, enum: ['active', 'past_due', 'cancelled'], default: 'active' },
    razorpaySubscriptionId: { type: String, default: null, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model<ISalon>('Salon', SalonSchema);
