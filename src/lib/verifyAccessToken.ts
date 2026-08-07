import { jwtVerify } from 'jose';

if (!import.meta.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not set. Login detection cannot work without it — copy .env.example to .env and set it (must match server-auth\'s JWT_SECRET).'
  );
}

const secret = new TextEncoder().encode(import.meta.env.JWT_SECRET);

export async function verifyAccessToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}
