// The ledger now lives at the site root; the old admin path hid cookies on reload.
export const CARD_FILTER_COOKIE_PATH = '/';
export const CARD_FILTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Only restore known fields with the same shape as their defaults.
export function restoreFilterValue<T>(saved: unknown, defaults: T): T {
  if (typeof defaults === 'string') return (typeof saved === 'string' ? saved : defaults) as T;
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) return defaults;
  const source = saved && typeof saved === 'object' && !Array.isArray(saved)
    ? saved as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [
    key, restoreFilterValue(source[key], value),
  ])) as T;
}

export function readFilterCookie<T>(cookies: string, name: string, defaults: T): T {
  const value = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!value) return defaults;
  try {
    return restoreFilterValue(JSON.parse(decodeURIComponent(value.slice(name.length + 1))), defaults);
  } catch {
    return defaults;
  }
}

export function createFilterCookie(name: string, value: unknown, secure: boolean): string | null {
  const encoded = encodeURIComponent(JSON.stringify(value));
  // Leave room for the name and attributes within the browser's 4 KB limit.
  if (name.length + encoded.length > 3800) return null;
  return `${name}=${encoded}; Path=${CARD_FILTER_COOKIE_PATH}; Max-Age=${CARD_FILTER_COOKIE_MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`;
}
