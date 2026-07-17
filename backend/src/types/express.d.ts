import { ISalon } from '../models/Salon';
import { Role } from './roles';

export interface AuthUser {
  id: string;
  role: Role;
  salonId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: ISalon;
      authUser?: AuthUser;
    }
  }
}

export {};
