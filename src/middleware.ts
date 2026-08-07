import { defineMiddleware } from 'astro:middleware';
import { AUTH_ORIGIN } from './lib/authOrigin';
import { verifyAccessToken } from './lib/verifyAccessToken';

const COOKIE_DOMAIN = import.meta.env.COOKIE_DOMAIN ?? '.lampham.space';
// Browsers silently refuse to store `Secure` cookies over plain HTTP — set
// COOKIE_SECURE=false in .env for local dev over http://, leave unset in prod.
const COOKIE_SECURE = import.meta.env.COOKIE_SECURE !== 'false';

const ACCESS_TOKEN_MAX_AGE = 15 * 60;
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies } = context;
  const url = new URL(request.url);
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (isLocalhost) return next();

  const accessToken = cookies.get('access_token')?.value;
  if (await verifyAccessToken(accessToken)) return next();

  const refreshToken = cookies.get('refresh_token')?.value;
  if (!refreshToken) return next();

  // Access token expired/missing but a refresh token is present: hit the auth
  // service once to mint a new access token, so most requests never touch it.
  let refreshed: { accessToken: string; refreshToken: string } | null = null;
  try {
    const res = await fetch(`${AUTH_ORIGIN}/refresh`, {
      method: 'POST',
      headers: { cookie: `refresh_token=${refreshToken}` },
    });
    if (res.ok) refreshed = await res.json();
  } catch {
    // auth service unreachable — proceed as anonymous rather than failing the request
  }

  if (refreshed) {
    cookies.set('access_token', refreshed.accessToken, {
      domain: COOKIE_DOMAIN,
      path: '/',
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    cookies.set('refresh_token', refreshed.refreshToken, {
      domain: COOKIE_DOMAIN,
      path: '/',
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }

  return next();
});
