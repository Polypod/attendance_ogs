// src/controllers/AuthController.ts - Authentication business logic
import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { signToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { LoginDto, ChangePasswordDto } from '../types/interfaces';

export class AuthController {
  /**
   * User login
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password }: LoginDto = req.body;

      // 1. Check if user exists and select password field
      const user = await UserModel.findOne({ email }).select('+password');
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }

      // 2. Check if password is correct
      const isPasswordCorrect = await user.comparePassword(password);
      if (!isPasswordCorrect) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }

      // 3. Check if user is active
      if (user.status !== 'active') {
        res.status(403).json({
          success: false,
          message: `Account is ${user.status}. Please contact an administrator.`
        });
        return;
      }

      // 4. Generate tokens
      const token = signToken(user._id.toString());
      const refreshToken = signRefreshToken(user._id.toString());

      // 5. Update last login
      user.last_login = new Date();
      await user.save({ validateBeforeSave: false });

      // 6. Send response (exclude password)
      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        refreshToken,
        user: {
          _id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          last_login: user.last_login
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Login error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Refresh access token using refresh token
   * POST /api/auth/refresh-token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
        return;
      }

      // 1. Verify refresh token
      let decoded;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch (error) {
        res.status(401).json({
          success: false,
          message: error instanceof Error ? error.message : 'Invalid refresh token'
        });
        return;
      }

      // 2. Check if user still exists
      const user = await UserModel.findById(decoded.id);
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User no longer exists'
        });
        return;
      }

      // 3. Check if user is active
      if (user.status !== 'active') {
        res.status(403).json({
          success: false,
          message: `Account is ${user.status}`
        });
        return;
      }

      // 4. Generate new access token
      const newToken = signToken(user._id.toString());

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        token: newToken
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Token refresh error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Fetch fresh user data
      const user = await UserModel.findById(req.user._id);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          _id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          last_login: user.last_login,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user profile',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update current user profile
   * PUT /api/auth/me
   */
  async updateMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Only allow updating name
      const { name } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          message: 'Name is required'
        });
        return;
      }

      const updatedUser = await UserModel.findByIdAndUpdate(
        req.user._id,
        { name },
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          _id: updatedUser._id.toString(),
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          status: updatedUser.status
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating profile',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Change password
   * PUT /api/auth/change-password
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { currentPassword, newPassword }: ChangePasswordDto = req.body;

      // 1. Get user with password
      const user = await UserModel.findById(req.user._id).select('+password');
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // 2. Verify current password
      const isPasswordCorrect = await user.comparePassword(currentPassword);
      if (!isPasswordCorrect) {
        res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
        return;
      }

      // 3. Update password
      user.password = newPassword;
      await user.save();

      res.status(200).json({
        success: true,
        message: 'Password changed successfully. Please log in again.'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error changing password',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const authController = new AuthController();
