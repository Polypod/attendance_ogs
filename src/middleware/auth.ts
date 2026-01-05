// src/middleware/auth.ts - Authentication and authorization middleware
import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/User';
import { verifyToken } from '../utils/jwt';
import { UserRoleEnum, UserStatusEnum } from '../types/interfaces';

/**
 * Middleware to authenticate JWT tokens and attach user to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract token from Authorization header
    let token: string | undefined;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.'
      });
      return;
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Invalid token'
      });
      return;
    }

    // 3. Check if user still exists
    const user = await UserModel.findById(decoded.id).select('+password');
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User no longer exists'
      });
      return;
    }

    // 4. Check if user is active
    if (user.status !== UserStatusEnum.ACTIVE) {
      res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact an administrator.`
      });
      return;
    }

    // 5. Check if user changed password after token was issued
    if (decoded.iat && user.changedPasswordAfter(decoded.iat)) {
      res.status(401).json({
        success: false,
        message: 'Password was recently changed. Please log in again.'
      });
      return;
    }

    // 6. Update last login timestamp
    user.last_login = new Date();
    await user.save({ validateBeforeSave: false });

    // 7. Attach user to request (without password)
    req.user = {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      created_by: user.created_by,
      last_login: user.last_login,
      password_changed_at: user.password_changed_at,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Middleware to authorize users based on roles
 * @param roles - Array of allowed roles
 */
export const authorize = (...roles: UserRoleEnum[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user exists on request (should be added by authenticate middleware)
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to restrict access to own resources only
 * For STUDENT role to access only their own data
 * For INSTRUCTOR role to access only their own classes
 */
export const restrictToOwnResource = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  // ADMIN and STAFF can access all resources
  if (req.user.role === UserRoleEnum.ADMIN || req.user.role === UserRoleEnum.STAFF) {
    return next();
  }

  // STUDENT can only access their own resources
  if (req.user.role === UserRoleEnum.STUDENT) {
    // Check if the resource ID matches the user's ID
    const resourceId = req.params.id || req.body.student_id;
    if (resourceId !== req.user._id) {
      res.status(403).json({
        success: false,
        message: 'You can only access your own resources'
      });
      return;
    }
  }

  // INSTRUCTOR: Additional logic can be added here for class-specific restrictions
  // This would require checking if the class belongs to the instructor

  next();
};
