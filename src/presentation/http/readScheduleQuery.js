import { AppError } from '../../domain/errors/AppError.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readScheduleEventId(value) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new AppError('Evento inválido', 400);
  }
  return value;
}

export function readGoogleEventId(value) {
  if (value == null || value === '') return null;
  if (Array.isArray(value) || typeof value !== 'string') {
    throw new AppError('Evento do Google inválido', 400);
  }
  const id = value.trim();
  if (!id || id.length > 1024) throw new AppError('Evento do Google inválido', 400);
  return id;
}
