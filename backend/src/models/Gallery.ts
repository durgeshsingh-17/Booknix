import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IGalleryImage extends Document {
  salonId: Types.ObjectId;
  imageUrl: string;
  caption: string;
  category: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const GalleryImageSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true, index: true },
    imageUrl: { type: String, required: true },
    caption: { type: String, default: '' },
    category: { type: String, default: 'general', trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

GalleryImageSchema.index({ salonId: 1, order: 1 });

export default mongoose.model<IGalleryImage>('GalleryImage', GalleryImageSchema);
