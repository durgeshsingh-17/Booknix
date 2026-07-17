import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as platformService from '../services/platform.service';

export const listSalons = asyncHandler(async (req: Request, res: Response) => {
  const { search, page, limit } = req.query as unknown as { search?: string; page: number; limit: number };
  const result = await platformService.listSalons({ search, page, limit });
  res.json({ success: true, data: result });
});

export const getSalon = asyncHandler(async (req: Request, res: Response) => {
  const result = await platformService.getSalonDetail(req.params.id as string);
  res.json({ success: true, data: result });
});

export const setSalonActive = asyncHandler(async (req: Request, res: Response) => {
  const salon = await platformService.setSalonActive(req.params.id as string, req.body.isActive);
  res.json({ success: true, data: salon });
});

export const setSubscriptionStatus = asyncHandler(async (req: Request, res: Response) => {
  const salon = await platformService.setSubscriptionStatus(req.params.id as string, req.body.subscriptionStatus);
  res.json({ success: true, data: salon });
});

export const verifyDomainForTls = asyncHandler(async (req: Request, res: Response) => {
  const domain = String(req.query.domain ?? '');
  const allowed = domain ? await platformService.isDomainAllowedForTls(domain) : false;
  // Caddy's on_demand_tls ask endpoint only cares about the status code —
  // 200 to proceed with issuing a certificate, anything else to refuse.
  res.status(allowed ? 200 : 403).end();
});
