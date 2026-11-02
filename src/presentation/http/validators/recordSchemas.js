import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').refine(isRealDate, 'Data inválida');

export const createRecordSchema = z.strictObject({
  title: z.string().trim().min(1, 'Informe o título'),
  description: z.string().trim().min(1, 'Informe a descrição'),
  eventDate: isoDate,
  eventEndDate: isoDate.nullable().optional(),
  peopleCount: z.number().int().positive('A quantidade de pessoas deve ser maior que zero').nullable().optional(),
  authorName: z.string().trim().min(1).optional(),
  schoolId: z.number().int().positive().nullable().optional(),
  unionId: z.number().int().positive().nullable().optional(),
  topicId: z.number().int().positive(),
}).superRefine(requireScope);

export const updateRecordSchema = z.strictObject({
  title: z.string().trim().min(1, 'Informe o título'),
  description: z.string().trim().min(1, 'Informe a descrição'),
  eventDate: isoDate,
  eventEndDate: isoDate.nullable().optional(),
  peopleCount: z.number().int().positive('A quantidade de pessoas deve ser maior que zero').nullable().optional(),
});

export const updateRecordFileSchema = z.strictObject({
  isCover: z.boolean(),
  focusX: z.number().min(-1).max(1),
  focusY: z.number().min(-1).max(1),
  focusScale: z.number().min(1).max(3).optional(),
});

function requireScope(input, context) {
  if (input.schoolId || input.unionId) return;
  context.addIssue({
    code: 'custom',
    message: 'Informe a escola ou a união',
    path: ['schoolId'],
  });
}

function isRealDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year) return false;
  if (date.getUTCMonth() !== month - 1) return false;
  return date.getUTCDate() === day;
}
