import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * One document per 15-minute slot a confirmed booking occupies for a given
 * staff member. The unique index is the actual atomicity guarantee against
 * double-booking: inserting all of a booking's slot-locks in one transaction
 * means a concurrent overlapping booking's insertMany fails on the first
 * colliding slot and the whole transaction (including the Booking document)
 * rolls back. This is what makes overlap prevention correct for
 * variable-duration services, not just exact-start-time collisions.
 */
export interface IBookingSlotLock extends Document {
  salonId: Types.ObjectId;
  staffId: Types.ObjectId;
  slotStart: Date;
  bookingId: Types.ObjectId;
}

const BookingSlotLockSchema = new Schema<IBookingSlotLock>({
  salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
  staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  slotStart: { type: Date, required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
});

BookingSlotLockSchema.index({ salonId: 1, staffId: 1, slotStart: 1 }, { unique: true });
BookingSlotLockSchema.index({ bookingId: 1 });

export default mongoose.model<IBookingSlotLock>('BookingSlotLock', BookingSlotLockSchema);
