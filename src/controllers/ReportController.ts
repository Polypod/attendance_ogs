import { Request, Response } from 'express';
import { ReportService } from '@/services/ReportService';
import { ValidationError } from '@/utils/validators';

export class ReportController {
  constructor(private reportService: ReportService = new ReportService()) {}

  getRawAttendanceReport = async (req: Request, res: Response) => {
    try {
      const result = await this.reportService.getRawAttendanceReport(req.body);
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ success: false, message: error.message });
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        message: 'Failed to generate raw attendance report',
        error: message
      });
    }
  };
}

export const reportController = new ReportController();
