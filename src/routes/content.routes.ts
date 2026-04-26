import { Router } from 'express';
import * as content from '../controllers/content.controller';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { upload as multerUpload } from '../middlewares/upload';
import { validate } from '../middlewares/validate';

const router = Router();

// Teacher: upload content (multipart/form-data)
router.post(
  '/',
  requireAuth,
  requireRole('teacher'),
  multerUpload.single('file'),
  validate(content.uploadSchema),
  content.upload,
);

// Teacher: list own content with filters/pagination
router.get(
  '/mine',
  requireAuth,
  requireRole('teacher'),
  validate(content.listMineSchema, 'query'),
  content.listMine,
);

// Owner or principal: fetch one
router.get('/:id', requireAuth, content.getOne);

// Teacher: delete own content
router.delete('/:id', requireAuth, requireRole('teacher'), content.remove);

export default router;
