import { z } from 'zod';

export const createGallerySchema = z.object({
  caption: z.string().max(200).optional().default(''),
  category: z.string().max(60).optional().default('general'),
  order: z.coerce.number().int().optional().default(0),
});

export const updateGallerySchema = createGallerySchema.partial();
