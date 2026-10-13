// src/controllers/UserController.ts - User management business logic (Admin only)
import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { CreateUserDto, UpdateUserDto } from '../types/interfaces';
import { getOgsIssuer } from '../services/SsoService';
import { ogsStaffService } from '../services/OgsStaffService';

type UserDocument = InstanceType<typeof UserModel>;

class OgsLinkError extends Error {}

/**
 * Apply the admin's OGS link settings. The issuer always comes from this
 * server's configuration, never from the request.
 */
const applyOgsLink = (user: UserDocument, data: Pick<UpdateUserDto, 'ogs_user_id' | 'sso_enabled'>): void => {
  if ('ogs_user_id' in data && data.ogs_user_id !== undefined) {
    const subject = data.ogs_user_id?.trim();
    if (subject) {
      const issuer = getOgsIssuer();
      if (!issuer) {
        throw new OgsLinkError('OGS single sign-on is not configured (OGS_OIDC_ISSUER)');
      }
      user.external_identity = { issuer, subject };
    } else {
      user.external_identity = undefined;
      user.sso_enabled = false;
    }
  }

  if (typeof data.sso_enabled === 'boolean') {
    if (data.sso_enabled && !user.external_identity?.subject) {
      throw new OgsLinkError('Link an OGS account before enabling sign-in through OGS');
    }
    user.sso_enabled = data.sso_enabled;
  }
};

const isOgsLinkConflict = (error: unknown): boolean => {
  const keyPattern = (error as { keyPattern?: Record<string, unknown> })?.keyPattern;
  return Boolean(keyPattern && 'external_identity.subject' in keyPattern);
};

export class UserController {
  /**
   * Get all users
   * GET /api/users
   */
  async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await UserModel.find({}).select('-password');
      res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = await UserModel.findById(id).select('-password');

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create new user (admin only)
   * POST /api/users
   */
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { ogs_user_id, sso_enabled, ...userData }: CreateUserDto = req.body;

      // Add created_by field
      const newUser = new UserModel({
        ...userData,
        created_by: req.user._id
      });
      applyOgsLink(newUser, { ogs_user_id, sso_enabled });

      await newUser.save();

      // Return user without password
      const userResponse = await UserModel.findById(newUser._id).select('-password');

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: userResponse
      });
    } catch (error) {
      if (error instanceof OgsLinkError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else if (isOgsLinkConflict(error)) {
        res.status(400).json({
          success: false,
          message: 'The OGS account is already linked to another user'
        });
      } else if (error instanceof Error && 'name' in error && error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.message
        });
      } else if (error instanceof Error && 'code' in error && (error as any).code === 11000) {
        res.status(400).json({
          success: false,
          message: 'Email already exists',
          error: 'Duplicate key error'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error creating user',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Update user
   * PUT /api/users/:id
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateUserDto = req.body;

      // Remove password from update data if present (use resetPassword endpoint instead)
      if ('password' in updateData) {
        delete updateData.password;
      }

      // Linking needs the document: unlinking must not leave an account
      // with neither a password nor an OGS identity.
      if ('ogs_user_id' in updateData || 'sso_enabled' in updateData) {
        const { ogs_user_id, sso_enabled, ...fields } = updateData;
        const user = await UserModel.findById(id).select('+password');
        if (!user) {
          res.status(404).json({
            success: false,
            message: 'User not found'
          });
          return;
        }

        user.set(fields);
        applyOgsLink(user, { ogs_user_id, sso_enabled });
        await user.save();

        const savedUser = await UserModel.findById(id).select('-password');
        res.status(200).json({
          success: true,
          message: 'User updated successfully',
          data: savedUser
        });
        return;
      }

      const updatedUser = await UserModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      });
    } catch (error) {
      if (error instanceof OgsLinkError) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      if (isOgsLinkConflict(error)) {
        res.status(400).json({
          success: false,
          message: 'The OGS account is already linked to another user'
        });
        return;
      }
      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.message
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Error updating user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * OGS admin/editor accounts an attendance user can be linked to
   * GET /api/users/ogs-staff
   */
  async listOgsStaff(_req: Request, res: Response): Promise<void> {
    try {
      const accounts = await ogsStaffService.list();
      res.status(200).json({
        success: true,
        data: accounts.map((account) => ({
          id: String(account.id),
          email: account.email,
          displayName: account.displayName,
          roles: account.roles,
          status: account.status,
          isActive: account.isActive
        }))
      });
    } catch (error) {
      res.status(502).json({
        success: false,
        message: 'Could not fetch accounts from OGS',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete user
   * DELETE /api/users/:id
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Prevent users from deleting themselves
      if (req.user && req.user._id === id) {
        res.status(400).json({
          success: false,
          message: 'You cannot delete your own account'
        });
        return;
      }

      const deletedUser = await UserModel.findByIdAndDelete(id).select('-password');

      if (!deletedUser) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
        data: deletedUser
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update user status (activate/deactivate/suspend)
   * PUT /api/users/:id/status
   */
  async updateUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        res.status(400).json({
          success: false,
          message: 'Status is required'
        });
        return;
      }

      // Prevent users from changing their own status
      if (req.user && req.user._id === id) {
        res.status(400).json({
          success: false,
          message: 'You cannot change your own account status'
        });
        return;
      }

      const updatedUser = await UserModel.findByIdAndUpdate(
        id,
        { status },
        { new: true, runValidators: true }
      ).select('-password');

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User status updated successfully',
        data: updatedUser
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating user status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Reset user password (admin only)
   * PUT /api/users/:id/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword) {
        res.status(400).json({
          success: false,
          message: 'New password is required'
        });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
        return;
      }

      const user = await UserModel.findById(id).select('+password');
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Update password (will be hashed by pre-save hook)
      user.password = newPassword;
      await user.save();

      res.status(200).json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error resetting password',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const userController = new UserController();
