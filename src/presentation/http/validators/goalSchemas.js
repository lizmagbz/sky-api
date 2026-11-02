import { z } from 'zod';
import { isGoalYear } from '../../../domain/goals/goalYear.js';

export const upsertGoalSchema = z.strictObject({
  topicId: z.number().int().positive('Tópico inválido'),
  targetCount: z.number().int().positive('A meta precisa ser maior que zero'),
  year: z.number().int().refine(isGoalYear, 'Informe um ano entre 2000 e 2100'),
});
