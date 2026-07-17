import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Service from '../models/Service';

export const listPublicServices = asyncHandler(async (req: Request, res: Response) => {
  const services = await Service.find({ salonId: req.tenant!._id, isActive: true }).sort({ category: 1, name: 1 });
  res.json({ success: true, data: services });
});

export const listAdminServices = asyncHandler(async (req: Request, res: Response) => {
  const services = await Service.find({ salonId: req.tenant!._id }).sort({ category: 1, name: 1 });
  res.json({ success: true, data: services });
});

export const createService = asyncHandler(async (req: Request, res: Response) => {
  const service = await Service.create({ ...req.body, salonId: req.tenant!._id });
  res.status(201).json({ success: true, data: service });
});

export const updateService = asyncHandler(async (req: Request, res: Response) => {
  const service = await Service.findOneAndUpdate({ _id: req.params.id, salonId: req.tenant!._id }, req.body, { new: true });
  if (!service) throw ApiError.notFound('Service not found');
  res.json({ success: true, data: service });
});

export const deleteService = asyncHandler(async (req: Request, res: Response) => {
  const service = await Service.findOneAndDelete({ _id: req.params.id, salonId: req.tenant!._id });
  if (!service) throw ApiError.notFound('Service not found');
  res.json({ success: true, data: null });
});
