import { AppError } from '../../domain/errors/AppError.js';
import { isGoalYear } from '../../domain/goals/goalYear.js';
import { readPositiveId } from './readPositiveId.js';

export function readGoalYear(value) {
  if (Array.isArray(value)) throw new AppError('Informe um ano entre 2000 e 2100', 400);
  const year = Number(value);
  if (!isGoalYear(year)) throw new AppError('Informe um ano entre 2000 e 2100', 400);
  return year;
}

export function readTopicId(value) {
  if (typeof value !== 'string') throw new AppError('Tópico inválido', 400);
  return readPositiveId(value, 'Tópico');
}
