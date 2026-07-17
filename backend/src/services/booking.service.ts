import mongoose, { Types } from 'mongoose';
import crypto from 'crypto';
import Booking, { BookingStatus } from '../models/Booking';
import BookingSlotLock from '../models/BookingSlotLock';
import Service from '../models/Service';
import Staff, { IStaff } from '../models/Staff';
import Salon, { ISalon, IWorkingHour } from '../models/Salon';
import { ApiError } from '../utils/ApiError';
import { bookableStaffQueryFilter } from '../utils/staffEligibility';
import { findOrCreateCustomer } from './customerAuth.service';
import {
  combineISTDateAndMinutes,
  floorToSlotGranularity,
  getISTDayKey,
  minutesToTimeStr,
  SLOT_GRANULARITY_MINUTES,
  timeStrToMinutes,
} from '../utils/timeSlots';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

interface CustomerInput {
  name: string;
  phone: string;
  email?: string;
}

function generatePublicToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function getWorkingHoursForDay(salon: ISalon, staff: IStaff | null, dayKey: string): { open: string; close: string; isClosed: boolean } {
  const source: IWorkingHour[] = (staff?.workingHours as IWorkingHour[] | null) ?? salon.workingHours;
  const day = source.find((wh) => wh.day === dayKey);
  if (!day) return { open: '00:00', close: '00:00', isClosed: true };
  return day;
}

async function getQualifiedStaff(salonId: Types.ObjectId, serviceId: string): Promise<IStaff[]> {
  // Two independent $or clauses (specialty match, bookable-subscription
  // check) can't share one object key, hence $and combining them.
  return Staff.find({
    salonId,
    $and: [{ $or: [{ specialties: { $size: 0 } }, { specialties: new Types.ObjectId(serviceId) }] }, bookableStaffQueryFilter()],
  });
}

async function loadService(salonId: Types.ObjectId, serviceId: string) {
  const service = await Service.findOne({ _id: serviceId, salonId, isActive: true });
  if (!service) throw ApiError.notFound('Service not found');
  return service;
}

async function getOccupiedRangesForStaff(
  salonId: Types.ObjectId,
  staffId: Types.ObjectId,
  dayStart: Date,
  dayEnd: Date,
): Promise<{ start: number; end: number }[]> {
  const bookings = await Booking.find({
    salonId,
    staffId,
    isCancelled: false,
    startTime: { $lt: dayEnd },
    endTime: { $gt: dayStart },
  }).select('startTime endTime');

  return bookings.map((b) => ({
    start: Math.floor((b.startTime.getTime() - dayStart.getTime()) / 60000),
    end: Math.ceil((b.endTime.getTime() - dayStart.getTime()) / 60000),
  }));
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

interface AvailabilityParams {
  salonId: Types.ObjectId;
  serviceId: string;
  date: string;
  staffId?: string | undefined;
}

export async function getAvailableSlots({ salonId, serviceId, date, staffId }: AvailabilityParams): Promise<string[]> {
  const salon = await Salon.findById(salonId);
  if (!salon) throw ApiError.notFound('Salon not found');

  const service = await loadService(salonId, serviceId);
  const duration = service.durationMinutes;

  const dayStart = combineISTDateAndMinutes(date, 0);
  const dayEnd = combineISTDateAndMinutes(date, 24 * 60);
  const dayKey = getISTDayKey(dayStart);

  const now = new Date();
  const isToday = dayStart <= now && now < dayEnd;
  const nowMinutes = isToday ? Math.ceil((now.getTime() - dayStart.getTime()) / 60000) : 0;

  let candidates: IStaff[];
  if (staffId) {
    // An explicitly-requested staff member still has to pass the same
    // bookable (active + subscribed) check as the "any available" path —
    // a lapsed barber shouldn't be selectable just by knowing their id.
    const staff = await Staff.findOne({ _id: staffId, salonId, ...bookableStaffQueryFilter() });
    if (!staff) throw ApiError.notFound('Staff member not found');
    candidates = [staff];
  } else {
    candidates = await getQualifiedStaff(salonId, serviceId);
  }

  // No staff configured/qualified for this service yet — nothing is bookable
  // (createBooking enforces the same rule, so this keeps the two in sync).
  if (candidates.length === 0) return [];

  const availableMinutes = new Set<number>();

  for (const staff of candidates) {
    const hours = getWorkingHoursForDay(salon, staff, dayKey);
    if (hours.isClosed) continue;

    const openMinutes = floorToSlotGranularity(timeStrToMinutes(hours.open));
    const closeMinutes = timeStrToMinutes(hours.close);
    const staffOccupied = await getOccupiedRangesForStaff(salonId, staff._id as unknown as Types.ObjectId, dayStart, dayEnd);

    for (let slotStart = openMinutes; slotStart + duration <= closeMinutes; slotStart += SLOT_GRANULARITY_MINUTES) {
      if (slotStart < nowMinutes) continue;
      const conflict = staffOccupied.some((range) => rangesOverlap(slotStart, slotStart + duration, range.start, range.end));
      if (!conflict) availableMinutes.add(slotStart);
    }
  }

  return Array.from(availableMinutes)
    .sort((a, b) => a - b)
    .map(minutesToTimeStr);
}

interface CreateBookingParams {
  salonId: Types.ObjectId;
  serviceId: string;
  staffId?: string;
  date: string;
  time: string;
  customer: CustomerInput;
  notes?: string;
  createdBy?: string | null;
  /** Set when the request carries a valid customer JWT — links the booking straight to that account instead of only find-or-create-by-phone. */
  authenticatedCustomerId?: string | null;
}

export async function createBooking(params: CreateBookingParams) {
  const salon = await Salon.findById(params.salonId);
  if (!salon) throw ApiError.notFound('Salon not found');

  const service = await loadService(params.salonId, params.serviceId);
  const duration = service.durationMinutes;

  const requestedMinutes = timeStrToMinutes(params.time);
  if (floorToSlotGranularity(requestedMinutes) !== requestedMinutes) {
    throw ApiError.badRequest(`Time must align to ${SLOT_GRANULARITY_MINUTES}-minute slots`);
  }

  const startTime = combineISTDateAndMinutes(params.date, requestedMinutes);
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  if (startTime.getTime() < Date.now()) {
    throw ApiError.badRequest('Cannot book a time in the past');
  }

  const dayKey = getISTDayKey(startTime);

  let candidates: IStaff[];
  if (params.staffId) {
    const staff = await Staff.findOne({ _id: params.staffId, salonId: params.salonId, ...bookableStaffQueryFilter() });
    if (!staff) throw ApiError.notFound('Staff member not found');
    candidates = [staff];
  } else {
    candidates = await getQualifiedStaff(params.salonId, params.serviceId);
    if (candidates.length === 0) {
      throw ApiError.badRequest('No staff available for this service — ask the salon to add staff first');
    }
  }

  const withinHours = candidates.filter((staff) => {
    const hours = getWorkingHoursForDay(salon, staff, dayKey);
    if (hours.isClosed) return false;
    const openMinutes = timeStrToMinutes(hours.open);
    const closeMinutes = timeStrToMinutes(hours.close);
    return requestedMinutes >= openMinutes && requestedMinutes + duration <= closeMinutes;
  });

  if (withinHours.length === 0) {
    throw ApiError.badRequest('Requested time is outside working hours for this salon/staff');
  }

  // Every booking is linked to a CRM Customer profile, guest or logged-in —
  // find-or-create by phone keeps the profile's name/email fresh either way.
  // If the request carries an authenticated customer JWT, that identity wins
  // over whatever phone number was typed into the form (handles the edge
  // case of someone booking with a different contact number than their
  // account's registered one).
  const customerRecord = await findOrCreateCustomer(params.salonId, params.customer.name, params.customer.phone, params.customer.email);
  const customerId = params.authenticatedCustomerId ?? String(customerRecord._id);

  for (const staff of withinHours) {
    const booking = await attemptBookingForStaff({
      salonId: params.salonId,
      staffId: staff._id as unknown as Types.ObjectId,
      serviceId: service._id as unknown as Types.ObjectId,
      startTime,
      endTime,
      customer: params.customer,
      customerId: new Types.ObjectId(customerId),
      notes: params.notes ?? '',
      createdBy: params.createdBy ?? null,
    });
    if (booking) return booking;
  }

  throw ApiError.conflict('This slot was just booked by someone else — please pick another time');
}

async function attemptBookingForStaff(input: {
  salonId: Types.ObjectId;
  staffId: Types.ObjectId;
  serviceId: Types.ObjectId;
  startTime: Date;
  endTime: Date;
  customer: CustomerInput;
  customerId: Types.ObjectId;
  notes: string;
  createdBy: string | null;
}) {
  const session = await mongoose.startSession();
  try {
    let created: InstanceType<typeof Booking> | null = null;
    await session.withTransaction(async () => {
      const createdBookings = await Booking.create(
        [
          {
            salonId: input.salonId,
            serviceId: input.serviceId,
            staffId: input.staffId,
            customer: input.customer,
            customerId: input.customerId,
            publicToken: generatePublicToken(),
            startTime: input.startTime,
            endTime: input.endTime,
            status: 'confirmed',
            notes: input.notes,
            createdBy: input.createdBy,
          },
        ],
        { session },
      );
      const booking = createdBookings[0];
      if (!booking) throw ApiError.internal('Failed to create booking');

      const slotDocs = [];
      for (let t = 0; input.startTime.getTime() + t * 60000 < input.endTime.getTime(); t += SLOT_GRANULARITY_MINUTES) {
        slotDocs.push({
          salonId: input.salonId,
          staffId: input.staffId,
          slotStart: new Date(input.startTime.getTime() + t * 60000),
          bookingId: booking._id,
        });
      }
      await BookingSlotLock.insertMany(slotDocs, { session, ordered: true });

      created = booking;
    });
    return created;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return null; // slot taken by a concurrent request — caller tries the next staff candidate
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === MONGO_DUPLICATE_KEY_ERROR;
}

/** Guest access to a single booking (no login) via its unguessable publicToken — e.g. a bookmarked confirmation/pay link. */
export async function findBookingByLookup(salonId: Types.ObjectId, bookingId: string, token: string) {
  const booking = await Booking.findOne({ _id: bookingId, salonId, publicToken: token })
    .populate('serviceId', 'name durationMinutes price')
    .populate('staffId', 'name');
  if (!booking) throw ApiError.notFound('Booking not found');
  return booking;
}

export async function cancelBooking(salonId: Types.ObjectId, bookingId: string) {
  const session = await mongoose.startSession();
  try {
    let result: InstanceType<typeof Booking> | null = null;
    await session.withTransaction(async () => {
      const booking = await Booking.findOne({ _id: bookingId, salonId }).session(session);
      if (!booking) throw ApiError.notFound('Booking not found');
      if (booking.status === 'cancelled') throw ApiError.badRequest('Booking is already cancelled');

      booking.status = 'cancelled';
      booking.isCancelled = true;
      await booking.save({ session });
      await BookingSlotLock.deleteMany({ bookingId: booking._id }, { session });
      result = booking;
    });
    // Populated outside the transaction (population is a read concern, no need to
    // hold it inside the write transaction) — matches listBookings' shape so the
    // admin UI's service/staff names don't disappear after a status change.
    // (Non-null assertion: TS can't track the reassignment of `result` through the
    // withTransaction closure above, so it narrows `result` to `null` here despite
    // the truthiness check just passing.)
    if (result) {
      return Booking.findById((result as InstanceType<typeof Booking>)._id)
        .populate('serviceId', 'name durationMinutes price')
        .populate('staffId', 'name');
    }
    return result;
  } finally {
    await session.endSession();
  }
}

export async function updateBookingStatus(salonId: Types.ObjectId, bookingId: string, status: BookingStatus) {
  if (status === 'cancelled') {
    return cancelBooking(salonId, bookingId);
  }
  const booking = await Booking.findOneAndUpdate({ _id: bookingId, salonId }, { status }, { new: true })
    .populate('serviceId', 'name durationMinutes price')
    .populate('staffId', 'name');
  if (!booking) throw ApiError.notFound('Booking not found');
  return booking;
}

interface ListBookingsParams {
  salonId: Types.ObjectId;
  from?: string | undefined;
  to?: string | undefined;
  status?: BookingStatus | undefined;
  staffId?: string | undefined;
  page: number;
  limit: number;
}

export async function listBookings(params: ListBookingsParams) {
  const filter: Record<string, unknown> = { salonId: params.salonId };
  if (params.status) filter.status = params.status;
  if (params.staffId) filter.staffId = params.staffId;
  if (params.from || params.to) {
    const range: Record<string, Date> = {};
    if (params.from) range.$gte = combineISTDateAndMinutes(params.from, 0);
    if (params.to) range.$lt = combineISTDateAndMinutes(params.to, 24 * 60);
    filter.startTime = range;
  }

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    Booking.find(filter).sort({ startTime: 1 }).skip(skip).limit(params.limit).populate('serviceId', 'name durationMinutes price').populate('staffId', 'name'),
    Booking.countDocuments(filter),
  ]);

  return { items, total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) || 1 };
}
