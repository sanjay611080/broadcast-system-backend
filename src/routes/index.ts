import { Router } from 'express';
import authRoutes from './auth.routes';
import contentRoutes from './content.routes';
import approvalRoutes from './approval.routes';
import broadcastRoutes from './broadcast.routes';
import analyticsRoutes from './analytics.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/content', broadcastRoutes);
router.use('/content', contentRoutes);
router.use('/principal', approvalRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
