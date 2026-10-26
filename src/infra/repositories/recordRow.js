import { Record } from '../../domain/entities/Record.js';
import { RecordFile } from '../../domain/entities/RecordFile.js';

export function toRecord(row) {
  return new Record({
    id: requiredNumber(row.id),
    userId: row.user_id ?? null,
    topicId: optionalNumber(row.topic_id),
    schoolId: optionalNumber(row.school_id),
    unionId: optionalNumber(row.union_id),
    title: row.title,
    description: row.description,
    eventDate: row.event_date,
    eventEndDate: row.event_end_date,
    peopleCount: optionalNumber(row.people_count),
    authorName: row.author_name,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    school: parseJson(row.school),
    union: parseJson(row.unions),
    topic: parseJson(row.topics),
    files: toFiles(row.record_files),
  });
}

export function toRecordFile(row) {
  return new RecordFile({
    id: requiredNumber(row.id),
    recordId: requiredNumber(row.record_id),
    fileUrl: row.file_url,
    fileType: row.file_type,
    createdAt: row.created_at,
    isCover: row.is_cover === true,
    focusX: floatOr(row.focus_x, 0),
    focusY: floatOr(row.focus_y, 0),
    focusScale: floatOr(row.focus_scale, 1),
  });
}

function toFiles(value) {
  const rows = parseJson(value);
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => toRecordFile(row));
}

function parseJson(value) {
  if (value == null) return null;
  if (typeof value === 'string') return JSON.parse(value);
  return value;
}

function optionalNumber(value) {
  if (value == null) return null;
  return requiredNumber(value);
}

function requiredNumber(value) {
  return Number(value);
}

function floatOr(value, fallback) {
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number;
}
