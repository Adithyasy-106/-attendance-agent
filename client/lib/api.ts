/**
 * Backend origin for fetch calls. Override in `.env.local`:
 * `NEXT_PUBLIC_API_URL=http://127.0.0.1:5000`
 */
export function getApiBase(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  return 'http://localhost:5000';
}
