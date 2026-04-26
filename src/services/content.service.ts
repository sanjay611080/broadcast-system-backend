import { v4 as uuid } from 'uuid';
import path from 'node:path';
import { uploadToStorage, deleteFromStorage } from '../config/storage';
import {
  insertContent,
  listContent,
  findContentById,
  type ContentListFilters,
} from '../models/content.model';
import { getOrCreateSlot } from '../models/slot.model';
import { upsertSchedule } from '../models/schedule.model';
import { ApiError } from '../utils/ApiError';
import { cacheDel, cacheKeys } from '../utils/cache';
import type { ContentRow } from '../models/types';

export async function uploadContent(params: {
  teacherId: string;
  title: string;
  description: string | null;
  subject: string;
  startTime: Date | null;
  endTime: Date | null;
  rotationMinutes: number;
  file: Express.Multer.File;
}): Promise<ContentRow> {
  const ext = (path.extname(params.file.originalname) || '').toLowerCase();
  const safeExt = ['.jpg', '.jpeg', '.png', '.gif'].includes(ext) ? ext : '';
  const storagePath = `${params.teacherId}/${Date.now()}-${uuid()}${safeExt}`;

  const { path: filePath, url: fileUrl } = await uploadToStorage({
    path: storagePath,
    buffer: params.file.buffer,
    contentType: params.file.mimetype,
  });

  const content = await insertContent({
    title: params.title,
    description: params.description,
    subject: params.subject,
    fileUrl,
    filePath,
    fileType: params.file.mimetype,
    fileSize: params.file.size,
    uploadedBy: params.teacherId,
    startTime: params.startTime,
    endTime: params.endTime,
    rotationMinutes: params.rotationMinutes,
  });

  const slot = await getOrCreateSlot(params.subject);
  await upsertSchedule({
    contentId: content.id,
    slotId: slot.id,
    durationMinutes: params.rotationMinutes,
  });

  await cacheDel(cacheKeys.liveByTeacherPattern(params.teacherId));
  return content;
}

export async function getMyContent(
  teacherId: string,
  filters: Omit<ContentListFilters, 'uploadedBy'>,
): Promise<{ rows: ContentRow[]; total: number }> {
  return listContent({ ...filters, uploadedBy: teacherId });
}

export async function getContentForOwnerOrPrincipal(params: {
  contentId: string;
  requesterId: string;
  requesterRole: 'principal' | 'teacher';
}): Promise<ContentRow> {
  const content = await findContentById(params.contentId);
  if (!content) throw ApiError.notFound('Content not found');

  if (params.requesterRole !== 'principal' && content.uploaded_by !== params.requesterId) {
    throw ApiError.forbidden('Not your content');
  }
  return content;
}

export async function deleteOwnContent(params: {
  contentId: string;
  teacherId: string;
}): Promise<void> {
  const content = await findContentById(params.contentId);
  if (!content) throw ApiError.notFound('Content not found');
  if (content.uploaded_by !== params.teacherId) throw ApiError.forbidden('Not your content');

  await deleteFromStorage(content.file_path).catch(() => undefined);
  // Schedule + analytics rows cascade via FK ON DELETE CASCADE.
  const { pool } = await import('../config/db');
  await pool.query(`DELETE FROM content WHERE id = $1`, [params.contentId]);

  await cacheDel(cacheKeys.liveByTeacherPattern(params.teacherId));
}
