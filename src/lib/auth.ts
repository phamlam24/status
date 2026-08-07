import type { AstroCookies } from 'astro';
import { verifyAccessToken } from './verifyAccessToken';

export async function isLoggedIn(request: Request, cookies: AstroCookies): Promise<boolean> {
  const url = new URL(request.url);
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (isLocalhost) return true;

  return verifyAccessToken(cookies.get('access_token')?.value);
}
