export function normalizeAllowedDomain(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

export function isEmailAllowed(email: string, allowedDomain: string): boolean {
  const normalized = normalizeAllowedDomain(allowedDomain);
  if (!normalized) return true;
  return email.toLowerCase().endsWith(normalized);
}
