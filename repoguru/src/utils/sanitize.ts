const DANGEROUS_PATTERNS = [/<script\b[^>]*>/gi, /on\w+\s*=/gi, /javascript:/gi];

export function sanitizeText(input: string): string {
  let safe = input;
  for (const pattern of DANGEROUS_PATTERNS) {
    safe = safe.replace(pattern, '');
  }
  return safe;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
