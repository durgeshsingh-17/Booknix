import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import Salon from '../models/Salon';
import { ApiError } from '../utils/ApiError';

export const getPublicSalonProfile = asyncHandler(async (req: Request, res: Response) => {
  const salon = req.tenant!;
  res.json({
    success: true,
    data: {
      id: salon._id,
      name: salon.name,
      slug: salon.slug,
      address: salon.address,
      geo: salon.geo,
      googleMapsEmbedUrl: salon.googleMapsEmbedUrl,
      phone: salon.phone,
      email: salon.email,
      workingHours: salon.workingHours,
      theme: salon.theme,
    },
  });
});

export const getAdminSalonProfile = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: req.tenant });
});

export const updateSalonProfile = asyncHandler(async (req: Request, res: Response) => {
  const salon = await Salon.findByIdAndUpdate(req.tenant!._id, req.body, { new: true });
  if (!salon) throw ApiError.notFound('Salon not found');
  res.json({ success: true, data: salon });
});
