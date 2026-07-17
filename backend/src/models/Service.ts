import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IService extends Document {
  salonId: Types.ObjectId;
  name: string;
  category: 'men' | 'women' | 'unisex';
  durationMinutes: number;
  price: number;
  description: string;
  image: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ['men', 'women', 'unisex'], required: true, default: 'unisex' },
    durationMinutes: { type: Number, required: true, min: 5, max: 600 },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ServiceSchema.index({ salonId: 1, isActive: 1 });

export default mongoose.model<IService>('Service', ServiceSchema);
