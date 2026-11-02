import { AppError } from '../../domain/errors/AppError.js';

export function readPositiveId(value, label) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new AppError(`${label} inválido`, 400);
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(`${label} inválido`, 400);
  }
  return id;
}
