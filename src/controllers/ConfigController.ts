// src/controllers/ConfigController.ts - Configuration API controller

import { Request, Response } from 'express';
import { ConfigService } from '../services/ConfigService';

export class ConfigController {
  /**
   * GET /api/config
   * Returns system configuration (categories and belt levels)
   * Public endpoint - no authentication required
   */
  public async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const configService = ConfigService.getInstance();

      const config = {
        categories: configService.getCategories(),
        beltLevels: configService.getBeltLevels()
      };

      res.status(200).json({
        success: true,
        data: config
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve configuration',
        error: error.message
      });
    }
  }
}

export const configController = new ConfigController();
