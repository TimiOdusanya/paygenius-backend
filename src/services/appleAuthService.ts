import jwt, { JwtPayload } from 'jsonwebtoken';

export interface AppleUser {
  id: string;
  email?: string;
}

function isPlaceholder(value?: string): boolean {
  return !value || value.startsWith('your-');
}

/**
 * Decode and validate an Apple identity token.
 * Uses `sub` as the stable Apple user id (the raw JWT changes on every sign-in).
 * When APPLE_CLIENT_ID is set, also checks audience.
 */
export const verifyAppleToken = (identityToken: string): AppleUser => {
  const payload = jwt.decode(identityToken) as JwtPayload | null;

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid Apple identity token');
  }

  if (payload.iss !== 'https://appleid.apple.com') {
    throw new Error('Invalid Apple token issuer');
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Apple token missing subject');
  }

  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('Apple token expired');
  }

  const audience = process.env.APPLE_CLIENT_ID;
  if (!isPlaceholder(audience)) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(audience)) {
      throw new Error('Apple token audience mismatch');
    }
  }

  return {
    id: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  };
};
