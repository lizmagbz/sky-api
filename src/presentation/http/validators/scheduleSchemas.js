import { z } from 'zod';
import { isScheduleAudience } from '../../../domain/schedule/scheduleAudiences.js';

const isoDateTime = z.string().refine(isIsoDateTime, 'Data inválida');
const audience = z.string().refine(isScheduleAudience, 'Público do evento inválido');
const optionalText = z.string().trim().nullable().optional();

export const createScheduleEventSchema = z.strictObject({
  title: z.string().trim().min(1, 'Informe o título'),
  description: optionalText,
  startAt: isoDateTime,
  endAt: isoDateTime,
  isAllDay: z.boolean().default(false),
  audience: audience.default('private'),
  associationId: z.number().int().positive().nullable().optional(),
  unionId: z.number().int().positive().nullable().optional(),
  googleEventId: optionalText,
  googleCalendarId: optionalText,
}).superRefine(requirePeriod);

export const updateScheduleEventSchema = z.strictObject({
  title: z.string().trim().min(1, 'Informe o título').optional(),
  description: optionalText,
  startAt: isoDateTime.optional(),
  endAt: isoDateTime.optional(),
  isAllDay: z.boolean().optional(),
  audience: audience.optional(),
  associationId: z.number().int().positive().nullable().optional(),
  unionId: z.number().int().positive().nullable().optional(),
  googleEventId: optionalText,
  googleCalendarId: optionalText,
}).superRefine(requireChange).superRefine(requirePeriod);

function requireChange(input, context) {
  if (Object.keys(input).length > 0) return;
  context.addIssue({
    code: 'custom',
    message: 'Informe o que deseja alterar',
    path: ['title'],
  });
}

function requirePeriod(input, context) {
  if (!input.startAt || !input.endAt) return;
  if (Date.parse(input.endAt) > Date.parse(input.startAt)) return;
  context.addIssue({
    code: 'custom',
    message: 'O horário final precisa ser depois do início',
    path: ['endAt'],
  });
}

function isIsoDateTime(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}
