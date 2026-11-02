import { ScheduleEvent } from '../../domain/entities/ScheduleEvent.js';

export function toScheduleEvent(row) {
  return new ScheduleEvent({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    createdAt: row.created_at,
    googleEventId: row.google_event_id,
    googleCalendarId: row.google_calendar_id,
    updatedAt: row.updated_at,
    isAllDay: row.is_all_day === true,
    audience: row.audience,
    associationId: optionalNumber(row.association_id),
    unionId: optionalNumber(row.union_id),
  });
}

function optionalNumber(value) {
  if (value == null) return null;
  return Number(value);
}
