// src/routes/memberSyncRoutes.ts - Member sync routes (admin only)
import { Router } from 'express';
import { memberSyncController } from '@/controllers/MemberSyncController';
import { authorize } from '@/middleware/auth';
import { UserRoleEnum } from '@/types/interfaces';

const router = Router();

router.get('/status', authorize(UserRoleEnum.ADMIN), memberSyncController.getSyncStatus);

router.post('/preview', authorize(UserRoleEnum.ADMIN), memberSyncController.previewSync);

router.post('/run', authorize(UserRoleEnum.ADMIN), memberSyncController.runSync);

export { router as memberSyncRoutes };
