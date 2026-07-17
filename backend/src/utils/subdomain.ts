import { env } from '../config/env';

const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'api']);

/** Extracts the tenant subdomain from a Host header, e.g. "shreesalon.yoursaas.in" -> "shreesalon". Returns null for the apex domain, reserved subdomains, or a non-matching host. */
export function resolveSubdomain(host: string | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0];
  if (!hostname || !hostname.endsWith(env.ROOT_DOMAIN)) return null;
  const subdomain = hostname.slice(0, hostname.length - env.ROOT_DOMAIN.length);
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return null;
  return subdomain;
}
