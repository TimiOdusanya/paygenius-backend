import jwt, { SignOptions } from 'jsonwebtoken';
import { IUser } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  phoneNumber: string;
  iat?: number;
  exp?: number;
}

export const generateToken = (user: any): string => {
  const payload: JWTPayload = {
    userId: user._id?.toString() || user.id,
    phoneNumber: user.phoneNumber
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
    issuer: 'paygenius-api',
    audience: 'paygenius-app'
  });
};

export const generateRefreshToken = (user: any): string => {
  const payload: JWTPayload = {
    userId: user._id?.toString() || user.id,
    phoneNumber: user.phoneNumber
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d' as any,
    issuer: 'paygenius-api',
    audience: 'paygenius-app'
  });
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'paygenius-api',
      audience: 'paygenius-app'
    }) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const generatePhoneVerificationCode = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};
