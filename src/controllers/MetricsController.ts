import { Request, Response } from 'express';
import { MetricsService } from '../services/MetricsService';

export const MetricsController = {
  async getMetrics(_req: Request, res: Response): Promise<void> {
    const body = await MetricsService.metrics();
    res.setHeader('Content-Type', MetricsService.contentType());
    res.status(200).send(body);
  },
};
