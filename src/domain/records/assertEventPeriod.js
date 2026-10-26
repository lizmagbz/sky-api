import { AppError } from '../errors/AppError.js';

export function assertEventPeriod(eventDate, eventEndDate) {
  if (!eventEndDate) return;
  if (eventEndDate >= eventDate) return;
  throw new AppError('A data final não pode ser anterior à data inicial', 400);
}
