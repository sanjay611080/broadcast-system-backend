import { findLiveEligibleByTeacher } from '../models/content.model';
import { findUserById } from '../models/user.model';
import { recordView } from '../models/analytics.model';
import {
  pickActivePerSubject,
  pickActiveForSubject,
  type ScheduleEligible,
} from '../utils/scheduler';
import { cacheGet, cacheSet, cacheKeys } from '../utils/cache';
import type { ContentRow } from '../models/types';

export interface PublicContent {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  start_time: string;
  end_time: string;
}

export interface LiveSlotResponse {
  subject: string;
  content: PublicContent;
  rotation: {
    index_in_cycle: number;
    total_in_rotation: number;
    cycle_length_seconds: number;
    elapsed_seconds: number;
    next_rotation_at: string;
  };
}

function toPublic(c: ContentRow): PublicContent {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    subject: c.subject,
    file_url: c.file_url,
    file_type: c.file_type,
    uploaded_by: c.uploaded_by,
    start_time: c.start_time!.toISOString(),
    end_time: c.end_time!.toISOString(),
  };
}

function toEligible(c: ContentRow): ScheduleEligible & { row: ContentRow } {
  return {
    id: c.id,
    subject: c.subject,
    start_time: c.start_time!,
    end_time: c.end_time!,
    rotation_minutes: c.rotation_minutes,
    created_at: c.created_at,
    row: c,
  };
}

export interface LiveQuery {
  teacherId: string;
  subject?: string;
  now?: Date;
}

export interface LiveResult {
  teacher: { id: string; name: string };
  served_at: string;
  cached: boolean;
  slots: LiveSlotResponse[];
  message?: string;
}

export async function getLiveForTeacher(query: LiveQuery): Promise<LiveResult> {
  const now = query.now ?? new Date();

  const cacheKey = cacheKeys.liveByTeacher(query.teacherId, query.subject);
  const cached = await cacheGet<LiveResult>(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const teacher = await findUserById(query.teacherId);
  if (!teacher || teacher.role !== 'teacher') {
    return {
      teacher: { id: query.teacherId, name: 'unknown' },
      served_at: now.toISOString(),
      cached: false,
      slots: [],
      message: 'No content available',
    };
  }

  const eligibleRows = await findLiveEligibleByTeacher({
    teacherId: query.teacherId,
    subject: query.subject,
    now,
  });

  if (eligibleRows.length === 0) {
    const result: LiveResult = {
      teacher: { id: teacher.id, name: teacher.name },
      served_at: now.toISOString(),
      cached: false,
      slots: [],
      message: 'No content available',
    };
    await cacheSet(cacheKey, result);
    return result;
  }

  const eligible = eligibleRows.map(toEligible);

  let slots: LiveSlotResponse[];
  if (query.subject) {
    const active = pickActiveForSubject(eligible, query.subject, now);
    slots = active
      ? [
          {
            subject: active.active.subject,
            content: toPublic(active.active.row),
            rotation: {
              index_in_cycle: active.rotation.indexInCycle,
              total_in_rotation: active.rotation.totalInRotation,
              cycle_length_seconds: active.rotation.cycleLength,
              elapsed_seconds: active.rotation.elapsedInCycle,
              next_rotation_at: active.rotation.nextRotationAt.toISOString(),
            },
          },
        ]
      : [];
  } else {
    const actives = pickActivePerSubject(eligible, now);
    slots = actives.map((a) => ({
      subject: a.active.subject,
      content: toPublic(a.active.row),
      rotation: {
        index_in_cycle: a.rotation.indexInCycle,
        total_in_rotation: a.rotation.totalInRotation,
        cycle_length_seconds: a.rotation.cycleLength,
        elapsed_seconds: a.rotation.elapsedInCycle,
        next_rotation_at: a.rotation.nextRotationAt.toISOString(),
      },
    }));
  }

  const result: LiveResult = {
    teacher: { id: teacher.id, name: teacher.name },
    served_at: now.toISOString(),
    cached: false,
    slots,
    ...(slots.length === 0 ? { message: 'No content available' } : {}),
  };

  await cacheSet(cacheKey, result);

  Promise.allSettled(
    slots.map((s) =>
      recordView({
        contentId: s.content.id,
        teacherId: teacher.id,
        subject: s.subject,
      }),
    ),
  ).catch(() => undefined);

  return result;
}
