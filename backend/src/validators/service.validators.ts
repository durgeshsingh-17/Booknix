import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.enum(['men', 'women', 'unisex']).default('unisex'),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  price: z.coerce.number().min(0),
  description: z.string().max(2000).optional().default(''),
  isActive: z.coerce.boolean().optional().default(true),
});

export const updateServiceSchema = createServiceSchema.partial();

export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id'),
});
