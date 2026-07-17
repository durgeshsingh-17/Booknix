import mongoose, { Schema, Document, Types } from 'mongoose';
import { ROLES, Role } from '../types/roles';

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: Role;
  salonId: Types.ObjectId | null;
  isActive: boolean;
  refreshTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true, default: ROLES.CUSTOMER },
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', default: null },
    isActive: { type: Boolean, default: true },
    refreshTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true },
);

UserSchema.index({ salonId: 1, role: 1 });

export default mongoose.model<IUser>('User', UserSchema);
