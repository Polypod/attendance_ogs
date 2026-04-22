import express from 'express';
import { MetricsController } from '../controllers/MetricsController';
import { requireMetricsAccess } from '../middleware/metricsAuth';

const router = express.Router();

router.get('/', requireMetricsAccess, MetricsController.getMetrics);

export const metricsRoutes = router;
