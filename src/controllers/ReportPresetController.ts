import { Request, Response } from 'express';
import { ReportPresetService, ForbiddenError } from '@/services/ReportPresetService';

export class ReportPresetController {
  constructor(private reportPresetService: ReportPresetService = new ReportPresetService()) {}

  listPresets = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const presets = await this.reportPresetService.listPresets(req.user);
      return res.json({ success: true, data: presets });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.status(403).json({ success: false, message: error.message });
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        message: 'Failed to list report presets',
        error: message
      });
    }
  };

  createPreset = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const preset = await this.reportPresetService.createPreset(req.user, req.body);
      return res.status(201).json({ success: true, data: preset });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.status(403).json({ success: false, message: error.message });
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        message: 'Failed to create report preset',
        error: message
      });
    }
  };

  updatePreset = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const preset = await this.reportPresetService.updatePreset(req.user, req.params.id, req.body);
      if (!preset) {
        return res.status(404).json({ success: false, message: 'Report preset not found' });
      }

      return res.json({ success: true, data: preset });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.status(403).json({ success: false, message: error.message });
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        message: 'Failed to update report preset',
        error: message
      });
    }
  };

  deletePreset = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const preset = await this.reportPresetService.deletePreset(req.user, req.params.id);
      if (!preset) {
        return res.status(404).json({ success: false, message: 'Report preset not found' });
      }

      return res.json({ success: true, data: preset });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.status(403).json({ success: false, message: error.message });
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        message: 'Failed to delete report preset',
        error: message
      });
    }
  };
}

export const reportPresetController = new ReportPresetController();
