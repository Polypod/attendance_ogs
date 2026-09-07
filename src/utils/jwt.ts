// src/utils/jwt.ts - JWT token utilities for authentication
import jwt from 'jsonwebtoken';

interface TokenPayload {
  id: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT access token
 * @param userId - User ID to encode in the token
 * @returns Signed JWT token
 */
export const signToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  // Cast to jwt.Secret and jwt.SignOptions to satisfy TypeScript signatures
  return jwt.sign({ id: userId }, secret as jwt.Secret, {
    expiresIn
  } as jwt.SignOptions);
};

/**
 * Sign a JWT refresh token
 * @param userId - User ID to encode in the token
 * @returns Signed refresh token
 */
export const signRefreshToken = (userId: string): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
  }

  // Cast to jwt.Secret and jwt.SignOptions to satisfy TypeScript signatures
  return jwt.sign({ id: userId }, secret as jwt.Secret, {
    expiresIn
  } as jwt.SignOptions);
};

/**
 * Verify and decode a JWT access token
 * @param token - JWT token to verify
 * @returns Decoded token payload
 * @throws Error if token is invalid or expired
 */
export const verifyToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Verify and decode a JWT refresh token
 * @param token - Refresh token to verify
 * @returns Decoded token payload
 * @throws Error if token is invalid or expired
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
};
