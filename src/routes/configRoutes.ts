// src/routes/configRoutes.ts - Configuration routes

import { Router } from 'express';
import { configController } from '../controllers/ConfigController';

const router = Router();

// Public route - no authentication required
router.get('/', configController.getConfig.bind(configController));

export { router as configRoutes };
