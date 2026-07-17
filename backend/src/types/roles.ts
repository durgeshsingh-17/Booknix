export const ROLES = {
  SUPERADMIN: 'superadmin',
  SALON_ADMIN: 'salonAdmin',
  STAFF: 'staff',
  CUSTOMER: 'customer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
