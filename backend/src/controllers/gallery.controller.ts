import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import GalleryImage from '../models/Gallery';

export const listPublicGallery = asyncHandler(async (req: Request, res: Response) => {
  const images = await GalleryImage.find({ salonId: req.tenant!._id }).sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: images });
});

export const listAdminGallery = asyncHandler(async (req: Request, res: Response) => {
  const images = await GalleryImage.find({ salonId: req.tenant!._id }).sort({ order: 1, createdAt: -1 });
  res.json({ success: true, data: images });
});

export const uploadGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('An image file is required');
  const imageUrl = `/uploads/${req.file.filename}`;
  const image = await GalleryImage.create({ ...req.body, salonId: req.tenant!._id, imageUrl });
  res.status(201).json({ success: true, data: image });
});

export const updateGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const image = await GalleryImage.findOneAndUpdate({ _id: req.params.id, salonId: req.tenant!._id }, req.body, { new: true });
  if (!image) throw ApiError.notFound('Image not found');
  res.json({ success: true, data: image });
});

export const deleteGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const image = await GalleryImage.findOneAndDelete({ _id: req.params.id, salonId: req.tenant!._id });
  if (!image) throw ApiError.notFound('Image not found');
  res.json({ success: true, data: null });
});
