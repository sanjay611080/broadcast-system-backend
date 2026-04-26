import { pool } from '../config/db';
import type { ContentRow, ContentStatus } from './types';

export async function insertContent(params: {
  title: string;
  description: string | null;
  subject: string;
  fileUrl: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  startTime: Date | null;
  endTime: Date | null;
  rotationMinutes: number;
}): Promise<ContentRow> {
  const { rows } = await pool.query<ContentRow>(
    `INSERT INTO content (
       title, description, subject, file_url, file_path, file_type, file_size,
       uploaded_by, status, start_time, end_time, rotation_minutes
     )
     VALUES ($1,$2,LOWER($3),$4,$5,$6,$7,$8,'pending',$9,$10,$11)
     RETURNING *`,
    [
      params.title,
      params.description,
      params.subject,
      params.fileUrl,
      params.filePath,
      params.fileType,
      params.fileSize,
      params.uploadedBy,
      params.startTime,
      params.endTime,
      params.rotationMinutes,
    ],
  );
  return rows[0]!;
}

export async function findContentById(id: string): Promise<ContentRow | null> {
  const { rows } = await pool.query<ContentRow>(`SELECT * FROM content WHERE id = $1 LIMIT 1`, [
    id,
  ]);
  return rows[0] ?? null;
}

export interface ContentListFilters {
  status?: ContentStatus;
  subject?: string;
  uploadedBy?: string;
  page: number;
  pageSize: number;
}

export async function listContent(filters: ContentListFilters): Promise<{
  rows: ContentRow[];
  total: number;
}> {
  const where: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filters.status) {
    where.push(`status = $${i++}`);
    params.push(filters.status);
  }
  if (filters.subject) {
    where.push(`subject = LOWER($${i++})`);
    params.push(filters.subject);
  }
  if (filters.uploadedBy) {
    where.push(`uploaded_by = $${i++}`);
    params.push(filters.uploadedBy);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalQ = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM content ${whereSql}`,
    params,
  );
  const total = parseInt(totalQ.rows[0]!.count, 10);

  const offset = (filters.page - 1) * filters.pageSize;
  const dataParams = [...params, filters.pageSize, offset];

  const dataQ = await pool.query<ContentRow>(
    `SELECT * FROM content
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    dataParams,
  );

  return { rows: dataQ.rows, total };
}

export async function approveContent(params: {
  contentId: string;
  approvedBy: string;
}): Promise<ContentRow | null> {
  const { rows } = await pool.query<ContentRow>(
    `UPDATE content
     SET status = 'approved',
         approved_by = $2,
         approved_at = NOW(),
         rejection_reason = NULL
     WHERE id = $1 AND status IN ('pending','uploaded','rejected')
     RETURNING *`,
    [params.contentId, params.approvedBy],
  );
  return rows[0] ?? null;
}

export async function rejectContent(params: {
  contentId: string;
  approvedBy: string;
  reason: string;
}): Promise<ContentRow | null> {
  const { rows } = await pool.query<ContentRow>(
    `UPDATE content
     SET status = 'rejected',
         approved_by = $2,
         approved_at = NOW(),
         rejection_reason = $3
     WHERE id = $1
     RETURNING *`,
    [params.contentId, params.approvedBy, params.reason],
  );
  return rows[0] ?? null;
}

export async function findLiveEligibleByTeacher(params: {
  teacherId: string;
  subject?: string;
  now: Date;
}): Promise<ContentRow[]> {
  const args: unknown[] = [params.teacherId, params.now];
  let subjClause = '';
  if (params.subject) {
    args.push(params.subject);
    subjClause = `AND subject = LOWER($3)`;
  }

  const { rows } = await pool.query<ContentRow>(
    `SELECT * FROM content
     WHERE uploaded_by = $1
       AND status = 'approved'
       AND start_time IS NOT NULL
       AND end_time   IS NOT NULL
       AND start_time <= $2
       AND end_time   >  $2
       ${subjClause}
     ORDER BY subject ASC, created_at ASC`,
    args,
  );
  return rows;
}

export async function deleteContent(id: string): Promise<ContentRow | null> {
  const { rows } = await pool.query<ContentRow>(
    `DELETE FROM content WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}
