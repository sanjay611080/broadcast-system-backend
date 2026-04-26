import { pool } from '../config/db';

export interface ScheduleRow {
  id: string;
  content_id: string;
  slot_id: string;
  rotation_order: number;
  duration: number;
  created_at: Date;
}


export async function upsertSchedule(params: {
  contentId: string;
  slotId: string;
  durationMinutes: number;
}): Promise<ScheduleRow> {
  const next = await pool.query<{ next_order: number }>(
    `SELECT COALESCE(MAX(rotation_order), 0) + 1 AS next_order
     FROM content_schedule WHERE slot_id = $1`,
    [params.slotId],
  );
  const nextOrder = Number(next.rows[0]?.next_order ?? 1);

  const { rows } = await pool.query<ScheduleRow>(
    `INSERT INTO content_schedule (content_id, slot_id, rotation_order, duration)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (content_id, slot_id) DO UPDATE
       SET duration = EXCLUDED.duration
     RETURNING *`,
    [params.contentId, params.slotId, nextOrder, params.durationMinutes],
  );
  return rows[0]!;
}
